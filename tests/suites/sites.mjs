// The sites' fingerprint: what world/structures.js (and town.js) build, hashed in the page, so the builders can be split
// into modules of their own and the carved props reorganised without the slow visual suite. Every site's group (where it
// stands, its bounding box, and each mesh's material, vertex and index counts, the sums of its positions and its place),
// the solids, floors, roofs, things to use, fires, roof anchors and colliders, and the carved and pack plants' geometry
// for every species and variant (propGeo, through veg.geoFor). The world fingerprint covers where the sites are; this
// covers what stands there. Sites built from the packs differ without them, so the fingerprint is recorded with them.
// When the sites are meant to change: run `node tests/run.mjs sites --update` and paste the new fingerprint below.
// (recorded on 21 November 2026 after commit a64dce0, the stone material in, with Olympos's new summit, cairns and places
// on the way up (Patch 24) and the other agents' work of that round in progress: record it again once the round is in,
// before moving any site code)
const FINGERPRINT = {
  solids: 'f95d6c9b', tops: '31d55e52', uses: '67a640ce', colliders: '63681f22', plants: '798b817a', groups: '01c4c5d1',
};

// (FNV-1a over numbers rounded to a fixed precision, as in world.mjs, so the last float bit doesn't count; the mesh
// geometry's sums are rounded coarser, since they add up thousands of vertices)
const HASH = `const hasher = () => { let h = 0x811c9dc5; const add = (v, k = 1e3) => { const s = typeof v === 'number' ? (Number.isFinite(v) ? (Math.round(v * k) / k).toString() : String(v)) : String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= 44; h = Math.imul(h, 0x01000193); }; return { add, hex: () => (h >>> 0).toString(16).padStart(8, '0') }; };
  const geo = (H, gm) => { if (!gm || !gm.attributes.position?.array) { H.add('none'); return; } const p = gm.attributes.position, ix = gm.index; H.add(p.count); H.add(ix ? ix.count : -1); let x = 0, y = 0, z = 0, q = 0; for (let i = 0; i < p.count; i++) { const a = p.getX(i), b = p.getY(i), c = p.getZ(i); x += a; y += b; z += c; q += (a * 1.3 + b * 0.7 - c) ** 2; } for (const v of [x, y, z, q]) H.add(v, 10); if (ix) { let s = 0; for (let i = 0; i < ix.count; i++) s += ix.getX(i) * ((i % 7) + 1); H.add(s); } for (const k of Object.keys(gm.attributes).sort()) H.add(k + gm.attributes[k].itemSize); };
  // every site's group: where it stands, the box round what stays put, and each mesh's material, place and geometry
  // (each on its own and then in no particular order: some are filled in when a worker or a pack model comes back)
  const groupsHash = (St) => { const H = hasher(), box = new AG.THREE.Box3(), one = new AG.THREE.Box3(), all = []; let meshes = 0;
    for (const grp of St.groups) {
      const H = hasher(); all.push(H); grp.updateMatrixWorld(true); for (const v of [grp.position.x, grp.position.y, grp.position.z, grp.rotation.y]) H.add(v);
      // (the flames flicker and turn, and the smoke puffs move themselves as they're drawn: their shapes count, not where they are)
      // (a far version, merged from these for drawing a long way off and kept only on the card, is left out: it is made from
      // what is hashed here, and only once the site is first far enough)
      const far = grp.userData.far?.group, walk = (o, f) => { if (o === far) return; f(o); for (const c of o.children) walk(c, f); };
      box.makeEmpty(); const each = []; walk(grp, (o) => { if (!o.isMesh && !o.isPoints && !o.isLine) return; meshes++; const H = hasher(); each.push(H); const ms = [o.material].flat(); H.add(ms.map((m) => m?.name || m?.type).join('+'));
        let moves = Object.hasOwn(o, 'onBeforeRender'); for (let q = o; q && q !== grp && !moves; q = q.parent) moves = St.flames.includes(q);
        if (!moves) { for (const e of o.matrixWorld.elements) H.add(e); if (o.geometry.attributes.position.array) { o.geometry.computeBoundingBox(); box.union(one.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } } else H.add('moves');
        if (o.isInstancedMesh) { H.add('x' + o.count); let s = 0; for (let i = 0; i < o.count * 16; i++) s += o.instanceMatrix.array[i]; H.add(s, 10); } geo(H, o.geometry); });
      for (const k of each.map((q) => q.hex()).sort()) H.add(k);
      for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) H.add(v, 100);
    }
    for (const k of all.map((q) => q.hex()).sort()) H.add(k);
    return { H, meshes }; };`;

export default {
  name: 'Sites fingerprint',
  async run(t, { flags }) {
    // (the caves' rock and furnishings are built by a worker: wait for every one)
    const caves = await t.until("import('/src/world/sites.js').then((S) => S.SITES.caves.every((c, i) => g.colliders.groups.has('cave' + i)))", 30000);
    t.check('every cave is built', caves, 'the caves were not all built within 30 s');
    const got = await t.eval(`${HASH}
      const St = g.structures, out = {}, H = { solids: hasher(), tops: hasher(), uses: hasher(), colliders: hasher(), plants: hasher() };
      const G = groupsHash(St); H.groups = G.H;
      // (in no particular order: a cave's furnishings come back from a worker, so where they fall in the lists is down to timing)
      const sorted = (H, list, f) => { for (const k of list.map((x) => { const q = hasher(); f(q, x); return q.hex(); }).sort()) H.add(k); };
      sorted(H.solids, St.solids, (q, c) => { for (const v of [c.x, c.z, c.r, c.y, c.h]) q.add(v); });
      for (const [list, k] of [[St.tops, 'top'], [St.roofs, 'roof']]) sorted(H.tops, list, (h, q) => { h.add(k); for (const v of [q.ctx.s.x, q.ctx.s.z, q.ctx.rot, q.x0, q.x1, q.z0, q.z1, q.y]) h.add(v); });
      sorted(H.uses, St.uses, (q, u) => { q.add(u.kind + (u.boss || '') + (u.id || '')); for (const v of [u.at.x, u.at.y, u.at.z, u.r]) q.add(v); });
      sorted(H.uses, St.lights, (q, l) => { for (const v of [l.x, l.y, l.z]) q.add(v); }); H.uses.add(St.flames.length);
      sorted(H.uses, St.anchors, (q, a) => { for (const v of [a.x, a.y ?? 0, a.z]) q.add(v); });
      // (only the sites' own collider groups: the vegetation cells and creatures come and go with the player)
      const keys = [...g.colliders.groups.keys()].filter((k) => k === 'sites' || /^(ruin|rubble|cave)/.test(k)).sort();
      for (const k of keys) { H.colliders.add(k); sorted(H.colliders, g.colliders.groups.get(k), (q, c) => { for (const v of [c.x, c.z, c.r, c.y ?? 0, c.h ?? 99]) q.add(v); }); }
      const F = await import('/src/world/flora.js');
      for (let sp = 0; sp < F.SPECIES.length; sp++) for (let v = 0; v < 3; v++) { const p = AG.veg.geoFor(sp, v); H.plants.add(F.SPECIES[sp].name + v); geo(H.plants, p?.geo); geo(H.plants, p?.lo); geo(H.plants, p?.cards); }
      for (const k of Object.keys(H)) out[k] = H[k].hex();
      return { fp: out, n: { groups: St.groups.length, meshes: G.meshes, solids: St.solids.length, tops: St.tops.length + St.roofs.length, uses: St.uses.length, colliders: keys.join(' '), species: F.SPECIES.length } };`);
    t.metric('fingerprint', got.fp); t.metric('counted', got.n);
    if (flags.has('--update')) { console.log('\n  new fingerprint: ' + JSON.stringify(got.fp).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ') + '\n'); return; }
    // (and a second later the same: nothing in it may depend on the time or the frame)
    const again = await t.eval(`${HASH} await sleep(1000); return groupsHash(g.structures).H.hex();`);   // (eval runs the prelude's waits: sleep)
    t.check('the sites hash the same a second later (nothing that moves is counted where it stands)', again === got.fp.groups, `${got.fp.groups} then ${again}`);
    for (const k of Object.keys(FINGERPRINT)) t.check(`${k}: exactly as before`, got.fp[k] === FINGERPRINT[k], `fingerprint ${got.fp[k]}, recorded ${FINGERPRINT[k]}`);
  },
};
