// The team's sound packs → small mono MP3s the game plays (sound.js): node tools/assets/sounds.mjs
// Each key in manifest.json "sounds" is a list of recordings (variants, played at random): assets/sounds/pack/<key>_<n>.mp3.
// Loops (keys starting "loop") keep their full length; one-shots are trimmed of trailing silence. The footsteps and
// landings (keys starting "step" or "land") come from different packs recorded at very different levels (the sand and
// water steps some 15 dB under the rest): each set is brought to the same mean loudness (LEVEL, in dB), its recordings
// keeping their differences, with a limiter against clipping. Like the models, these stay out of the public repo
// (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const PACK = process.env.PACK || path.join(ROOT, 'incoming assets/Argonisos-Assets/Assets'), OUT = path.join(ROOT, 'assets/sounds/pack');
const { sounds } = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const LEVEL = -25;
// a file's mean loudness in dB (ffmpeg's volumedetect)
const meanDb = (f) => +/mean_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr)[1];
const encode = (src, out, loop, gain = 0) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '44100',
  ...(loop ? [] : ['-af', ['silenceremove=stop_periods=-1:stop_threshold=-55dB', ...(gain ? [`volume=${gain.toFixed(1)}dB`, 'alimiter=limit=0.9:level=disabled'] : [])].join(',')]), '-b:a', loop ? '80k' : '96k', out]);
fs.mkdirSync(OUT, { recursive: true }); let total = 0; const index = {};
for (const [key, files] of Object.entries(sounds)) {
  index[key] = files.length;
  const loop = key.startsWith('loop'), outs = files.map((f, i) => { const out = path.join(OUT, `${key}_${i}.mp3`); encode(path.join(PACK, f), out, loop); return out; });
  if (/^(step|land)/.test(key)) {
    const mean = outs.map(meanDb).reduce((a, b) => a + b, 0) / outs.length, gain = LEVEL - mean;
    if (Math.abs(gain) > 0.5) files.forEach((f, i) => encode(path.join(PACK, f), outs[i], loop, gain));
  }
  for (const out of outs) total += fs.statSync(out).size;
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));   // (how many variants of each: sound.js reads it)
console.log(Object.keys(sounds).length, 'sounds,', (total / 1024).toFixed(0), 'KB');
