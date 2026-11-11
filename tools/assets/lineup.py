# Every converted pack model in one Blender file, laid out by kind, for looking over and touching up by hand:
#   blender -b --factory-startup -P tools/assets/lineup.py -- out.blend
# Rows: characters and creatures, flora, building kit, tools and weapons, pickups and site props. Each model stands on
# the ground at true size (metres, as the game sizes it is up to the game), labelled with its file name; the shared
# atlases (materials named tex:<key>) get their image from pack/tex. The hero's armour pieces (wear_<item>) start hidden. Changes made here don't flow back by themselves:
# the game loads assets/models/pack/*.glb, which convert.mjs writes from the pack.
import bpy, sys, os, glob
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); PACK = os.path.join(ROOT, 'assets/models/pack')
bpy.ops.wm.read_factory_settings(use_empty=True)
ROWS = [('creatures', lambda n: n in ('hero', 'dryad', 'giant', 'dryadling', 'chimera', 'minotaur', 'skeleton', 'owl', 'doe', 'stag', 'fox', 'hare', 'boar')),
        ('flora', lambda n: n.startswith('fl_')), ('kit', lambda n: n.startswith('k') and n[1].isupper()),
        ('props', lambda n: n[0] in 'ps' and n[1].isupper()), ('held', lambda n: True)]
images = {}
def atlas(key):
    if key not in images: images[key] = bpy.data.images.load(os.path.join(PACK, 'tex', key + '.webp'))
    return images[key]
files = sorted(glob.glob(os.path.join(PACK, '*.glb'))); done = set(); z = 0
for row, test in ROWS:
    names = [f for f in files if f not in done and test(os.path.basename(f)[:-4])]; x = 0; deep = 0
    coll = bpy.data.collections.new(row); bpy.context.scene.collection.children.link(coll)
    for f in names:
        done.add(f); before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=f)
        new = [o for o in bpy.data.objects if o not in before and not any(c.name.startswith('glTF_not_exported') for c in o.users_collection)]   # (not the bone shapes)
        for o in new:
            o.animation_data_clear()   # (a clip would hold the root where it was made: they stand at rest)
            if o.name.startswith('wear_'): o.hide_set(True); o.hide_render = True   # (the hero's armour pieces: shown one by one)
            for c in o.users_collection: c.objects.unlink(o)
            coll.objects.link(o)
            for sl in (o.material_slots if o.type == 'MESH' else []):
                m = sl.material
                if m and m.name.startswith('tex:') and m.use_nodes:
                    nt = m.node_tree; bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                    if bsdf and not bsdf.inputs['Base Color'].is_linked:
                        t = nt.nodes.new('ShaderNodeTexImage'); t.image = atlas(m.name[4:].split('.')[0]); t.interpolation = 'Closest'; nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        bpy.context.view_layer.update()
        meshes = [o for o in new if o.type == 'MESH']
        if not meshes: continue
        top = [o for o in new if o.parent is None]
        box = lambda: [Vector([f(p[i] for p in pts) for i in range(3)]) for f in (min, max) for pts in [[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]]]
        lo, hi = box()
        if max(hi - lo) > 30:   # (the rigs fitted in three.js keep the Mixamo rig's centimetres: the game sizes them itself)
            for o in top: o.scale *= 0.01
            bpy.context.view_layer.update(); lo, hi = box()
        size = hi - lo
        for o in top: o.location += Vector((x - lo.x, z - lo.y, -lo.z))
        label = bpy.data.objects.new(os.path.basename(f)[:-4], bpy.data.curves.new('label', 'FONT')); label.data.body = label.name; label.data.size = 0.3
        label.location = (x, z - 0.6, 0); coll.objects.link(label)
        x += max(size.x, 1.0) + 0.8; deep = max(deep, size.y)
    z += deep + 3
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.ops.wm.save_as_mainfile(filepath=out)
print('LINEUP', out, len(done), 'models')
