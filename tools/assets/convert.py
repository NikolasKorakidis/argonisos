# Converts one model from the team's Unity packs into a .glb the game loads (run by tools/assets/convert.mjs inside
# Blender: blender -b --factory-startup -P convert.py -- job.json). The job says which FBX, which texture its material
# uses (found through Unity's guids by convert.mjs), which animations to keep and what the game calls them: either
# actions already in the file (by the name after the last "|"), or ranges of frames cut from one long take (Unity keeps
# those split points in the model's .meta file). Everything else is dropped, so the game downloads only what it plays.
import bpy, sys, json

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
if job['src'].endswith('.glb'): bpy.ops.import_scene.gltf(filepath=job['src'])   # (a plant: the catalogue's export, see below)
else: bpy.ops.import_scene.fbx(filepath=job['src'], use_anim=True, ignore_leaf_bones=True, automatic_bone_orientation=False)
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
    if o.type == 'MESH' and not job.get('plant'):
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

# A plant (trees, shrubs, flowers, the forest floor) comes from the catalogue's export (everything.py), where each material
# already has the pack texture Unity gives it ("tex:<key>", in pack/tex/). Each face takes its texture's colours into its
# corners like the rest, unless it shows a see-through part of the texture (a leaf card, a frond, a reed's tuft painted
# on a plane): those keep their texture and UVs, on a material named for it that the game draws cut out, with the wind.
if job.get('plant'):
    import numpy as np, re, os
    tint = np.array(job.get('tint', [1, 1, 1]) + [1], np.float32); pix, cards = {}, {}
    def image(key):
        if key not in pix:
            f = os.path.join(job['plant'], key + '.webp'); im = bpy.data.images.load(f) if os.path.exists(f) else None
            if im: W, H = im.size; px = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(px); pix[key] = px.reshape(H, W, 4)
            else: pix[key] = None
        return pix[key]
    plain = bpy.data.materials.new('plant'); keyOf = {}
    for m in list(bpy.data.materials):   # (the imported ones out of the way of the cards' names)
        if m.name.startswith('tex:'): keyOf[m.name] = re.sub(r'\.\d{3}$', '', m.name)[4:]; m.name = 'src:' + m.name
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        me = o.data; uvl = me.uv_layers.active; n = len(me.loops)
        keys = [keyOf.get(s.material.name[4:]) if s.material else None for s in o.material_slots]
        uv = np.zeros(n * 2, np.float32)
        if uvl: uvl.data.foreach_get('uv', uv)
        uv = uv.reshape(n, 2); col = np.ones((n, 4), np.float32); slot = []
        for p in me.polygons:
            key = keys[p.material_index] if p.material_index < len(keys) else None; px = image(key) if key else None
            if px is None: slot.append(None); continue
            H, W = px.shape[:2]; li = list(p.loop_indices); u = uv[li]; c = u.mean(0)
            pts = np.vstack([u, c, (u + c) / 2]) % 1.0   # (its corners, its middle and halfway between: a card's corners can sit on leaf)
            a = px[np.minimum((pts[:, 1] * H).astype(int), H - 1), np.minimum((pts[:, 0] * W).astype(int), W - 1), 3]
            if a.min() < 0.5: slot.append(key); continue
            q = u % 1.0; col[li] = px[np.minimum((q[:, 1] * H).astype(int), H - 1), np.minimum((q[:, 0] * W).astype(int), W - 1)] * tint; col[li, 3] = 1; slot.append(None)
        mats = [plain] + sorted({k for k in slot if k})
        me.materials.clear()
        for m in mats: me.materials.append(m if m is plain else cards.setdefault(m, bpy.data.materials.new('tex:' + m)))
        me.polygons.foreach_set('material_index', [0 if k is None else mats.index(k) for k in slot])
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); ca.data.foreach_set('color_srgb', col.ravel())
        me.color_attributes.active_color = ca; me.color_attributes.render_color_index = me.color_attributes.find('Col')
    # The game draws a model's cards with one texture: a model whose cards use several (Synty's trees: branches and
    # leaves) gets them side by side in one atlas of their own (pack/tex/atlas-<hash>.png, made WebP by convert.mjs),
    # each card's UVs moved into its texture's tile
    ms = [o for o in bpy.data.objects if o.type == 'MESH']; ck = sorted(cards)
    if len(ck) > 1:
        import hashlib
        T = max(max(pix[k].shape[:2]) for k in ck); N = len(ck); A = np.zeros((T, T * N, 4), np.float32)
        for i, k in enumerate(ck):
            H, W = pix[k].shape[:2]; A[:, i * T:(i + 1) * T] = pix[k][(np.arange(T) * H // T)][:, (np.arange(T) * W // T)]
        akey = 'atlas-' + hashlib.md5('+'.join(ck).encode()).hexdigest()[:10]
        im = bpy.data.images.new(akey, T * N, T, alpha=True); im.pixels.foreach_set(A.ravel())
        im.filepath_raw = os.path.join(job['plant'], akey + '.png'); im.file_format = 'PNG'; im.save(); print('ATLAS', akey, im.filepath_raw)
        amat = bpy.data.materials.new('tex:' + akey)
        for o in ms:
            me = o.data; names = [s.material.name if s.material else '' for s in o.material_slots]; uvl = me.uv_layers.active; n = len(me.loops)
            uv = np.zeros(n * 2, np.float32); uvl.data.foreach_get('uv', uv); uv = uv.reshape(n, 2); idx = []
            for p in me.polygons:
                nm = names[p.material_index]
                if nm.startswith('tex:') and nm[4:] in ck:
                    li = list(p.loop_indices); u = uv[li]; u = np.clip(u - np.floor(u.mean(0)), 0, 1); u[:, 0] = (u[:, 0] + ck.index(nm[4:])) / N; uv[li] = u; idx.append(1)
                else: idx.append(0)
            uvl.data.foreach_set('uv', uv.ravel()); me.materials.clear(); me.materials.append(plain); me.materials.append(amat); me.polygons.foreach_set('material_index', idx)
        cards = {akey: amat}
    # A far version (the game's mid band, out to 260 m, draws hundreds): brought down to about `decimate` triangles. Cards
    # are thinned (whole leaf patches dropped, the rest grown so the crown stays as full), the solid parts collapsed.
    if job.get('decimate'):
        import bmesh
        from mathutils import Vector
        card = lambda o, f: o.material_slots[f.material_index].material.name.startswith('tex:')
        S = sum(len(p.vertices) - 2 for o in ms for p in o.data.polygons if not card(o, p)); C = sum(len(p.vertices) - 2 for o in ms for p in o.data.polygons if card(o, p))
        T = job['decimate']; fc = min(1, max(job.get('cardMin', 0.2), job.get('cardShare', 0.6) * T / C)) if C else 1; fs = min(1, max(0.08, (T - C * fc) / max(S, 1)))
        if job.get('solidMin') and fs < job['solidMin']:   # (close by, a jagged trunk shows more than a thinner crown: the leaves give way)
            fs = job['solidMin']; fc = min(fc, max(job.get('cardMin', 0.2), (T - S * fs) / max(C, 1)))
        for o in ms:   # (each mesh split into one per material first, so the collapse only meets solid faces)
            with bpy.context.temp_override(active_object=o, object=o, selected_objects=[o], selected_editable_objects=[o]):
                bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
        ms = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons)]
        for o in ms:
            bm = bmesh.new(); bm.from_mesh(o.data); seen, isles, drop = set(), [], []
            for f in bm.faces:
                if f in seen or not card(o, f): continue
                isl, todo = [], [f]; seen.add(f)
                while todo:
                    g = todo.pop(); isl.append(g)
                    for e in g.edges:
                        for h in e.link_faces:
                            if h not in seen and card(o, h): seen.add(h); todo.append(h)
                isles.append(isl)
            for k, isl in enumerate(isles):   # (every so many patches, evenly through the crown: the golden ratio's steps)
                if ((k + 1) * 0.6180339) % 1 >= fc: drop += isl; continue
                vs = {v for g in isl for v in g.verts}; c = sum((v.co for v in vs), Vector()) / len(vs); s = min(1.6, fc ** -0.5)
                for v in vs: v.co = c + (v.co - c) * s
            if drop: bmesh.ops.delete(bm, geom=drop, context='FACES')
            bm.to_mesh(o.data); bm.free()
            if fs < 1 and o.data.polygons and not card(o, o.data.polygons[0]):
                m = o.modifiers.new('far', 'DECIMATE'); m.ratio = fs
                with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_apply(modifier='far')
        o_tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons); print('DECIMATED', S + C, '->', o_tris, 'cards kept', round(fc, 2), 'solid', round(fs, 2))
    if job.get('height'):   # (brought to a height in metres: a pack's bush can be knee-high where the game wants a shrub)
        from mathutils import Matrix, Vector
        bpy.context.view_layer.update(); ms = [o for o in bpy.data.objects if o.type == 'MESH']
        lo = min((o.matrix_world @ Vector(c)).z for o in ms for c in o.bound_box); hi = max((o.matrix_world @ Vector(c)).z for o in ms for c in o.bound_box)
        for o in bpy.data.objects:
            if not o.parent: o.matrix_world = Matrix.Scale(job['height'] / (hi - lo), 4) @ o.matrix_world
    print('PLANT cards', sorted(cards))

# one mesh for the whole body (the Infinity PBR characters come in a hundred pieces: a draw call each in the game)
if job.get('join'):
    parts = [o for o in bpy.data.objects if o.type == 'MESH']
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts): bpy.ops.object.join()
    parts[0].name = job.get('name', 'Body')
    if not job.get('plant'):   # (a plant keeps its cards' materials)
        parts[0].data.materials.clear(); parts[0].data.materials.append(mat)
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
    export_image_format='AUTO', export_vertex_color='ACTIVE' if job.get('bakeColors') or job.get('plant') else 'MATERIAL', export_cameras=False, export_lights=False, export_yup=True, export_apply=False)
print('CONVERTED', job['out'], 'clips', [a.name for a in want])
