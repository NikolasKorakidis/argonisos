// A small pool of world workers shared by terrain and vegetation: post a job, get a promise back.
export class WorkerPool {
  constructor(n) {
    this.workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { const job = this.jobs.get(e.data.id); if (job) { this.jobs.delete(e.data.id); job.busy.n--; job.resolve(e.data); } };
      w.n = 0; return w;
    });
    this.jobs = new Map(); this.seq = 0;
  }
  post(msg) {
    const id = msg.id ?? 'j' + this.seq++, w = this.workers.reduce((a, b) => (b.n < a.n ? b : a));   // least busy
    w.n++;
    return new Promise((resolve) => { this.jobs.set(id, { resolve, busy: w }); w.postMessage({ ...msg, id }); });
  }
  get busy() { return this.jobs.size; }
}
