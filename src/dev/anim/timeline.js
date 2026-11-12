// The scrub bar: the clip's frames along a canvas, the play head, when each foot is down (two rows, left over right: the
// heel full, the ball paler), the footfalls the game hears in a cycle (hero.footfalls: ticks), the notes (gold flags) and
// what the checks found (red and amber ticks). Drag anywhere on it to scrub.
const LEFT = '#6cb4ff', RIGHT = '#ffa850';

export class Timeline {
  constructor(canvas, onSeek) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.onSeek = onSeek; this.data = null; this.drag = false;
    const at = (e) => { const b = canvas.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - b.left - 6) / (b.width - 12))); };
    canvas.addEventListener('pointerdown', (e) => { this.drag = true; canvas.setPointerCapture(e.pointerId); this.onSeek(at(e), true); });
    canvas.addEventListener('pointermove', (e) => { if (this.drag) this.onSeek(at(e), true); });
    const up = () => { if (this.drag) { this.drag = false; this.onSeek(null, false); } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
  // d: { frames, contacts ({ Left: { heel, ball } } of booleans per frame), falls ([{ side, at }]), notes ([frame]), issues ([{ frame, sev }]) }
  set(d) { this.data = d; }
  // fpos: where the play head is, in frames (between two while playing)
  draw(fpos) {
    const c = this.c, g = this.g, dpr = Math.min(devicePixelRatio, 2), W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const d = this.data; if (!d) return; const n = Math.max(2, d.frames), x = (f) => 6 + (W - 12) * f / (n - 1);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
    // the frames: a tick each (when they fit), longer every 5th, numbered every 10th (or 30th)
    const every = (W - 12) / (n - 1) > 4 ? 1 : 5, label = (W - 12) / (n - 1) * 10 > 28 ? 10 : 30;
    g.fillStyle = 'rgba(244,230,196,.35)'; g.font = '10px system-ui, sans-serif'; g.textBaseline = 'top';
    for (let f = 0; f < n; f += every) { const big = f % 5 === 0; g.fillRect(Math.round(x(f)), 0, 1, big ? 7 : 4); if (f % label === 0) { g.fillStyle = 'rgba(244,230,196,.6)'; g.fillText(String(f), x(f) + 2, 1); g.fillStyle = 'rgba(244,230,196,.35)'; } }
    // the feet: two rows
    const rows = [['Left', LEFT, 16], ['Right', RIGHT, 25]];
    for (const [side, col, y] of rows) {
      const C = d.contacts?.[side]; if (!C) continue;
      for (const [k, a] of [['heel', 1], ['ball', 0.45]]) { g.globalAlpha = a; g.fillStyle = col; const list = C[k]; for (let f = 0; f < n; f++) if (list[f]) g.fillRect(x(f) - (W - 12) / (n - 1) / 2, y + (k === 'ball' ? 4 : 0), Math.max(1, (W - 12) / (n - 1)), 4); }
      g.globalAlpha = 1;
    }
    for (const f of d.falls || []) { g.fillStyle = f.side === 'Left' ? LEFT : RIGHT; g.fillRect(Math.round(x(f.at * (n - 1))) - 1, f.side === 'Left' ? 13 : 22, 2, 11); }
    // what the checks found, and the notes
    for (const i of d.issues || []) { if (i.frame === undefined) continue; g.fillStyle = i.sev === 'err' ? '#ff6a50' : i.sev === 'warn' ? '#ffb340' : '#a0a0a0'; g.fillRect(Math.round(x(i.frame)) - 1, H - 9, 3, 9); }
    for (const f of d.notes || []) { const X = x(f); g.fillStyle = '#ffc861'; g.beginPath(); g.moveTo(X, H - 12); g.lineTo(X + 6, H - 16); g.lineTo(X, H - 20); g.closePath(); g.fill(); g.fillRect(X, H - 20, 1, 20); }
    // the play head
    const X = x(Math.min(n - 1, Math.max(0, fpos))); g.fillStyle = '#fff3d6'; g.fillRect(Math.round(X) - 1, 0, 2, H);
  }
}
