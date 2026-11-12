# Every model of one pack laid out in a Blender file, labelled, to see what the team's packs hold:
#   blender -b --factory-startup -P tools/assets/library.py -- index.json "Synty/PolygonVikings" out.blend
# index.json comes from library-index.mjs (each material's texture). The pack's folders become collections, laid out one
# after another along +y, each model on the ground at its own size with its file name in front of it. Animation takes
# (Model@Clip.fbx), finer LODs and lights are left out; a file holding several models in one place (Synty's
# Characters.fbx) is spread out, each labelled with its own name. Each folder runs from its smallest model to its largest.
# Prints LIBRARY <models> <depth in metres>.
import bpy, sys, os, glob, json, re
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]; idx = json.load(open(args[0])); key, out = args[1], args[2]
root = os.path.join(idx['pack'], key); mats = {k.lower(): v for k, v in idx['mats'].get(key, {}).items()}; default = idx['defaults'].get(key)
bpy.ops.wm.read_factory_settings(use_empty=True)
files = sorted(f for f in glob.glob(os.path.join(root, '**', '*'), recursive=True)
               if f.lower().endswith('.fbx') and '@' not in os.path.basename(f) and '/Animations/' not in f)
ROW = 60.0; GAP = 1.2

shared = {}
def material(tex):   # one material per texture, shared by everything painted with it
    if tex not in shared:
        m = bpy.data.materials.new(os.path.basename(tex)); m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Roughness'].default_value = 0.9
        try:
            t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex, check_existing=True); t.interpolation = 'Closest'
            m.node_tree.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        except Exception as e: print('no texture', tex, e)
        shared[tex] = m
    return shared[tex]
def retexture(o):
    for sl in o.material_slots:
        name = re.sub(r'\.\d{3}$', '', sl.material.name if sl.material else '').lower()
        tex = mats.get(name) or default
        if tex: sl.material = material(tex)
def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])
def label(text, x, y, size, coll):
    t = bpy.data.objects.new(text, bpy.data.curves.new(text, 'FONT')); t.data.body = text; t.data.size = size; t.data.align_x = 'LEFT'
    t.location = (x, y, 0); coll.objects.link(t)

top = bpy.data.collections.new(key.split('/')[-1]); bpy.context.scene.collection.children.link(top)
label(key, 0, -4, 3.0, top)
y0 = 0.0; count = 0; folders = {}
for f in files: folders.setdefault(os.path.relpath(os.path.dirname(f), root), []).append(f)
for folder, fs in folders.items():
    coll = bpy.data.collections.new(folder if folder != '.' else key.split('/')[-1]); top.children.link(coll)
    label(folder, 0, y0, 1.2, coll); y0 += 2.5
    x = 0.0; rowDepth = 0.0
    def place(objs, name):   # put a model (its top objects) next in the row, its label in front of it
        global x, y0, rowDepth, count
        lo, hi = bounds([o for o in objs if o.type == 'MESH']); size = hi - lo
        if x > 0 and x + size.x > max(ROW, 6 * size.x): y0 += rowDepth + GAP + 0.6; x = 0.0; rowDepth = 0.0   # (giants share a wider row)
        d = Vector((x - lo.x, y0 + 0.6 - lo.y, -lo.z))
        for o in objs:
            if o.parent is None or o.parent not in objs: o.matrix_world = Matrix.Translation(d) @ o.matrix_world
        label(name, x, y0, min(max(size.x * 0.12, 0.08), 0.5), coll)
        x += max(size.x, 0.3) + GAP; rowDepth = max(rowDepth, size.y); count += 1
    items = []
    for f in fs:
        before = set(bpy.data.objects)
        try: bpy.ops.import_scene.fbx(filepath=f, ignore_leaf_bones=True)
        except Exception as e: print('FAILED', f, e); continue
        new = [o for o in bpy.data.objects if o not in before]
        for o in [o for o in new if o.type in ('LIGHT', 'CAMERA') or re.search(r'_LOD[1-9]', o.name)]: new.remove(o); bpy.data.objects.remove(o, do_unlink=True)
        meshes = [o for o in new if o.type == 'MESH']
        if not meshes:
            for o in new: bpy.data.objects.remove(o, do_unlink=True)
            continue
        for o in new:
            for c in o.users_collection: c.objects.unlink(o)
            coll.objects.link(o); o.animation_data_clear()
            if o.type == 'ARMATURE': o.data.pose_position = 'REST'
            if o.type == 'MESH': retexture(o)
        bpy.context.view_layer.update()
        lo, hi = bounds(meshes)
        if max(hi - lo) > 500:   # (a file whose centimetres came in as metres)
            for o in new:
                if o.parent is None: o.matrix_world = Matrix.Scale(0.01, 4) @ o.matrix_world
            bpy.context.view_layer.update(); lo, hi = bounds(meshes)
        sizes = [bounds([m])[1] - bounds([m])[0] for m in meshes]; size = hi - lo
        if len(meshes) >= 4 and size.x < 1.6 * max(s.x for s in sizes) and size.y < 1.6 * max(s.y for s in sizes):
            items += [([m], m.name, max(s)) for m, s in zip(meshes, sizes)]   # (several models stacked in one place: each on its own)
        else: items.append((new, os.path.splitext(os.path.basename(f))[0], max(size)))
    for objs, name, _ in sorted(items, key=lambda it: it[2]): place(objs, name)   # (small to large: skydomes and mountains share the last rows)
    y0 += rowDepth + 4
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=out)
print('LIBRARY', count, round(y0, 1))
