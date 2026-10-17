// A small pool of world workers shared by terrain, vegetation, grass and the map: post a job, get a promise back.
// Jobs wait in one shared queue and go to a worker only when it is free, most urgent first (then oldest first), so a
// small urgent job (the grass under your feet, a near terrain patch) never waits behind a long line of distant
// vegetation blocks already handed to a worker. The order only changes when a job runs, never what it returns.
export const PRIORITY = { background: 0, normal: 1, near: 2, urgent: 3 };
export class WorkerPool {
  constructor(n) {
    this.queue = []; this.seq = 0;
    this.workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      // (a worker has one job at a time, so its reply is that job's: ids can repeat, as when a terrain patch is asked for again)
      w.onmessage = (e) => { const job = w.job; w.job = null; job?.resolve(e.data); this.pump(); };
      w.job = null; return w;
    });
  }
  post(msg, priority = PRIORITY.normal) {
    const id = msg.id ?? 'j' + this.seq++;
    return new Promise((resolve) => {
      const job = { id, msg: { ...msg, id }, resolve, priority, order: this.seq++ };
      let i = this.queue.length; while (i > 0 && this.queue[i - 1].priority < priority) i--;   // (behind every job at least as urgent)
      this.queue.splice(i, 0, job); this.pump();
    });
  }
  pump() {
    for (const w of this.workers) {
      if (w.job || !this.queue.length) continue;
      const job = this.queue.shift(); w.job = job; w.postMessage(job.msg);
    }
  }
  get busy() { return this.workers.filter((w) => w.job).length + this.queue.length; }
}
