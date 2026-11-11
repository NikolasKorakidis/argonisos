# A contact sheet of pack models, to choose between them by eye:
#   blender -b --factory-startup -P tools/assets/sheet.py -- out.png texture.png|- a.fbx b.fbx ...
# Each model is drawn in a grid cell, scaled to fit, all on one texture (most pack models share one atlas; "-" keeps their
# own material colours); its file name, size in metres and triangle count are printed (SHEET lines), in grid order.
import bpy, sys, math, mathutils

args = sys.argv[sys.argv.index('--') + 1:]; out, tex, files = args[0], args[1], args[2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
mat = None
if tex != '-':
    img = bpy.data.images.load(tex); mat = bpy.data.materials.new('sheet'); mat.use_nodes = True
    t = mat.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
    mat.node_tree.links.new(t.outputs['Color'], next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
cols = max(1, math.ceil(math.sqrt(len(files) * 1.6))); rows = math.ceil(len(files) / cols)
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    try: bpy.ops.import_scene.fbx(filepath=f)
    except Exception as e: print('SHEET', i, f.split('/')[-1], 'FAILED', e); continue
    new = [o for o in bpy.data.objects if o not in before]; ms = [o for o in new if o.type == 'MESH']; bpy.context.view_layer.update()
    if not ms: print('SHEET', i, f.split('/')[-1], 'no mesh'); continue
    pts = [o.matrix_world @ mathutils.Vector(c) for o in ms for c in o.bound_box]
    lo = mathutils.Vector([min(p[k] for p in pts) for k in range(3)]); hi = mathutils.Vector([max(p[k] for p in pts) for k in range(3)]); size = hi - lo
    print('SHEET', i, f.split('/')[-1], 'size', [round(v, 2) for v in size], 'tris', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in ms))
    root = bpy.data.objects.new('r', None); bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    if mat:
        for o in ms:
            if not o.material_slots: o.data.materials.append(mat)
            for sl in o.material_slots: sl.material = mat
    s = 1.7 / max(max(size), 1e-6); c = (lo + hi) / 2
    root.scale = (s, s, s); root.location = ((i % cols) * 2 - c.x * s, 0 - c.y * s, -(i // cols) * 2 - c.z * s)
sc = bpy.context.scene; cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(cols, rows * 1.0) * 2.6 + 1
mid = mathutils.Vector(((cols - 1), 0, -(rows - 1))); cam.location = mid + mathutils.Vector((-6, -14, 7)); cam.rotation_euler = (mid - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'TEXTURE' if mat else 'MATERIAL'; sc.display.shading.light = 'STUDIO'
sc.render.resolution_x = 220 * cols; sc.render.resolution_y = 220 * rows; sc.render.filepath = out; bpy.ops.render.render(write_still=True)
print('SHEET done', out, cols, 'x', rows)
