# Converts one model from the team's Unity packs into a .glb the game loads (run by tools/assets/convert.mjs inside
# Blender: blender -b --factory-startup -P convert.py -- job.json). The job says which FBX, which texture its material
# uses (found through Unity's guids by convert.mjs), which animations to keep and what the game calls them: either
# actions already in the file (by the name after the last "|"), or ranges of frames cut from one long take (Unity keeps
# those split points in the model's .meta file). Everything else is dropped, so the game downloads only what it plays.
import bpy, sys, json

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=job['src'], use_anim=True, ignore_leaf_bones=True, automatic_bone_orientation=False)
for extra in job.get('also') or []: bpy.ops.import_scene.fbx(filepath=extra, use_anim=False)   # (more parts of one piece, e.g. a door wall and its frame)

# keep only the meshes asked for, or drop some (files often hold several variants: two sets of horns), and the armatures
keep, drop = job.get('meshes'), job.get('drop') or []
for o in list(bpy.data.objects):
    if o.type == 'MESH' and ((keep and not any(k in o.name for k in keep)) or any(k in o.name for k in drop)): bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type not in ('MESH', 'ARMATURE', 'EMPTY'): bpy.data.objects.remove(o, do_unlink=True)

# a prop: the rig (a bow's string bone) left out, the mesh as it rests
if job.get('static'):
    for o in bpy.data.objects:
        if o.type == 'MESH':
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
            for md in [md for md in o.modifiers if md.type == 'ARMATURE']: o.modifiers.remove(md)
            o.vertex_groups.clear()
    for o in [o for o in bpy.data.objects if o.type in ('ARMATURE', 'EMPTY')]: bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)

# skinned parts sit where their bones say (Unity ignores a skinned mesh's own transform; some packs leave a 0.01 scale on
# the parts while the bones are in centimetres, which tears the body apart once it moves)
if job.get('bindToArmature'):
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.parent and o.parent.type == 'ARMATURE': o.matrix_parent_inverse.identity(); o.matrix_basis.identity()

# one plain PBR material for the whole model, on the pack's texture (Unity materials don't survive the FBX). A shared
# atlas isn't put in the file: the material is named after it ("tex:<key>") and the game puts the one copy on it.
img = bpy.data.images.load(job['texture']) if job.get('texture') and not job.get('shared') else None
mat = bpy.data.materials.new('tex:' + job['shared'] if job.get('shared') else job.get('name', 'Mat')); mat.use_nodes = True
nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = job.get('roughness', 0.85); bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
if img:
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Closest' if job.get('palette') else 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
for o in bpy.data.objects:
    if o.type == 'MESH':
        if not o.material_slots: o.data.materials.append(mat)
        for slot in o.material_slots: slot.material = mat

# colours baked from the texture into the vertices (the game's trees, rocks and shrubs are vertex-coloured: one material
# for every species, no texture): each face corner takes the atlas colour under its UV
if job.get('bakeColors'):
    import numpy as np
    src = bpy.data.images.load(job['bakeColors']); W, H = src.size; px = np.empty(W * H * 4, np.float32); src.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    tint = np.array(job.get('tint', [1, 1, 1]) + [1], np.float32)
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.data.uv_layers: continue
        n = len(o.data.loops); uv = np.empty(n * 2, np.float32); o.data.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(n, 2) % 1.0
        x = np.minimum((uv[:, 0] * W).astype(int), W - 1); y = np.minimum((uv[:, 1] * H).astype(int), H - 1)
        col = px[y, x] * tint; col[:, 3] = 1
        ca = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); ca.data.foreach_set('color_srgb', col.ravel())
        o.data.color_attributes.active_color = ca
        o.data.color_attributes.render_color_index = o.data.color_attributes.find('Col')

# one mesh for the whole body (the Infinity PBR characters come in a hundred pieces: a draw call each in the game)
if job.get('join'):
    parts = [o for o in bpy.data.objects if o.type == 'MESH']
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts): bpy.ops.object.join()
    parts[0].name = job.get('name', 'Body'); parts[0].data.materials.clear(); parts[0].data.materials.append(mat)
    for poly in parts[0].data.polygons: poly.material_index = 0

# animations: renamed, or cut out of one take, and nothing else
def curves(a):   # (Blender 5 keeps an action's curves in layers and slots; older versions on the action)
    if hasattr(a, 'layers') and a.layers: return [fc for st in a.layers[0].strips for sl in a.slots for fc in st.channelbag(sl).fcurves] if a.slots else []
    return list(a.fcurves)
src = list(bpy.data.actions); want = []
for ours, theirs in (job.get('clips') or {}).items():
    a = next((x for x in src if x.name.split('|')[-1] == theirs), None)
    if not a: raise SystemExit(f'no action {theirs} in {job["src"]}: ' + ', '.join(x.name.split('|')[-1] for x in src))
    a.name = ours; want.append(a)
for ours, (first, last) in (job.get('splits') or {}).items():
    base = max(src, key=lambda x: len(curves(x))); a = base.copy(); a.name = ours   # (the armature's take, not a helper's)
    for fc in curves(a):
        pts = [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right), k.interpolation) for k in fc.keyframe_points if first - 0.5 <= k.co[0] <= last + 0.5]
        fc.keyframe_points.clear(); fc.keyframe_points.add(len(pts))
        for k, (co, hl, hr, i) in zip(fc.keyframe_points, pts):
            k.co = (co[0] - first, co[1]); k.handle_left = (hl[0] - first, hl[1]); k.handle_right = (hr[0] - first, hr[1]); k.interpolation = i
        fc.update()
    a.frame_range = (0, last - first); want.append(a)
# in place: the root bone's steady travel taken out of the clips that walk or lunge (the game moves its creatures itself;
# root motion would slide the body ahead and snap it back each loop), keeping the bob and sway
ip = job.get('inPlace')
for a in want:
    if not ip or a.name not in ip['clips']: continue
    for fc in curves(a):
        if fc.data_path != f'pose.bones["{ip["bone"]}"].location' or fc.array_index not in ip['axes'] or len(fc.keyframe_points) < 2: continue
        k0, k1 = fc.keyframe_points[0], fc.keyframe_points[-1]; f0, span, drift = k0.co[0], max(1e-6, k1.co[0] - k0.co[0]), k1.co[1] - k0.co[1]
        for k in fc.keyframe_points:
            for p in ('co', 'handle_left', 'handle_right'): v = getattr(k, p); setattr(k, p, (v[0], v[1] - drift * (v[0] - f0) / span))
        fc.update()
for a in src:
    if a not in want: bpy.data.actions.remove(a)
for a in want: a.use_fake_user = True
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm and arm.animation_data: arm.animation_data.action = None

bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_frame_step=job.get('frameStep', 1), export_skins=True, export_morph=False,
    export_image_format='AUTO', export_vertex_color='ACTIVE' if job.get('bakeColors') else 'MATERIAL', export_cameras=False, export_lights=False, export_yup=True, export_apply=False)
print('CONVERTED', job['out'], 'clips', [a.name for a in want])
