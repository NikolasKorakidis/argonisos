# Every model in the team's packs in one Blender file, sorted by kind (the catalogue everything.mjs writes):
#   blender -b --factory-startup -P tools/assets/catalogue.py -- assets/models/pack/all out.blend
# Two ways to look through them. In the Outliner a collection per kind holds one per group (Plants → Bushes & shrubs),
# laid out on the ground one after another along +y, each with its label, small to large. And each model is an asset in
# Blender's Asset Browser, in the catalogue "Kind/Group", tagged with its pack (and "in game" if the game uses it), so
# it can be searched, filtered and dragged into any scene. The models come from the exported .glb files with the pack
# textures put back on (pack/tex/<key>.webp). Prints CATALOGUE <models>.
import bpy, sys, os, json, re, uuid
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]; ALL, out = args[0], args[1]
TEX = os.path.join(os.path.dirname(ALL), 'tex')
cat = json.load(open(os.path.join(ALL, 'catalogue.json')))
bpy.ops.wm.read_factory_settings(use_empty=True)
ROW, GAP = 40.0, 1.0

mats = {}
def material(key):   # one material per pack texture, shared by everything painted with it
    if key not in mats:
        m = bpy.data.materials.new('tex:' + key); m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Roughness'].default_value = 0.85
        f = os.path.join(TEX, key + '.webp')
        if os.path.exists(f):
            t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(f, check_existing=True); t.interpolation = 'Closest'
            m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
            if key in cat.get('cutout', {}): m.node_tree.links.new(t.outputs['Alpha'], b.inputs['Alpha'])   # (leaves: clear where the texture is)
        mats[key] = m
    return mats[key]
def label(text, x, y, size, coll):
    t = bpy.data.objects.new('label: ' + text, bpy.data.curves.new(text, 'FONT')); t.data.body = text; t.data.size = size
    t.location = (x, y, 0); coll.objects.link(t); t.hide_select = True

# the Asset Browser's catalogues: one per kind and per group, written beside the .blend
cats, lines = {}, ['VERSION 1', '']
for kind, groups in cat['kinds'].items():
    for path in [kind] + [kind + '/' + g for g in groups]:
        cats[path] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'argonisos/' + path)); lines.append('%s:%s:%s' % (cats[path], path, path.replace('/', '-')))
open(os.path.join(os.path.dirname(os.path.abspath(out)), 'blender_assets.cats.txt'), 'w').write('\n'.join(lines) + '\n')

y0, count = 0.0, 0
for kind, groups in cat['kinds'].items():
    items = [i for i in cat['items'] if i['kind'] == kind]
    if not items: continue
    top = bpy.data.collections.new(kind); bpy.context.scene.collection.children.link(top)
    label(kind, 0, y0, 6.0, top); y0 += 9
    for group in groups:
        mine = sorted((i for i in items if i['sub'] == group), key=lambda i: max(i['size']))
        if not mine: continue
        coll = bpy.data.collections.new('%s · %s' % (kind, group)); top.children.link(coll)
        label('%s  (%d)' % (group, len(mine)), 0, y0, 2.0, coll); y0 += 3.5
        x, depth = 0.0, 0.0
        for it in mine:
            before = set(bpy.data.objects)
            try: bpy.ops.import_scene.gltf(filepath=os.path.join(ALL, it['id'] + '.glb'))
            except Exception as e: print('FAILED', it['id'], e); continue
            new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
            if not meshes:
                for o in new: bpy.data.objects.remove(o, do_unlink=True)
                continue
            # one object per model, named for it, with the pack's textures back on
            extra = [e for e in new if e.type != 'MESH']
            if len(meshes) > 1:
                with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes): bpy.ops.object.join()
            o = meshes[0]
            for e in extra: bpy.data.objects.remove(e, do_unlink=True)   # (the empties the importer adds; the joined meshes are gone already)
            o.name = it['name']; mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
            for sl in o.material_slots:
                k = re.sub(r'\.\d{3}$', '', sl.material.name if sl.material else '')
                if k.startswith('tex:'): sl.material = material(k[4:])
            for c in o.users_collection: c.objects.unlink(o)
            coll.objects.link(o)
            # next in the row (giants share a wider one), its label in front of it
            bpy.context.view_layer.update(); pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
            lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)]); size = hi - lo
            if x > 0 and x + size.x > max(ROW, 6 * size.x): y0 += depth + GAP + 0.6; x, depth = 0.0, 0.0
            o.matrix_world = Matrix.Translation(Vector((x - lo.x, y0 + 0.6 - lo.y, -lo.z))) @ o.matrix_world
            label(it['name'], x, y0, min(max(size.x * 0.12, 0.08), 0.5), coll)
            x += max(size.x, 0.3) + GAP; depth = max(depth, size.y); count += 1
            # and an asset, in its kind's and group's catalogue
            o.asset_mark(); o.asset_data.catalog_id = cats[kind + '/' + group]
            o.asset_data.description = '%s · %s · %s' % (it['pack'], it['file'], it['id'])
            for tag in [it['pack'].split('/')[-1]] + (['in game'] if it.get('inGame') else []): o.asset_data.tags.new(tag, skip_if_exists=True)
            if count % 200 == 0: bpy.data.orphans_purge(do_recursive=True); print('PROGRESS', count, flush=True)
        y0 += depth + 5
    y0 += 12
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=out)
print('CATALOGUE', count)
