// Glitch notes: a clip, a frame and what's wrong there ("left hand through the thigh"), kept in this browser and copied
// out as plain text for the lead. { id, subject, clip, file, frame, time, text, setup (body, gear, in place or moving), at }
const KEY = 'argonisos.dev.animNotes';
let list = [];
try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(list)) list = []; } catch { list = []; }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* no storage: the notes live for the visit */ } };

export const notes = {
  all: () => list,
  of: (subject, clip) => list.filter((n) => n.subject === subject && n.clip === clip).sort((a, b) => a.frame - b.frame),
  add(n) { const x = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), ...n }; list.push(x); store(); return x; },
  remove(id) { list = list.filter((n) => n.id !== id); store(); },
  edit(id, text) { const n = list.find((x) => x.id === id); if (n) { n.text = text; store(); } },
  // every note, by subject and clip, ready to paste
  text() {
    if (!list.length) return 'No animation notes yet.';
    const by = new Map(); for (const n of [...list].sort((a, b) => a.subject.localeCompare(b.subject) || a.clip.localeCompare(b.clip) || a.frame - b.frame)) { const k = `${n.subject} · ${n.clip}${n.file ? ` (${n.file})` : ''}`; if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
    let s = `Argonisos animation notes, ${new Date().toISOString().slice(0, 10)} (${list.length})\n`;
    for (const [k, ns] of by) { s += `\n${k}\n`; for (const n of ns) s += `  - frame ${n.frame} (${n.time.toFixed(2)} s): ${n.text}${n.setup ? `  [${n.setup}]` : ''}\n`; }
    return s;
  },
};
