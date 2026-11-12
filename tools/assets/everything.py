# Every model of one pack exported on its own, for the asset browser (dev/) and for whatever the game takes up later:
#   blender -b --factory-startup -P tools/assets/everything.py -- index.json "Synty/PolygonVikings" out-dir records.json
# index.json comes from library-index.mjs (each material's texture). Each model keeps its own pivot and comes out as
# <out-dir>/<name>.glb, its materials named "tex:<key>" for the game's loadPack (the image itself is converted once by
# everything.mjs); a file holding several models in one place (Synty's Characters.fbx) gives one .glb per model, as
# library.py lays them out. Collision meshes, finer LODs, animation takes, lights and cameras are left out; a rigged body
# comes out in its rest pose, unrigged. records.json: one record per model (its size, triangles and textures).
import bpy, sys, os, glob, json, re
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]; idx = json.load(open(args[0])); key, outdir, rec_path = args[1], args[2], args[3]
root = os.path.join(idx['pack'], key); mats = {k.lower(): v for k, v in idx['mats'].get(key, {}).items()}; default = idx['defaults'].get(key)
SKIP = re.compile(r'(^|/)(collision|colliders|[a-z_]*_col|lods?|animations?)(/|$)', re.I)
files = sorted(f for f in glob.glob(os.path.join(root, '**', '*'), recursive=True)
               if f.lower().endswith('.fbx') and '@' not in os.path.basename(f) and not SKIP.search(os.path.relpath(os.path.dirname(f), root).replace(os.sep, '/')))
# (for convert.mjs: ONLY, a few files of the pack, one per line; KEEP_LOD, the level of detail kept instead of the finest,
# or the lightest real one it has short of that: a plant's lighter versions for the game's near and mid bands)
ONLY = set(filter(None, os.environ.get('ONLY', '').split('\n'))); KEEP_LOD = os.environ.get('KEEP_LOD')
if ONLY: files = [f for f in files if os.path.relpath(f, idx['pack']) in ONLY]
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
packslug = slug(re.sub(r'^Synty/(PolygonNatureBiomes/)?', '', key))
os.makedirs(outdir, exist_ok=True)

shared, textures = {}, {}
def material(tex):   # one material per texture, named for the game's atlas lookup
    k = packslug + '-' + slug(os.path.splitext(os.path.basename(tex))[0]); textures[k] = tex
    if k not in shared:
        m = bpy.data.materials.new('tex:' + k); m.use_nodes = True; m.use_fake_user = True   # (kept through the purges between files)
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 0.85; b.inputs['Metallic'].default_value = 0.0
        shared[k] = m
    return shared[k], k
def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

# Synty's foliage material: one slot painted from a leaf texture and a bark texture, the vertex colours' blue marking
# the leaves. Here the slot's faces are shared out between two materials of their own.
def split(o, i, tex, keys):
    me = o.data; ca = me.color_attributes[0] if me.color_attributes else None
    trunk, kt = material(tex['trunk']); me.materials[i] = trunk; keys.add(kt)
    if tex['leaf'] == tex['trunk'] or not ca: return
    leaf, kl = material(tex['leaf']); me.materials.append(leaf); keys.add(kl); j = len(me.materials) - 1
    blue = (lambda p: sum(ca.data[l].color[2] for l in p.loop_indices) / len(p.loop_indices)) if ca.domain == 'CORNER' else (lambda p: sum(ca.data[v].color[2] for v in p.vertices) / len(p.vertices))
    for p in me.polygons:
        if p.material_index == i and blue(p) > 0.5: p.material_index = j

records, names = [], set()
def export(meshes, name, f):
    base = slug(name) or 'model'; n = base; i = 2
    while n in names: n = '%s-%d' % (base, i); i += 1
    names.add(n); keys = set(); prefab = idx['slots'].get(os.path.relpath(f, idx['pack']), {})
    for o in meshes:
        # the materials the model's prefab gives this object (the FBX's own are lambert2 and the like), else by name
        given = prefab.get(re.sub(r'\.\d{3}$', '', o.name)) or []
        for i, sl in enumerate(list(o.material_slots)):
            nm = re.sub(r'\.\d{3}$', '', sl.material.name if sl.material else '').lower()
            tex = (given[i] if i < len(given) else None) or mats.get(nm) or default
            if isinstance(tex, dict): split(o, i, tex, keys); continue
            if tex: sl.material, k = material(tex); keys.add(k)
        for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)   # (Unity's wind and leaf masks, not colours)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    out = os.path.join(outdir, n + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=False,
                              export_morph=False, export_cameras=False, export_lights=False, export_yup=True, export_image_format='NONE')
    lo, hi = bounds(meshes); tris = 0
    for o in meshes: o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    records.append({ 'pack': key, 'file': os.path.relpath(f, idx['pack']), 'name': name, 'glb': n, 'tris': tris, 'tex': sorted(keys),
                     'size': [round(hi.x - lo.x, 3), round(hi.z - lo.z, 3), round(hi.y - lo.y, 3)],   # (x, up, depth: as the game sees it)
                     'rigged': any(m.find_armature() for m in meshes) })

for i, f in enumerate(files):
    before = set(bpy.data.objects); print('FILE', f, flush=True)   # (the last one named is the culprit if Blender falls over)
    try: bpy.ops.import_scene.fbx(filepath=f, ignore_leaf_bones=True)
    except Exception as e: print('FAILED', f, e); continue
    new = [o for o in bpy.data.objects if o not in before]
    lod = lambda o: int(re.search(r'_LOD(\d)', o.name).group(1)) if re.search(r'_LOD(\d)', o.name) else None
    keep = 0
    if KEEP_LOD:   # (the cards Synty ends on, a dozen triangles, don't count as a level)
        tris = {}
        for o in new:
            if o.type == 'MESH' and lod(o) is not None: o.data.calc_loop_triangles(); tris[lod(o)] = tris.get(lod(o), 0) + len(o.data.loop_triangles)
        keep = max([l for l, t in tris.items() if t > 60 and l <= int(KEEP_LOD)] or [0])
    for o in [o for o in new if o.type in ('LIGHT', 'CAMERA') or (o.type == 'MESH' and lod(o) is not None and lod(o) != keep) or re.search(r'_COL(\.\d+)?$|^UCX_', o.name)]: new.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in new if o.type == 'MESH' and len(o.data.polygons)]
    for o in new:
        o.animation_data_clear()
        if o.type == 'ARMATURE': o.data.pose_position = 'REST'
    if meshes:
        bpy.context.view_layer.update(); lo, hi = bounds(meshes)
        if max(hi - lo) > 500:   # (a file whose centimetres came in as metres)
            for o in new:
                if o.parent is None: o.matrix_world = Matrix.Scale(0.01, 4) @ o.matrix_world
            bpy.context.view_layer.update(); lo, hi = bounds(meshes)
        sizes = [bounds([m])[1] - bounds([m])[0] for m in meshes]; size = hi - lo
        try:
            if len(meshes) >= 4 and size.x < 1.6 * max(s.x for s in sizes) and size.y < 1.6 * max(s.y for s in sizes) and 'Magic Pig' not in key:   # (the monsters' parts stay one body)
                for m in meshes: export([m], m.name, f)   # (several models stacked in one place: each on its own)
            else: export(meshes, os.path.splitext(os.path.basename(f))[0], f)
        except Exception as e: print('FAILED', f, e)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    if i % 25 == 24: bpy.data.orphans_purge(do_recursive=True)
    if i % 100 == 99: print('PROGRESS', key, i + 1, len(files), flush=True)

json.dump({ 'pack': key, 'slug': packslug, 'records': records, 'textures': textures }, open(rec_path, 'w'))
print('EVERYTHING', key, len(records))
