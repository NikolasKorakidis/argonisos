// The team's sound packs → small mono MP3s the game plays (sound.js): node tools/assets/sounds.mjs
// Each key in manifest.json "sounds" is a list of recordings (variants, played at random): assets/sounds/pack/<key>_<n>.mp3.
// Loops (keys starting "loop") keep their full length; one-shots are trimmed of trailing silence. Like the models, these
// stay out of the public repo (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const PACK = process.env.PACK || path.join(ROOT, 'incoming assets/Argonisos-Assets/Assets'), OUT = path.join(ROOT, 'assets/sounds/pack');
const { sounds } = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true }); let total = 0; const index = {};
for (const [key, files] of Object.entries(sounds)) {
  index[key] = files.length;
  files.forEach((f, i) => {
    const out = path.join(OUT, `${key}_${i}.mp3`), loop = key.startsWith('loop');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(PACK, f), '-ac', '1', '-ar', '44100', ...(loop ? [] : ['-af', 'silenceremove=stop_periods=-1:stop_threshold=-55dB']), '-b:a', loop ? '80k' : '96k', out]);
    total += fs.statSync(out).size;
  });
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));   // (how many variants of each: sound.js reads it)
console.log(Object.keys(sounds).length, 'sounds,', (total / 1024).toFixed(0), 'KB');
