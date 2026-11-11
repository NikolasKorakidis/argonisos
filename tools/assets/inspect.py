import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
for path in argv:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True)
    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    import mathutils
    pts = [o.matrix_world @ mathutils.Vector(c) for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box]
    size = [max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3)] if pts else []
    print('FILE', path.split('/')[-1], 'tris', tris, 'bones', [len(a.data.bones) for a in arm], 'size', [round(s, 2) for s in size],
          'mats', [m.name for m in bpy.data.materials], 'actions', len(bpy.data.actions), sorted(set(a.name.split('|')[-1] for a in bpy.data.actions))[:60])
