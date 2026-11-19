// The team's sound packs → small MP3s the game plays (sound.js): node tools/assets/sounds.mjs [key…]
// Each key in manifest.json "sounds" is a list of recordings (variants, played at random): assets/sounds/pack/<key>_<n>.mp3.
//   A plain list is from the first packs (PACK): mono; loops (keys starting "loop") keep their full length, one-shots are
//   trimmed of trailing silence. The footsteps and landings (keys starting "step" or "land") come from different packs
//   recorded at very different levels (the sand and water steps some 15 dB under the rest): each set is brought to the
//   same mean loudness (LEVEL, in dB), its recordings keeping their differences, with a limiter against clipping.
//   An entry { group, files } is from the team's own sounds (soundDirs.finals), each recording brought to its group's
//   loudness (soundGroups: one-shots by their loudest moment, EBU R128 momentary, so a short knock and a long roar meet
//   at the same peak; beds by their whole, integrated), so nothing jumps out. A file in the list may say more:
//   { file, slice } cuts a recording of several blows (a pickaxe's, a flight of arrows) into one variant per blow;
//   { file, trim, fade } keeps only its first trim seconds, faded out over the last fade; { file, len } takes len seconds
//   of a long bed. Beds (the group's loop) loop seamlessly: the bed's own continuation is crossfaded (equal power) over
//   its start, so its end runs on into its beginning (XF seconds); stereo where the group says (the ambience's wide beds).
//   Chrome decodes these MP3s without the encoder's padding (checked: the decoded length is exact), so the seam holds.
// Music (manifest "music"): every track to stereo MP3 at 144 kb/s in assets/sounds/pack/music/<key>.mp3, brought to one
// loudness (two passes of ffmpeg's loudnorm, linear); a track whose source is the same file as another's is copied.
// What the game needs to know (variants, which are beds, where each one-shot's sound starts, the music's lengths) goes in
// sounds.json; index.json keeps only the first packs' keys in their old form, for builds from before it. Like the models,
// all of this stays out of the public repo (git-ignored); tools/assets/backup.mjs takes assets/sounds/pack whole.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const PACK = process.env.PACK || path.join(ROOT, 'incoming assets/Argonisos-Assets/Assets'), OUT = path.join(ROOT, 'assets/sounds/pack');
const { sounds, soundGroups = {}, soundDirs = {}, music } = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const FINALS = path.join(ROOT, soundDirs.finals || ''), MUSIC = path.join(ROOT, soundDirs.music || ''), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'argonisos-sounds-'));
const LEVEL = -25, XF = 2.5, LIMIT = 'alimiter=limit=0.89:level=disabled';
const only = new Set(process.argv.slice(2));
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a], { maxBuffer: 1 << 30 });
const probe = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
// a file's mean loudness in dB (ffmpeg's volumedetect: the first packs' steps)
const meanDb = (f) => +/mean_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr)[1];
// EBU R128: a bed's integrated loudness, or a one-shot's loudest 400 ms (padded, so one shorter than that still counts)
function loudness(f, bed) {
  const err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'verbose', '-i', f, '-af', `apad=pad_dur=0.5,ebur128`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr;
  if (bed) return +/I:\s+(-?[\d.]+) LUFS\n\s+Threshold/.exec(err)[1];
  let m = -120; for (const x of err.matchAll(/M:\s*(-?[\d.]+)/g)) m = Math.max(m, +x[1]); return m;
}
// a file as mono samples (for finding blows and onsets)
const pcm = (f, sr = 22050) => { const b = ff('-i', f, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const envelope = (a, sr, ms = 10) => { const w = Math.round(sr * ms / 1000), e = []; for (let i = 0; i < a.length; i += w) { let m = 0; for (let j = i; j < Math.min(a.length, i + w); j++) m = Math.max(m, Math.abs(a[j])); e.push(m); } return e; };
// where the sound starts in earnest (first reaching a quarter of its peak), in seconds: thunder is timed by it
const onsetOf = (f) => { const e = envelope(pcm(f), 22050), pk = Math.max(...e); return e.findIndex((x) => x >= pk * 0.25) * 0.01; };
// the blows in a recording of several: [start, end] in seconds, each starting a little before it rises out of the quiet
// between them and ending as it dies away (or where the next begins); the weak ones dropped
function blows(f) {
  const e = envelope(pcm(f), 22050), pk = Math.max(...e), out = []; let quiet = 99, cur = null, from = -1;
  e.forEach((x, i) => {
    if (cur && (x < pk * 0.012 ? ++cur.q : (cur.q = 0)) >= 15) { cur.end = i - 12; out.push(cur); cur = null; }
    // (a blow begins where it first rises out of a quiet spell, once it goes on to reach an eighth of the loudest: a
    // whoosh swells slowly, a pick's blow at once)
    if (x < pk * 0.05) quiet++; else { if (quiet >= 8) from = Math.max(0, i - 1); quiet = 0; }
    if (from >= 0 && x >= pk * 0.12) { if (cur) { cur.end = from - 1; out.push(cur); } cur = { start: from, q: 0, pk: 0 }; from = -1; }
    if (cur) cur.pk = Math.max(cur.pk, x);
  });
  if (cur) { cur.end = e.length; out.push(cur); }
  return out.filter((b) => b.pk >= pk * 0.3 && b.end - b.start > 8).map((b) => [b.start * 0.01, b.end * 0.01]);
}
// a bed's loop: len seconds from start, its continuation (XF seconds) crossfaded over its own beginning
function loopCut(src, dst, { start, len, xf }, ch) {
  ff('-i', src, '-filter_complex', `[0:a]atrim=start=${start}:duration=${len + xf},asetpts=PTS-STARTPTS,aformat=channel_layouts=${ch === 2 ? 'stereo' : 'mono'},asplit[a][b];` +
    `[a]atrim=start=${xf},asetpts=PTS-STARTPTS[body];[b]atrim=duration=${xf},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=${xf}:c1=qsin:c2=qsin[out]`, '-map', '[out]', '-ar', '44100', '-c:a', 'pcm_f32le', dst);
}
const enc = (src, dst, gain, ch, rate) => ff('-i', src, '-af', `volume=${gain.toFixed(2)}dB,${LIMIT}`, '-ac', String(ch), '-ar', '44100', '-b:a', rate, dst);

fs.mkdirSync(OUT, { recursive: true });
const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'sounds.json'), 'utf8')); } catch { return { sfx: {}, music: {} }; } })();
const index = {}, sfx = {}; let total = 0, n = 0;
for (const [key, entry] of Object.entries(sounds)) {
  if (only.size && !only.has(key)) { if (prev.sfx[key]) sfx[key] = prev.sfx[key]; if (Array.isArray(entry)) index[key] = entry.length; continue; }
  if (Array.isArray(entry)) {   // the first packs, as before
    index[key] = entry.length; const loop = key.startsWith('loop');
    const encOld = (src, out, gain = 0) => ff('-i', src, '-ac', '1', '-ar', '44100', ...(loop ? [] : ['-af', ['silenceremove=stop_periods=-1:stop_threshold=-55dB', ...(gain ? [`volume=${gain.toFixed(1)}dB`, LIMIT] : [])].join(',')]), '-b:a', loop ? '80k' : '96k', out);
    const outs = entry.map((f, i) => { const out = path.join(OUT, `${key}_${i}.mp3`); encOld(path.join(PACK, f), out); return out; });
    if (/^(step|land)/.test(key)) { const mean = outs.map(meanDb).reduce((a, b) => a + b, 0) / outs.length, gain = LEVEL - mean; if (Math.abs(gain) > 0.5) entry.forEach((f, i) => encOld(path.join(PACK, f), outs[i], gain)); }
    sfx[key] = { n: outs.length, ...(loop ? { loop: true } : {}) };
    for (const out of outs) total += fs.statSync(out).size; n += outs.length; continue;
  }
  const G = { ...soundGroups[entry.group], ...entry }, ch = G.stereo ? 2 : 1, cuts = [];
  for (const it of entry.files) {
    const o = typeof it === 'string' ? { file: it } : it, src = path.join(FINALS, o.file);
    if (G.loop) { const dur = probe(src), xf = Math.min(XF, dur / 6), start = o.len && dur > o.len + xf + 4 ? 2 : 0, len = Math.min(o.len || 1e9, dur - start - xf); cuts.push((dst) => loopCut(src, dst, { start, len, xf }, ch)); }
    else if (o.slice) for (const [a, b] of blows(src)) cuts.push((dst) => ff('-ss', String(a), '-t', String(b - a), '-i', src, '-af', 'afade=t=out:st=' + Math.max(0, b - a - 0.04) + ':d=0.04', '-ac', String(ch), '-ar', '44100', '-c:a', 'pcm_f32le', dst));
    else cuts.push((dst) => ff('-i', src, '-af', [...(o.trim ? [`atrim=duration=${o.trim}`, `afade=t=out:st=${o.trim - (o.fade || 0.5)}:d=${o.fade || 0.5}`] : []), 'areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse'].join(','), '-ac', String(ch), '-ar', '44100', '-c:a', 'pcm_f32le', dst));
  }
  const meta = { n: cuts.length, onset: [], dur: [] };
  cuts.forEach((cut, i) => {
    const tmp = path.join(TMP, `${key}_${i}.wav`), out = path.join(OUT, `${key}_${i}.mp3`); cut(tmp);
    enc(tmp, out, G.level - loudness(tmp, G.loop), ch, G.loop ? (ch === 2 ? '112k' : '80k') : '96k');
    meta.dur.push(+probe(out).toFixed(3)); if (!G.loop) meta.onset.push(+onsetOf(out).toFixed(2));
    total += fs.statSync(out).size; n++;
  });
  if (G.loop) { meta.loop = true; delete meta.onset; }
  sfx[key] = meta;
}
// ---- the music
const M = {}, made = new Map(); fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
for (const [key, t] of Object.entries(music?.tracks || {})) {
  const src = path.join(MUSIC, t.file), out = path.join(OUT, 'music', `${key}.mp3`), hash = crypto.createHash('md5').update(fs.readFileSync(src)).digest('hex');
  if (made.has(hash)) fs.copyFileSync(path.join(OUT, 'music', `${made.get(hash)}.mp3`), out);   // (the same file under another name: Main-Menu is Yleos's, Story-Telling the Swamp's and Acheron's)
  else if (!only.size || only.has('music') || only.has(key) || !fs.existsSync(out)) {
    const L = `I=${music.level}:TP=-1.5:LRA=11`, err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `loudnorm=${L}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const j = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
    ff('-i', src, '-af', `loudnorm=${L}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '144k', out);
  }
  if (!made.has(hash)) made.set(hash, key);
  M[key] = { dur: +probe(out).toFixed(2), ...(made.get(hash) !== key ? { same: made.get(hash) } : {}), ...(t.play === false ? { play: false } : {}) };
  total += fs.statSync(out).size;
}
fs.rmSync(TMP, { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));   // (the first packs' keys and how many of each, for builds from before sounds.json)
fs.writeFileSync(path.join(OUT, 'sounds.json'), JSON.stringify({ sfx, music: M }));
console.log(Object.keys(sfx).length, 'sounds,', n, 'recordings,', Object.keys(M).length, 'tracks,', (total / 1048576).toFixed(1), 'MB');
