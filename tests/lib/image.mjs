// Picture comparison for the screenshot tests: shrink a shot by box-averaging (which also smooths away what moves on its
// own from frame to frame, like grass in the wind and drifting pollen), then count the pixels that changed noticeably.
import { PNG } from 'pngjs';

export const read = (buf) => PNG.sync.read(buf);
export const write = (img) => PNG.sync.write(img);

export function shrink(img, k) {
  const w = Math.floor(img.width / k), h = Math.floor(img.height / k), out = new PNG({ width: w, height: h }), n = k * k;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const o = ((y * k + j) * img.width + x * k + i) * 4; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; }
    const o = (y * w + x) * 4; out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return out;
}

// → { changed: share of pixels off by more than `tol` (0–255) in any channel, mean: average difference, diff: a picture
// of the baseline dimmed to grey with the changed pixels in red }
export function compare(a, b, tol = 40) {
  if (a.width !== b.width || a.height !== b.height) return { changed: 1, mean: 255, diff: null };
  const diff = new PNG({ width: a.width, height: a.height }); let changed = 0, sum = 0;
  for (let o = 0; o < a.data.length; o += 4) {
    const d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]));
    sum += d; const grey = (a.data[o] + a.data[o + 1] + a.data[o + 2]) / 9 + 40;
    if (d > tol) { changed++; diff.data[o] = 255; diff.data[o + 1] = 40; diff.data[o + 2] = 40; } else diff.data[o] = diff.data[o + 1] = diff.data[o + 2] = grey;
    diff.data[o + 3] = 255;
  }
  const px = a.data.length / 4;
  return { changed: changed / px, mean: sum / px, diff };
}
