# The sky's cumulus, made from scratch (the packs' own are uneven: see the survey in the clouds' notes): run
#   blender -b --factory-startup -P tools/assets/clouds.py -- assets/models/pack/clouds [preview-dir]
# Each cloud is a recipe of round lobes (spheres) under a domed outline: a wide, low core, a row of swellings along it
# and bigger domes piled on top; the base is pressed flat, the whole remeshed into even quads (QuadriFlow) and cut into
# triangles, so the facets are all of a size, without the crumpled slivers of a decimated shape. Every vertex keeps how
# open it is to the sky (ambient occlusion, cast through the cloud itself) in its colour, which the game's cloud shader
# darkens the creases and the underside with. Same seed, same clouds: rebuild them whenever this file changes.
import bpy, bmesh, sys, os, math, random
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'assets/models/pack/clouds'
PREVIEW = argv[1] if len(argv) > 1 else None
os.makedirs(OUT, exist_ok=True)

# name, seed, kind, width, height (share of the width), depth (share), triangles wanted. Widths are only for the recipe:
# the game sizes each cloud itself, keeping these proportions
CLOUDS = [
    ('cumulus-wide-1', 11, 'fair', 10, 0.36, 0.55, 900),
    ('cumulus-wide-2', 23, 'fair', 10, 0.30, 0.50, 850),
    ('cumulus-wide-3', 37, 'fair', 10, 0.42, 0.60, 1100),
    ('cumulus-long', 41, 'long', 10, 0.24, 0.42, 800),
    ('cumulus-tower-1', 53, 'tower', 10, 0.78, 0.72, 1500),
    ('cumulus-tower-2', 67, 'tower', 10, 0.62, 0.66, 1400),
    ('cumulus-puff-1', 71, 'puff', 10, 0.48, 0.70, 420),
    ('cumulus-puff-2', 83, 'puff', 10, 0.40, 0.62, 380),
    ('cumulus-puff-3', 97, 'puff', 10, 0.55, 0.75, 420),
    # Olympos's own: collars of cloud round the mountain (the game bends each round the mountain's contour at its height,
    # so only the tube's section and the billows along it matter here: height share, tube's half-thickness share)
    ('olympos-band', 131, 'ring', 10, 0.10, 0.055, 5000),
    ('olympos-collar', 149, 'ring', 10, 0.08, 0.042, 4400),
    ('olympos-halo', 163, 'ring', 10, 0.06, 0.032, 3800),
]

def lobes(r, kind, W, Hk, Dk):
    """balls (x, y, z, radius) and the core (an ellipsoid) under a domed outline; z is up, x along the cloud"""
    H, D = W * Hk, W * Dk
    out = []
    peak = (r.random() - 0.5) * W * (0.08 if kind == 'puff' else 0.2)
    # the main domes along the cloud, crowns on a domed outline (the towers stacked up the middle as well), zig-zagging
    # front and back so it has a body from the end too
    n = {'fair': 5, 'long': 7, 'tower': 4, 'puff': 3}[kind]
    span = {'fair': 0.62, 'long': 0.74, 'tower': 0.58, 'puff': 0.5}[kind]
    power = {'fair': 0.8, 'long': 0.6, 'tower': 1.6, 'puff': 0.7}[kind]
    main = []
    for i in range(n):
        t = (i + 0.5) / n - 0.5 + (r.random() - 0.5) * 0.08; x = peak + t * W * span * 1.15 - peak * abs(t) * 2
        h = H * max(0.3, (1 - min(1, abs(t) * 2) ** 2) ** power) * (0.9 + r.random() * 0.12)
        rad = min(h * 0.55, W * 0.15 if kind != 'puff' else W * 0.22) * (0.88 + r.random() * 0.2)
        main.append((x, (r.random() - 0.5) * D * 0.4 + (D * 0.12 if i % 2 else -D * 0.12), h - rad, rad))
    if kind == 'tower':
        for k in range(3):
            rad = W * (0.19 - k * 0.03) * (0.92 + r.random() * 0.15); z = H * (0.4 + k * 0.19)
            main.append((peak + (r.random() - 0.5) * W * 0.12, (r.random() - 0.5) * D * 0.25, min(z, H - rad), rad))
    # under each dome its body down to the base, as wide or a little wider, so the sides rise straight from the flat
    # base and bulge, rather than the domes sitting on a plinth
    for x, y, z, rad in list(main):
        k = 1
        while z - k * rad * 0.7 > rad * 0.3:
            main.append((x + (r.random() - 0.5) * rad * 0.2, y * 0.8, z - k * rad * 0.7, rad * (1.0 + r.random() * 0.08))); k += 1
        main.append((x, y * 0.8, rad * 0.45 + H * 0.04, rad * 0.95))
    out += main
    # smaller domes on each one's upper side: the cauliflower of a growing cumulus
    for x, y, z, rad in main:
        for k in range(3):
            a = r.random() * math.tau; e = math.radians(25 + r.random() * 45); d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e) * 0.8, math.sin(e)))
            s = rad * (0.45 + r.random() * 0.2); c = Vector((x, y, z)) + d * (rad * 0.88)
            out.append((c.x, c.y, c.z, s))
    # a row of low swellings round the foot, front and back, smaller towards the ends
    m = {'fair': 4, 'long': 6, 'tower': 3, 'puff': 0}[kind]
    for side in (-1, 1):
        for i in range(m):
            t = (i + 0.5) / m - 0.5 + (r.random() - 0.5) * 0.06; x = peak * 0.5 + t * W * 0.6
            rad = W * 0.08 * (1 - abs(t) * 0.6) * (0.85 + r.random() * 0.3) * (1.5 if kind == 'puff' else 1)
            out.append((x, side * D * (0.18 + r.random() * 0.1), H * 0.06 + rad * 0.45, rad))
    # (the core no wider than the swellings round it, so the sides bulge out over the flat base rather than step in to it)
    core = (peak * 0.5, 0, H * 0.14, W * 0.32, D * 0.32, H * 0.2)
    return out, core

def ring(r, W, Hk, Dk):
    """a collar: billows all round a circle (its middle at four tenths of the width), thicker and thinner along it, a
    string of small balls under them so it never breaks, smaller domes on top"""
    R0, t, out = W * 0.4, W * Dk, []
    n = int(2 * math.pi * R0 / (t * 1.1)); ph = [r.random() * math.tau for _ in range(3)]
    swell = lambda a: 1 + 0.15 * math.sin(a * 3 + ph[0]) + 0.08 * math.sin(a * 7 + ph[1]) + 0.05 * math.sin(a * 11 + ph[2])
    m = int(2 * math.pi * R0 / (t * 0.4))
    for i in range(m):
        a = i / m * math.tau; out.append((math.cos(a) * R0, math.sin(a) * R0, t * 0.75, t * 0.85 * swell(a)))
    for i in range(n):
        a = (i + (r.random() - 0.5) * 0.5) / n * math.tau; k = swell(a); rad = t * k * (0.9 + r.random() * 0.4); ro = R0 + (r.random() - 0.5) * t * 0.6
        x, y, z = math.cos(a) * ro, math.sin(a) * ro, rad * 0.75 + (r.random() - 0.5) * t * 0.3; out.append((x, y, z, rad))
        for k2 in range(2):
            b = a + (r.random() - 0.5) * 0.6 / n * math.tau; s = rad * (0.45 + r.random() * 0.2); ro2 = ro + (r.random() - 0.5) * rad * 0.8
            out.append((math.cos(b) * ro2, math.sin(b) * ro2, z + rad * (0.55 + r.random() * 0.2), s))
    return out, []

def build(name, seed, kind, W, Hk, Dk, tris):
    r = random.Random(seed); H = W * Hk; flat = kind != 'ring'
    balls, ells = ring(r, W, Hk, Dk) if kind == 'ring' else (lambda b, c: (b, [c]))(*lobes(r, kind, W, Hk, Dk))
    # the lobes as real spheres (and the core a squashed one), joined into one hull by a voxel remesh: each shows at
    # exactly its own size, and a crease runs where two meet, as between the billows of a real cumulus
    bm = bmesh.new()
    for x, y, z, sx, sy, sz in [(x, y, z, rad, rad, rad) for x, y, z, rad in balls] + ells:
        for v in bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1)['verts']: v.co = Vector((x + v.co.x * sx, y + v.co.y * sy, z + v.co.z * sz))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    vox = W / 110 if kind != 'ring' else W * Dk / 9
    remesh(o, vox)
    # the creases eased a little (a cloud's billows are soft; a collar's more), then the base cut off flat and closed; a
    # collar's underside only pressed up a little, smooth, as cloud lying on a slope
    m = o.modifiers.new('ease', 'SMOOTH'); m.factor = 0.5; m.iterations = 4 if kind == 'ring' else 2; bpy.ops.object.modifier_apply(modifier=m.name)
    bm = bmesh.new(); bm.from_mesh(o.data); b = H * 0.08 if flat else 0
    if flat:
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, b), plane_no=(0, 0, 1), clear_inner=True)
        edges = [e for e in cut['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    elif kind == 'ring':
        mid = W * Dk * 0.6
        for v in bm.verts:
            if v.co.z < mid: v.co.z = mid + (v.co.z - mid) * 0.75
    bm.to_mesh(o.data); bm.free()
    largest(o); keep = o.data.copy()
    # even quads at about half the triangles wanted, then cut in two each: facets all of a size. (QuadriFlow wants a
    # closed hull; now and then the remesh leaves a pinched edge, so it is tried again at a slightly different size)
    for k in range(12):
        o.data = keep.copy(); remesh(o, vox * (1 + k * 0.09)); largest(o)
        res = bpy.ops.object.quadriflow_remesh(target_faces=tris // 2, use_mesh_symmetry=False, use_preserve_sharp=True, use_preserve_boundary=False, smooth_normals=False, seed=seed + k)
        if 'FINISHED' in res: break
    else: raise RuntimeError(name + ': QuadriFlow failed')
    if flat: flatten(o, b)
    bm = bmesh.new(); bm.from_mesh(o.data)
    # each corner nudged a little in or out, so neighbouring facets catch the light a little differently (not the base's)
    rr = random.Random(seed * 7); bm.normal_update()
    for v in bm.verts:
        if not flat or v.co.z > b + W * 0.01: v.co += v.normal * (rr.random() - 0.5) * W * (0.006 if flat else 0.002)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    lo = min(v.co.z for v in bm.verts) if not flat else b
    for v in bm.verts: v.co.z -= lo
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth = False
    occlusion(o, W if kind != 'ring' else W * Dk * 8)
    o.select_set(False)
    return o, res

def remesh(o, size):
    m = o.modifiers.new('vox', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = size; bpy.ops.object.modifier_apply(modifier=m.name)

def largest(o):
    """only the biggest piece: a lobe too small to join the rest would float beside it"""
    bm = bmesh.new(); bm.from_mesh(o.data); seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        part, todo = [], [v]; seen.add(v.index)
        while todo:
            u = todo.pop(); part.append(u)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in seen: seen.add(w.index); todo.append(w)
        parts.append(part)
    parts.sort(key=len)
    for p in parts[:-1]: bmesh.ops.delete(bm, geom=p, context='VERTS')
    bm.to_mesh(o.data); bm.free()

def flatten(o, b):
    """the base pressed back onto its plane (the remesh rounds it a little)"""
    for v in o.data.vertices:
        if v.co.z < b + 0.02: v.co.z = b

def occlusion(o, W, rays=48):
    """how much of the sky each corner sees, through the cloud itself, into a colour (grey: 1 open, 0 shut in)"""
    me = o.data; bm = bmesh.new(); bm.from_mesh(me); bm.normal_update(); tree = BVHTree.FromBMesh(bm)
    r = random.Random(5); dirs = []
    for i in range(rays):   # (a fixed cosine-weighted spread round +z, turned onto each corner's normal)
        u, v = r.random(), r.random(); a = 2 * math.pi * u; s = math.sqrt(v); dirs.append(Vector((math.cos(a) * s, math.sin(a) * s, math.sqrt(1 - v))))
    vn = [v.normal.copy() for v in bm.verts]; ao = []
    for v, n in zip(bm.verts, vn):
        q = n.to_track_quat('Z', 'Y'); hit = 0
        for d in dirs:
            d2 = q @ d
            if tree.ray_cast(v.co + n * W * 0.004, d2, W * 0.6)[0] is not None: hit += 1
        ao.append(1 - hit / rays)
    print('  occlusion', round(min(ao), 2), round(sum(ao) / len(ao), 2), round(max(ao), 2))
    bm.free()
    attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER') if 'Col' not in me.color_attributes else me.color_attributes['Col']
    for loop in me.loops:
        a = ao[loop.vertex_index]; attr.data[loop.index].color = (a, a, a, 1)
    me.color_attributes.active_color = attr

bpy.ops.wm.read_factory_settings(use_empty=True)
made = []
for c in CLOUDS:
    o, res = build(*c)
    o.data.calc_loop_triangles(); n = len(o.data.loop_triangles)
    lo = Vector([min(v.co[i] for v in o.data.vertices) for i in range(3)]); hi = Vector([max(v.co[i] for v in o.data.vertices) for i in range(3)])
    for x in bpy.context.scene.objects: x.select_set(x == o)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, c[0] + '.glb'), export_format='GLB', use_selection=True, export_apply=True, export_animations=False,
                              export_skins=False, export_morph=False, export_cameras=False, export_lights=False, export_yup=True, export_materials='NONE',
                              export_vertex_color='ACTIVE', export_normals=True)
    print('CLOUD', c[0], n, 'tris', tuple(round(x, 2) for x in hi - lo), res)
    made.append(o)

# a picture of them all side by side (from the side, a little below, as from the ground), for checking by eye
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True); sc = bpy.context.scene
    try: sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError as e: print(e)
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_cavity = False
    sc.render.resolution_x, sc.render.resolution_y = 480, 300
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    for o in made: o.hide_render = True
    for o in made:
        o.hide_render = False
        for vn, d in {'side': (0, -1, -0.12), 'end': (1, 0, -0.12), 'below': (0.5, -0.7, -0.5), 'above': (0.5, -0.7, 0.6)}.items():
            hi = max(v.co.z for v in o.data.vertices); d = Vector(d).normalized(); ctr = Vector((0, 0, hi / 2)); cam.location = ctr + d * 40
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cd.ortho_scale = max(10, hi * 1.9); cd.clip_end = 200
            sc.render.filepath = os.path.join(PREVIEW, f'{o.name}__{vn}.png'); bpy.ops.render.render(write_still=True)
        o.hide_render = True
