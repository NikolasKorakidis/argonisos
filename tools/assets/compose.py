# One model put together from the pack's pieces, for entries with "compose" or "house" (run by convert.mjs):
#   blender -b --factory-startup -P compose.py -- job.json
# Every material slot keeps its own texture, named "tex:<key>" for the game to share (assets.js loadPack): the slots'
# textures come from the Unity prefabs (job.slots: FBX name → texture per slot, from the Ancient Empire catalogue), flat
# colours stay plain colours. A house is laid out from a recipe on the kit's 2.5 m grid (walls 3 m tall, the ridge along
# x): its door, windows, which walls have fallen and how much roof is left. Prints COMPOSED <out> <texture keys>.
import bpy, sys, json, os, math, random
from mathutils import Matrix, Vector

BAY, STOREY = 2.5, 3.0
KEYS = {'PolygonAncientEmpire_01_A': 'empire', 'Building_Marble_02': 'marble', 'Statue_01': 'statue'}

def key_of(path): return KEYS.get(os.path.splitext(os.path.basename(path))[0]) or os.path.splitext(os.path.basename(path))[0].lower()

class Composer:
    def __init__(self, job): self.job, self.mats, self.used, self.objs, self.stucco = job, {}, {}, [], None
    def material(self, tex):
        if isinstance(tex, list):   # (a flat colour)
            name = 'col:' + ''.join('%02x' % round(min(1, max(0, c)) ** (1 / 2.2) * 255) for c in tex[:3])
            if name not in self.mats:
                m = bpy.data.materials.new(name); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (*tex[:3], 1); self.mats[name] = m
            return self.mats[name]
        k = key_of(tex); self.used[k] = tex
        if k not in self.mats:
            m = bpy.data.materials.new('tex:' + k); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Roughness'].default_value = 0.85; b.inputs['Metallic'].default_value = 0.0; self.mats[k] = m
        return self.mats[k]
    def part(self, src, at=(0, 0, 0), rot=0, scale=1, sx=1):
        """a pack model at `at` (metres, Blender axes), turned rot degrees about z (sx -1: mirrored in x)"""
        before = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=src)
        new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
        slots = self.job.get('slots', {}).get(os.path.basename(src))
        bpy.context.view_layer.update()
        M = Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(rot), 4, 'Z') @ Matrix.Diagonal((sx * scale, scale, scale, 1))
        for o in meshes:
            mw = M @ o.matrix_world; o.parent = None; o.matrix_world = mw
            for i, sl in enumerate(o.material_slots):
                tex = slots[min(i, len(slots) - 1)] if slots else self.job.get('fallback')
                if isinstance(tex, str) and self.stucco and os.path.basename(tex).startswith('Stucco_'): tex = os.path.join(os.path.dirname(tex), self.stucco)   # (one plaster all round)
                if tex: sl.material = self.material(tex)
        for o in new:
            if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
        self.objs += meshes; return meshes
    def finish(self, out):
        objs = [o for o in self.objs if o.name in bpy.data.objects]
        for o in objs:   # (mirrored parts: their faces turned back out)
            if o.matrix_world.determinant() < 0:
                bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); o.select_set(False)
                o.data.flip_normals()
        with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs): bpy.ops.object.join()
        o = objs[0]; o.name = self.job.get('name', 'model')
        if out:
            for x in [x for x in bpy.data.objects if x != o]: bpy.data.objects.remove(x, do_unlink=True)
            bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False, export_yup=True, export_apply=True, export_image_format='NONE')
        return o

def house(C, kit, r):
    """a house W × D bays: r = { w, d, door (front bay), windows [[side, bay]...], fallen [[side, bay]...] (a stump of
    stone instead), gone [[side, bay]...] (nothing), roof: 'full' | 'half' | 'none', plaster: 'white' | 'orange' | 'blue' | 'red' }
    sides: 0 front (y 0), 1 right (x W), 2 back (y D), 3 left (x 0); each runs anticlockwise round the house"""
    W, D = r['w'], r['d']; P = lambda n: os.path.join(kit, n + '.fbx')
    C.stucco = 'Stucco_%s_01.png' % r.get('plaster', 'White').capitalize()
    has = lambda key, s, i: [s, i] in r.get(key, [])
    for s, n in ((0, W), (1, D), (2, W), (3, D)):
        for i in range(n):
            # where bay i of side s starts, and which way it runs (the wall's own +x)
            at, rot = {0: ((i * BAY, 0, 0), 0), 1: ((W * BAY, i * BAY, 0), 90), 2: (((W - i) * BAY, D * BAY, 0), 180), 3: ((0, (D - i) * BAY, 0), 270)}[s]
            if has('gone', s, i): continue
            if has('fallen', s, i): piece = 'Base_Building/SM_Bld_Base_Wall_Half_01'
            elif s == 0 and i == r.get('door', -1): piece = r.get('doorPiece', 'SM_Bld_Wall_Door_04')
            elif has('windows', s, i): piece = 'SM_Bld_Wall_Window_06'
            else: piece = 'SM_Bld_Wall_01'
            C.part(P(piece), at, rot)
    for x, y in ((0, 0), (W, 0), (W, D), (0, D)): C.part(P('SM_Bld_Wall_End_01'), (x * BAY, y * BAY, 0), {(0, 0): 180, (1, 0): 270, (1, 1): 0, (0, 1): 90}[(x > 0, y > 0)])
    roof = r.get('roof', 'full')
    if roof == 'none': return
    upto = W if roof == 'full' else max(1, W // 2)   # (half: the roof still on over the first bays only)
    if D == 1:
        for i in range(upto): C.part(P('SM_Bld_Roof_Base_Peak_01'), (i * BAY, 0, STOREY))
        C.part(P('SM_Bld_Roof_Base_Peak_Side_01'), (0, 0, STOREY))
        if roof == 'full': C.part(P('SM_Bld_Roof_Base_Peak_Side_01'), (W * BAY, 0, STOREY))
    else:
        for j in range(D):   # (single slopes rising to the ridge down the middle from both eaves)
            front = j < D / 2
            for i in range(upto): C.part(P('SM_Bld_Roof_Base_Straight_01'), ((i * BAY, j * BAY, STOREY) if front else ((i + 1) * BAY, (j + 1) * BAY, STOREY)), 0 if front else 180)
            for x, rr in ((0, 0), (W, 1)):
                if rr and roof != 'full': continue
                C.part(P('SM_Bld_Roof_Base_Straight_Side_01'), ((x * BAY, j * BAY, STOREY) if front else (x * BAY, (j + 1) * BAY, STOREY)), 0 if front else 180, sx=1)

if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    C = Composer(job)
    if job.get('house'): house(C, job['kit'], job['house'])
    for p in job.get('compose', []): C.part(p['src'], p.get('at', (0, 0, 0)), p.get('rot', 0), p.get('scale', 1), p.get('sx', 1))
    C.finish(job['out'])
    print('COMPOSED', job['out'], json.dumps(C.used))
