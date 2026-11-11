// What a converted model holds: node tools/assets/clips.mjs assets/models/pack/minotaur.glb
// Size of the parts, and for each clip its length and how far its root bone travels (root motion would make a body
// slide and snap back: the game moves its creatures itself).
import fs from 'node:fs';
const b = fs.readFileSync(process.argv[2]), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n)), bin = b.subarray(20 + n + 8);
const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], k = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]; return { a, d: new Float32Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * k), k }; };
const bytes = (pred) => j.bufferViews.filter(pred).reduce((s, v) => s + v.byteLength, 0);
const animV = new Set(j.animations.flatMap((a) => a.samplers.flatMap((s) => [j.accessors[s.input].bufferView, j.accessors[s.output].bufferView])));
console.log('meshes', j.meshes.length, 'nodes', j.nodes.length, 'images', (j.images || []).length, 'KB anim', (bytes((_, i) => animV.has(i)) / 1024).toFixed(0), 'KB other', (bytes((_, i) => !animV.has(i)) / 1024).toFixed(0));
const root = j.skins?.[0]?.joints.find((i) => /hips|pelvis/i.test(j.nodes[i].name)) ?? j.skins?.[0]?.joints[0];
for (const a of j.animations) {
  const len = Math.max(...a.samplers.map((s) => j.accessors[s.input].max[0]));
  const ch = a.channels.find((c) => c.target.node === root && c.target.path === 'translation'); let mv = '';
  if (ch) { const { d } = acc(a.samplers[ch.sampler].output), N = d.length / 3; mv = ['x', 'y', 'z'].map((ax, k) => `${ax} ${(d[(N - 1) * 3 + k] - d[k]).toFixed(2)}`).join(' '); }
  console.log(a.name.padEnd(16), len.toFixed(2) + 's', 'root', j.nodes[root].name, mv);
}
