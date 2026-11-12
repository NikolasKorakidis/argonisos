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

def readable(t):
    """a texture the WebP encoder can read: a Targa handed on as a PNG of the same name (convert.mjs encodes what's used)"""
    if not isinstance(t, str) or not t.lower().endswith('.tga'): return t
    import tempfile
    png = os.path.join(tempfile.gettempdir(), os.path.basename(t)[:-4] + '.png')
    if not os.path.exists(png): img = bpy.data.images.load(t); img.pixels[0]; img.save_render(filepath=png); bpy.data.images.remove(img)
    return png

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
    def place(self, src, m, tex=None):
        """a pack model placed by a whole 4 × 4 matrix (Blender axes, rows; scenes from Unity: tools put them in these
        terms), each model read once and copied after that; tex: textures per slot instead of the prefab's (paths inside
        the Ancient Empire folder, or flat colours), as the scene gave that one copy"""
        self.cache = getattr(self, 'cache', {})
        if src not in self.cache:
            before = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=src); bpy.context.view_layer.update()
            new = [o for o in bpy.data.objects if o not in before]; self.cache[src] = [(o.data, o.matrix_world.copy()) for o in new if o.type == 'MESH']
            for d, _ in self.cache[src]:   # (one UV set, no vertex colours: the game reads neither, and one part that has them gives them to the whole model)
                while len(d.uv_layers) > 1: d.uv_layers.remove(d.uv_layers[-1])
                while len(d.color_attributes): d.color_attributes.remove(d.color_attributes[0])
            for o in new: bpy.data.objects.remove(o, do_unlink=True)
        root = os.path.dirname(self.job['kit']); slots = [os.path.join(root, t) if isinstance(t, str) else t for t in tex] if tex else self.job.get('slots', {}).get(os.path.basename(src))
        M, out = Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]), []
        for data, w0 in self.cache[src]:
            o = bpy.data.objects.new(os.path.basename(src), data.copy()); bpy.context.scene.collection.objects.link(o); o.matrix_world = M @ w0
            for i, sl in enumerate(o.material_slots):
                t = slots[min(i, len(slots) - 1)] if slots else self.job.get('fallback')
                if t: sl.material = self.material(readable(t))
            out.append(o)
        self.objs += out; return out
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

def scene(C, p):
    """an arrangement out of one of the pack's Unity scenes (src: the .unity file; p.scene: { groups: hierarchy paths to
    take, skip / only: prefab names (prefixes) to leave out / keep, box: [x0, x1, z0, z1] and ybox: [y0, y1] in the scene's
    metres, cut: [{ box, ybox, names }] parts to leave out, swap: { prefab: [another, scale] } a part put in another's
    place (its own textures, scaled about its foot), origin: the scene point that becomes the model's origin, yaw: degrees
    about the up axis, scale }). Unity is left-handed: its x is negated on the way in (its FBX import mirrors x,
    so the pieces come out as Blender reads them), the turns with it. Prints PLACED <parts>."""
    import re
    from mathutils import Quaternion
    o, src = p['scene'], p['src']
    empire = os.path.dirname(C.job['kit'])
    guid = {}   # (every Ancient Empire asset by its guid, from the .meta files beside them)
    for d, _, fs in os.walk(empire):
        for f in fs:
            if f.endswith('.meta'):
                m = re.search(r'^guid: (\w+)', open(os.path.join(d, f), encoding='utf8', errors='ignore').read(), re.M)
                if m: guid[m.group(1)] = os.path.join(d, f[:-5])
    fbx = {}
    for d in ('Models', 'Models/Base_Building'):
        for f in os.listdir(os.path.join(empire, d)):
            if f.endswith('.fbx'): fbx[f[:-4]] = os.path.join(empire, d, f)
    COL = re.compile(r'^_(BaseMap|MainTex|Main_Texture|Albedo(_Map)?|BaseColorMap|Base_Texture|Texture|Diffuse|Albedo_Texture|Color_Map)$', re.I)
    def mat_tex(g):   # a material's colour texture, or its flat colour
        f = guid.get(g)
        if not f or not f.endswith('.mat'): return None
        s = open(f, encoding='utf8').read()
        for m in re.finditer(r'- (_\w+):\n\s+m_Texture: \{fileID: \d+, guid: (\w+)', s):
            if COL.match(m.group(1)) and m.group(2) in guid: return guid[m.group(2)]
        c = re.search(r'_(?:Base)?Color: \{r: ([\d.]+), g: ([\d.]+), b: ([\d.]+)', s)
        return [float(v) for v in c.groups()] if c else None
    num = r'(-?[\d.eE+-]+)'
    def vec(body, key, n):
        m = re.search(key + r': \{x: ' + num + r', y: ' + num + r', z: ' + num + (r', w: ' + num if n == 4 else '') + r'\}', body)
        return [float(v) for v in m.groups()] if m else None
    GO, TR, PI, STR = {}, {}, {}, {}
    for d in re.split(r'^--- !u!', open(src, encoding='utf8').read(), flags=re.M)[1:]:
        head, body = d.split('\n', 1); m = re.match(r'(\d+) &(-?\d+)( stripped)?', head); cls, fid, stripped = int(m.group(1)), m.group(2), bool(m.group(3))
        if cls == 1 and not stripped: n = re.search(r'm_Name: (.*)', body); GO[fid] = n.group(1).strip() if n else ''
        elif cls == 4 and stripped: STR[fid] = re.search(r'm_PrefabInstance: \{fileID: (-?\d+)\}', body).group(1)
        elif cls in (4, 224) and not stripped:
            TR[fid] = dict(go=re.search(r'm_GameObject: \{fileID: (-?\d+)\}', body).group(1), p=vec(body, 'm_LocalPosition', 3), q=vec(body, 'm_LocalRotation', 4), s=vec(body, 'm_LocalScale', 3), father=re.search(r'm_Father: \{fileID: (-?\d+)\}', body).group(1))
        elif cls == 1001:
            par = re.search(r'm_TransformParent: \{fileID: (-?\d+)\}', body).group(1); prefab = re.search(r'm_SourcePrefab: \{fileID: \d+, guid: (\w+)', body).group(1)
            roots, name, mats = {}, None, {}
            for t, path, val, ref in re.findall(r'- target: \{fileID: (-?\d+), guid: \w+, type: \d\}\n\s+propertyPath: (.*)\n\s+value: ?(.*)\n\s+objectReference: \{fileID: -?\d+(?:, guid: (\w+))?', body):
                path = path.strip("'"); mm = re.match(r'm_Local(Position|Rotation|Scale)\.([xyzw])$', path)
                if mm: roots.setdefault(t, {})[path] = float(val)
                elif path == 'm_Name': name = val.strip()
                elif path.startswith('m_Materials.Array.data['): mats[int(path[23:-1])] = ref
            rt = next((t for t, v in roots.items() if 'm_LocalPosition.x' in v or 'm_LocalRotation.w' in v), None); v = roots.get(rt, {})
            PI[fid] = dict(par=par, prefab=guid.get(prefab, ''), name=name or '', p=[v.get('m_LocalPosition.' + a, 0) for a in 'xyz'], q=[v.get('m_LocalRotation.' + a, 1 if a == 'w' else 0) for a in 'xyzw'], s=[v.get('m_LocalScale.' + a, 1) for a in 'xyz'], mats=mats)
    def qmul(a, b):
        ax, ay, az, aw = a; bx, by, bz, bw = b
        return [aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz]
    def comp(P, l):   # parent (p, q, s, path) then local
        (pp, pq, ps, path), (p_, q, s) = P, l; v = Vector((p_[0]*ps[0], p_[1]*ps[1], p_[2]*ps[2])); x, y, z, w = pq; v.rotate(Quaternion((w, x, y, z)))
        return ([pp[0] + v.x, pp[1] + v.y, pp[2] + v.z], qmul(pq, q), [ps[0]*s[0], ps[1]*s[1], ps[2]*s[2]], path)
    memo = {}
    def world(fid, kind):   # a scene transform's (or prefab instance's) world placement and the names of the groups above it
        if (fid, kind) in memo: return memo[fid, kind]
        if kind == 't':
            if fid == '0': r = ([0, 0, 0], [0, 0, 0, 1], [1, 1, 1], [])
            elif fid in STR: r = world(STR[fid], 'p')
            else: t = TR[fid]; P = world(t['father'], 't'); r = comp(P, (t['p'], t['q'], t['s'])); r = r[:3] + (P[3] + [GO.get(t['go'], '')],)
        else: i = PI[fid]; P = world(i['par'], 't'); r = comp(P, (i['p'], i['q'], i['s'])); r = r[:3] + (P[3] + [i['name']],)
        memo[fid, kind] = r; return r
    within = lambda v, b: b is None or b[0] <= v <= b[1]
    groups, skip, only = o.get('groups', []), o.get('skip', []), o.get('only')
    ox, oy, oz = o.get('origin', (0, 0, 0)); k = o.get('scale', 1); a = math.radians(o.get('yaw', 0))
    turn = Matrix.Rotation(a, 4, 'Z') @ Matrix.Scale(k, 4)   # (Blender's z is up)
    n = 0
    for fid, i in PI.items():
        base = os.path.splitext(os.path.basename(i['prefab']))[0]
        if base not in fbx or any(base.startswith(s) for s in skip) or (only and not any(base.startswith(s) for s in only)): continue
        wp, wq, ws, path = world(fid, 'p'); g = '/'.join(path[:-1])
        if groups and not any(g == x or g.startswith(x + '/') for x in groups): continue
        b = o.get('box'); yb = o.get('ybox')
        if b and not (within(wp[0], b[0:2]) and within(wp[2], b[2:4])) or not within(wp[1], yb): continue
        if any((not c.get('names') or any(base.startswith(s) for s in c['names'])) and (not c.get('box') or (within(wp[0], c['box'][0:2]) and within(wp[2], c['box'][2:4]))) and within(wp[1], c.get('ybox')) for c in o.get('cut', [])): continue
        # Unity → Blender: x' = -x, y' = -z, z' = y (and the turn with it: quaternion (x, z, -y, w))
        qx, qy, qz, qw = wq
        M = Matrix.Translation(Vector((-(wp[0] - ox), -(wp[2] - oz), wp[1] - oy))) @ Quaternion((qw, qx, qz, -qy)).to_matrix().to_4x4() @ Matrix.Diagonal((ws[0], ws[2], ws[1], 1))
        tex = None
        if base in o.get('swap', {}):
            base, k2 = o['swap'][base]; M = M @ Matrix.Scale(k2, 4); i = dict(i, mats={})
        if i['mats']:
            dflt = C.job.get('slots', {}).get(base + '.fbx') or []
            tex = [dflt[min(j, len(dflt) - 1)] if dflt else C.job.get('fallback') for j in range(max(len(dflt), max(i['mats']) + 1))]
            for j, g_ in i['mats'].items():
                t = mat_tex(g_)
                if t is not None: tex[j] = t
        C.place(fbx[base], [v for row in (turn @ M) for v in row], tex); n += 1
    print('PLACED', n)

if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    C = Composer(job)
    if job.get('house'): house(C, job['kit'], job['house'])
    for p in job.get('compose', []):
        if 'scene' in p: scene(C, p)   # (an arrangement out of the pack's demo scene)
        elif 'm' in p: C.place(p['src'], p['m'], p.get('tex'))   # (one part by a whole matrix)
        else: C.part(p['src'], p.get('at', (0, 0, 0)), p.get('rot', 0), p.get('scale', 1), p.get('sx', 1))
    C.finish(job['out'])
    print('COMPOSED', job['out'], json.dumps(C.used))
