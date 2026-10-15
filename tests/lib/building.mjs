// Building helpers for page snippets: house space (the house's own frame, turned by R), building by plan, aiming the
// camera as a player would and reading back where the ghost went. Used by the placement and structures suites.
export const LIB = `
  AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false); g.give('hammer'); if (!g.equippedTool('build')) g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer'));
  const H = window._H, R = H.R, c = Math.cos(R), s = Math.sin(R);
  // house space: x along the front, z inward, y up from the floor, turned by R about the house's middle
  const W = (x, y, z) => new V(H.x + x * c + z * s, H.y + y, H.z - x * s + z * c);
  const local = (p) => { const dx = p.x - H.x, dz = p.z - H.z; return [dx * c - dz * s, p.y - H.y, dx * s + dz * c]; };
  const put = (id, x, y, z, r = 0) => { const p = B.place(id, W(x, y, z), R + r); if (!p) throw new Error('could not build ' + id); return p; };
  const floors = () => { for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z); };
  const walls = (skip = []) => { const all = { f1: ['wall', -1.5, 0, -3, 0], f2: ['wall', 1.5, 0, -3, 0], b1: ['wall', -1.5, 0, 3, 0], b2: ['wall', 1.5, 0, 3, 0], l1: ['wall', -3, 0, -1.5, Math.PI / 2], l2: ['wall', -3, 0, 1.5, Math.PI / 2], r1: ['wall', 3, 0, -1.5, Math.PI / 2], r2: ['wall', 3, 0, 1.5, Math.PI / 2] }; for (const [k, w] of Object.entries(all)) if (!skip.includes(k)) put(...w); };
  const norm = (a) => ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  // aim from cam to target (both in house space), the hero standing at stand; returns where the ghost went, in house space
  const aim = (id, rot, cam, target, stand) => {
    B.select(id); B.rot = R + rot; B.lastSnap = null; const st = stand || [cam[0] + (target[0] - cam[0]) * 0.45, 0, cam[2] + (target[2] - cam[2]) * 0.45]; const sp = W(...st); P.spawn(sp.x, sp.z);
    const cp = W(...cam), tp = W(...target); AG.camera.position.copy(cp); AG.camera.lookAt(tp); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
    const r = B.placeGhost(); return r && { at: local(r.pos), rot: norm(r.rot - R), why: r.why };
  };
  // try every aim; report the ones that miss the spot (or its turn), or that are refused
  const check = (id, rot, want, wantRot, aims) => { const bad = [];
    for (const [cam, target, stand] of aims) { const r = aim(id, rot, cam, target, stand); const ok = r && !r.why && Math.hypot(r.at[0] - want[0], r.at[1] - want[1], r.at[2] - want[2]) < 0.05 && (wantRot === null || Math.abs(norm(r.rot - wantRot)) < 0.05 || Math.abs(norm(r.rot - wantRot - Math.PI)) < 0.05 && id === 'wall');
      if (!ok) bad.push('aim at ' + target.map((v) => v.toFixed(1)) + ' from ' + cam.map((v) => v.toFixed(0)) + ' → ' + (r ? r.at.map((v) => v.toFixed(2)) + ' turn ' + r.rot.toFixed(2) + (r.why ? ' (' + r.why + ')' : '') : 'no ghost')); }
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
    return bad.length === 0 || bad.length + '/' + aims.length + ' missed: ' + bad.slice(0, 3).join(' | ');
  };
  // long stairs up to the terrace: the top end anywhere along its outer edge (z -6, 3 m up), running down toward the viewer
  const stairsCheck = (aims) => { const bad = [];
    for (const [cam, target, stand] of aims) { const r = aim('stairsLong', Math.PI, cam, target, stand); const top = r && local(B.snapsOf(B.piece('stairsLong'), W(...r.at), r.rot + R)[5]);
      const ok = r && !r.why && Math.abs(top[1] - 3) < 0.05 && Math.abs(top[2] + 6) < 0.05 && top[0] > -3.01 && top[0] < 0.01 && Math.abs(norm(r.rot - Math.PI)) < 0.05;
      if (!ok) bad.push('aim at ' + target.map((v) => v.toFixed(1)) + ' → ' + (r ? r.at.map((v) => v.toFixed(2)) + ' turn ' + r.rot.toFixed(2) + (r.why ? ' (' + r.why + ')' : '') : 'no ghost')); }
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
    return bad.length === 0 || bad.length + '/' + aims.length + ' missed: ' + bad.slice(0, 3).join(' | '); };
  const grid = (cx, cy, cz, sx, sy, sz, n = 3) => { const o = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o.push([cx + (i / (n - 1) - 0.5) * sx, cy + (j / (n - 1) - 0.5) * sy, cz + (i / (n - 1) - 0.5) * sz]); return o; };
`;

