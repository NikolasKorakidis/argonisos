// The team's sound packs → small MP3s the game plays (sound.js): node tools/assets/sounds.mjs [key…] [--report]
// Each key in manifest.json "sounds" is a list of recordings (variants, played at random): assets/sounds/pack/<key>_<n>.mp3.
//   A plain list is from the first packs (PACK): mono; loops (keys starting "loop") keep their full length, one-shots are
//   trimmed of trailing silence and only brought down where they would clip (to -1 dBTP), never up.
//   An entry { group, files } is from the team's own sounds (soundDirs.finals), or from the first packs with from: 'pack'
//   (the footsteps and landings, the swim strokes, the roll, the giant's call, the bell), each recording brought to its
//   group's loudness (soundGroups: one-shots by their loudest moment, EBU R128 momentary, so a short knock and a long roar
//   meet at the same peak; beds by their whole, integrated), so nothing jumps out. A one-shot is never pushed hard into a
//   limiter to get there (that flattened the blows and left them short and uneven, Patch 23): each variant may be limited
//   by 3 dB at most past where its true peak reaches the ceiling, and the key's variants all meet at the level the
//   peakiest of them allows (or the group's, if all can reach it), so one recording of a sound is as loud as another. A
//   key left short of its group (a pickaxe's clicks, a bowstring) is reported, and made up by its vol in sound.js, where
//   the master's limiter has the whole mix to work with. Beds keep the limiter on their rare peaks.
//   A file in the list may say more: { file, slice } cuts a recording of several blows (a pickaxe's, a flight of arrows)
//   into one variant per blow; { file, trim, fade } keeps only its first trim seconds, faded out over the last fade;
//   { file, len } takes len seconds of a long bed. Beds (the group's loop) loop seamlessly: the bed's own continuation is
//   crossfaded (equal power) over its start, so its end runs on into its beginning (XF seconds); stereo where the group
//   says (the ambience's wide beds). Chrome decodes these MP3s without the encoder's padding (checked: the decoded length
//   is exact), so the seam holds.
// Music (manifest "music"): every track to stereo MP3 at 144 kb/s in assets/sounds/pack/music/<key>.mp3, brought to one
// loudness (two passes of ffmpeg's loudnorm, linear); a track whose source is the same file as another's is copied. A
// track that loops (loop: true: the title's, the bosses') gets a loop: [start, end] in seconds, found where the music after
// the end sounds most like the music after the start (each band's loudness, a few seconds of it, then lined up to the
// sample), its end crossfaded into the music just before its start so the jump back is seamless: music.js loops it there,
// so the intro plays once and the outro never.
// What the game needs to know (variants, which are beds, where each one-shot's sound starts, the music's lengths and
// loops) goes in sounds.json; index.json keeps only the first packs' keys in their old form, for builds from before it.
// --report prints each converted recording's loudest moment and true peak against its group's level. Like the models,
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
const XF = 2.5, CEIL = -1, LIMIT = 'alimiter=limit=0.84:level=disabled', MXF = 0.25;   // (MXF: the music loop's seam, seconds)
const args = process.argv.slice(2), only = new Set(args.filter((a) => !a.startsWith('--'))), REPORT = args.includes('--report');
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a], { maxBuffer: 1 << 30 });
const probe = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
// EBU R128: a recording's integrated loudness, its loudest 400 ms (padded, so one shorter than that still counts) and its
// true peak (dBTP)
function measure(f) {
  const err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'verbose', '-i', f, '-af', 'apad=pad_dur=0.5,ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr;
  let m = -120; for (const x of err.matchAll(/M:\s*(-?[\d.]+)/g)) m = Math.max(m, +x[1]);
  return { I: +/I:\s+(-?[\d.]+) LUFS\n\s+Threshold/.exec(err)[1], M: m, TP: +(/Peak:\s+(-?[\d.inf]+) dBFS\s*$/m.exec(err)?.[1] ?? -120) };
}
// a file as mono samples (for finding blows and onsets, and the music's loop)
const pcm = (f, sr = 22050) => { const b = ff('-i', f, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
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
const enc = (src, dst, gain, ch, rate, limit) => ff('-i', src, '-af', `volume=${gain.toFixed(2)}dB${limit ? ',' + LIMIT : ''}`, '-ac', String(ch), '-ar', '44100', '-b:a', rate, dst);

// ---- the report: every converted recording against its group's level
if (REPORT) {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'sounds.json'), 'utf8')).sfx;
  for (const [key, entry] of Object.entries(sounds)) {
    if (only.size && !only.has(key)) continue; const G = Array.isArray(entry) ? {} : { ...soundGroups[entry.group], ...entry }, n = meta[key]?.n || 0, rows = [];
    for (let i = 0; i < n; i++) { const m = measure(path.join(OUT, `${key}_${i}.mp3`)); rows.push(G.loop ? `I ${m.I}` : `M ${m.M.toFixed(1)} TP ${m.TP.toFixed(1)}`); }
    console.log(key.padEnd(14), String(G.level ?? '').padStart(4), rows.join(' · '));
  }
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'sounds.json'), 'utf8')); } catch { return { sfx: {}, music: {} }; } })();
const index = {}, sfx = {}, short = []; let total = 0, n = 0;
for (const [key, entry] of Object.entries(sounds)) {
  if (Array.isArray(entry) || entry.from === 'pack') index[key] = (entry.files || entry).length;
  if (only.size && !only.has(key)) { if (prev.sfx[key]) sfx[key] = prev.sfx[key]; continue; }
  if (Array.isArray(entry)) {   // the first packs, as they come (only kept from clipping)
    const loop = key.startsWith('loop');
    const outs = entry.map((f, i) => {
      const out = path.join(OUT, `${key}_${i}.mp3`), tmp = path.join(TMP, `${key}_${i}.wav`);
      ff('-i', path.join(PACK, f), '-ac', '1', '-ar', '44100', ...(loop ? [] : ['-af', 'silenceremove=stop_periods=-1:stop_threshold=-55dB']), '-c:a', 'pcm_f32le', tmp);
      const over = loop ? 0 : Math.max(0, measure(tmp).TP - CEIL); enc(tmp, out, -over, 1, loop ? '80k' : '96k', false); return out;
    });
    sfx[key] = { n: outs.length, ...(loop ? { loop: true } : {}) };
    for (const out of outs) total += fs.statSync(out).size; n += outs.length; continue;
  }
  const G = { ...soundGroups[entry.group], ...entry }, ch = G.stereo ? 2 : 1, cuts = [], DIR = entry.from === 'pack' ? PACK : FINALS;
  for (const it of entry.files) {
    const o = typeof it === 'string' ? { file: it } : it, src = path.join(DIR, o.file);
    if (G.loop) { const dur = probe(src), xf = Math.min(XF, dur / 6), start = o.len && dur > o.len + xf + 4 ? 2 : 0, len = Math.min(o.len || 1e9, dur - start - xf); cuts.push((dst) => loopCut(src, dst, { start, len, xf }, ch)); }
    else if (o.slice) for (const [a, b] of blows(src)) cuts.push((dst) => ff('-ss', String(a), '-t', String(b - a), '-i', src, '-af', 'afade=t=out:st=' + Math.max(0, b - a - 0.04) + ':d=0.04', '-ac', String(ch), '-ar', '44100', '-c:a', 'pcm_f32le', dst));
    else cuts.push((dst) => ff('-i', src, '-af', [...(o.trim ? [`atrim=duration=${o.trim}`, `afade=t=out:st=${o.trim - (o.fade || 0.5)}:d=${o.fade || 0.5}`] : []), 'areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse'].join(','), '-ac', String(ch), '-ar', '44100', '-c:a', 'pcm_f32le', dst));
  }
  // (every variant cut first and measured, so they can be brought to one level together)
  const tmps = cuts.map((cut, i) => { const tmp = path.join(TMP, `${key}_${i}.wav`); cut(tmp); return tmp; }), ms = tmps.map(measure);
  // (a one-shot: all its variants at the level the peakiest allows, with at most 3 dB of limiting, or at the group's)
  const level = G.loop ? G.level : Math.min(G.level, ...ms.map((m) => m.M + CEIL - m.TP + 3));
  if (!G.loop && level < G.level - 0.5) short.push(`${key} ${(level - G.level).toFixed(1)} LU`);
  const meta = { n: cuts.length, onset: [], dur: [] };
  tmps.forEach((tmp, i) => {
    const out = path.join(OUT, `${key}_${i}.mp3`), gain = level - (G.loop ? ms[i].I : ms[i].M);
    enc(tmp, out, gain, ch, G.loop ? (ch === 2 ? '112k' : '80k') : '96k', G.loop || ms[i].TP + gain > CEIL + 0.05);
    meta.dur.push(+probe(out).toFixed(3)); if (!G.loop) meta.onset.push(+onsetOf(out).toFixed(2));
    total += fs.statSync(out).size; n++;
  });
  if (G.loop) { meta.loop = true; delete meta.onset; }
  sfx[key] = meta;
}
if (short.length) console.log('short of their group\'s level (trim with vol in sound.js):', short.join(', '));

// ---- the music's loop: where to jump back to and from (seconds), so the end runs on into the start
// Each band's loudness (lows, mids, highs: one-pole splits at 200 Hz and 2 kHz) in frames of 256 samples at 11025 Hz;
// every start in the first part of the track and end in the last is weighed by how alike the second before and the four
// after each are (dB, both ways), coarsely then finely, and the best pair lined up to the sample by the waveforms.
function findLoop(mono, sr, dur) {
  const H = 256, nF = Math.floor(mono.length / H), F = [new Float32Array(nF), new Float32Array(nF), new Float32Array(nF)];
  let l1 = 0, l2 = 0; const a1 = 1 - Math.exp(-2 * Math.PI * 200 / sr), a2 = 1 - Math.exp(-2 * Math.PI * 2000 / sr), acc = [0, 0, 0];
  for (let i = 0; i < nF * H; i++) { const x = mono[i]; l1 += a1 * (x - l1); l2 += a2 * (x - l2); acc[0] += l1 * l1; acc[1] += (l2 - l1) ** 2; acc[2] += (x - l2) ** 2;
    if ((i + 1) % H === 0) { const f = (i + 1) / H - 1; for (let b = 0; b < 3; b++) { F[b][f] = 10 * Math.log10(acc[b] / H + 1e-9); acc[b] = 0; } } }
  const fs_ = sr / H, pre = Math.round(fs_), post = Math.round(4 * fs_), cost = (a, b, step) => { let s = 0, k = 0; for (let f = -pre; f < post; f += step) for (let bd = 0; bd < 3; bd++) { s += Math.abs(F[bd][a + f] - F[bd][b + f]); k++; } return s / k; };
  const a0 = Math.max(pre, Math.round(Math.min(8, dur * 0.12) * fs_)), a1_ = Math.round(dur * 0.45 * fs_), b0 = Math.round(dur * 0.55 * fs_), b1 = nF - post - 1, minLen = Math.round(dur * 0.45 * fs_);
  let best = [1e9, 0, 0];
  for (let a = a0; a <= a1_; a += 4) for (let b = Math.max(b0, a + minLen); b <= b1; b += 4) { const c = cost(a, b, 3); if (c < best[0]) best = [c, a, b]; }
  const [, ca, cb] = best; for (let a = ca - 6; a <= ca + 6; a++) for (let b = cb - 6; b <= cb + 6; b++) { if (a < pre || b > b1) continue; const c = cost(a, b, 1); if (c < best[0]) best = [c, a, b]; }
  // (lined up to the sample: the end moved to where the waveform after it best matches the one after the start)
  const A = best[1] * H, B0 = best[2] * H, W = Math.round(sr * 0.5), R = Math.round(sr * 0.015); let bl = 0, bc = -1e9;
  for (let d = -R; d <= R; d++) { let s = 0, ea = 0, eb = 0; for (let i = 0; i < W; i++) { const x = mono[A + i], y = mono[B0 + d + i] ?? 0; s += x * y; ea += x * x; eb += y * y; } const c = s / Math.sqrt(ea * eb + 1e-12); if (c > bc) { bc = c; bl = d; } }
  return { start: A / sr, end: (B0 + bl) / sr, match: +best[0].toFixed(2), corr: +bc.toFixed(2) };
}

// ---- the music
const M = {}, made = new Map(); fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
for (const [key, t] of Object.entries(music?.tracks || {})) {
  const src = path.join(MUSIC, t.file), out = path.join(OUT, 'music', `${key}.mp3`), hash = crypto.createHash('md5').update(fs.readFileSync(src)).digest('hex');
  let loop = prev.music?.[key]?.loop;
  if (made.has(hash)) fs.copyFileSync(path.join(OUT, 'music', `${made.get(hash)}.mp3`), out);   // (the same file under another name: Main-Menu is Yleos's, Story-Telling the Swamp's and Acheron's)
  else if (!only.size || only.has('music') || only.has(key) || !fs.existsSync(out)) {
    const L = `I=${music.level}:TP=-1.5:LRA=11`, err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `loudnorm=${L}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const j = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)), norm = `loudnorm=${L}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    if (t.loop) {   // (the loop found on the levelled track, its seam crossfaded in the samples, then encoded)
      const raw = path.join(TMP, `${key}.f32`); ff('-i', src, '-af', norm, '-ac', '2', '-ar', '44100', '-f', 'f32le', raw);
      const wav = path.join(TMP, `${key}.wav`); ff('-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', raw, '-c:a', 'pcm_f32le', wav);
      const S = new Float32Array(fs.readFileSync(raw).buffer.slice(0)), dur = S.length / 2 / 44100, mono = pcm(wav, 11025);
      const lp = findLoop(mono, 11025, dur), A = Math.round(lp.start * 44100), B = Math.round(lp.end * 44100), X = Math.round(MXF * 44100);
      for (let i = 0; i < X; i++) { const u = i / X, fo = Math.cos(u * Math.PI / 2), fi = Math.sin(u * Math.PI / 2); for (let c = 0; c < 2; c++) { const b = (B - X + i) * 2 + c; S[b] = S[b] * fo + S[(A - X + i) * 2 + c] * fi; } }
      fs.writeFileSync(raw, Buffer.from(S.buffer)); ff('-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', raw, '-c:a', 'libmp3lame', '-b:a', '144k', out);
      loop = [+(A / 44100).toFixed(5), +(B / 44100).toFixed(5)]; console.log(`${key}: loops ${loop[0].toFixed(2)} → ${loop[1].toFixed(2)} s of ${dur.toFixed(1)} (match ${lp.match} dB, waveform ${lp.corr})`);
    } else ff('-i', src, '-af', norm, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '144k', out);
  }
  if (!made.has(hash)) made.set(hash, key);
  if (made.get(hash) !== key) loop = M[made.get(hash)]?.loop && t.loop ? M[made.get(hash)].loop : undefined;
  M[key] = { dur: +probe(out).toFixed(2), ...(made.get(hash) !== key ? { same: made.get(hash) } : {}), ...(t.play === false ? { play: false } : {}), ...(t.loop && loop ? { loop } : {}) };
  total += fs.statSync(out).size;
}
fs.rmSync(TMP, { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));   // (the first packs' keys and how many of each, for builds from before sounds.json)
fs.writeFileSync(path.join(OUT, 'sounds.json'), JSON.stringify({ sfx, music: M }));
console.log(Object.keys(sfx).length, 'sounds,', n, 'recordings,', Object.keys(M).length, 'tracks,', (total / 1048576).toFixed(1), 'MB');
