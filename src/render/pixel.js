// Texels on the surfaces (the Greek reviewer, 23 Nov: Valheim's look of low-resolution textures with nearest filtering,
// on the world's surfaces themselves, never as a filter over the picture): the detail a surface lays on in its shader
// (the stone's grain and lichen, the bark's furrows, the planks' grain, the ground's litter) is looked up on a grid of
// texels, each about the detail at its middle (filtered over half its square), so every texel is a flat patch of one
// colour and a crack still shows as a line of darker ones, while the light stays per pixel and smooth (a surface's relief
// and normals are worked out from the unsnapped detail). One uniform for every material that uses it, set by the Pixel
// texture setting (settings.js): texels per metre, 0 for none. Where a texel would come under a couple of pixels on the
// screen the snapping fades out, so the distance doesn't shimmer.
//   pixelSnap(p, k): p (any units) snapped to the middle of its texel, k texels to one unit of p, eased back to p itself
//     as the texels shrink on the screen; k 0 leaves p as it is.
//   pixelTex(map, uv, k): a texture looked up at pixelSnap(uv, k), filtered over the whole texel (its mipmap for a texel
//     that size) and, where the snapping has faded, as usual. k: texels to one unit of uv (uTexel × metres per unit; a
//     vec2 where the texture is stretched, k for each way).
// Every program that includes PIXEL_GLSL takes PIXEL_U among its uniforms.
import * as THREE from 'three';

export const PIXEL = { off: 0, mild: 16, strong: 8 };   // (the setting's choices, texels per metre: at seven, as first tried, a rock's cracks and the bark's furrows were lost in the squares)
export const PIXEL_U = { uTexel: { value: PIXEL.mild } };
export const PIXEL_GLSL = `uniform float uTexel;
  float pixelK(vec2 p, vec2 k) { return k.x <= 0.0 ? 0.0 : 1.0 - smoothstep(0.3, 0.65, max(length(dFdx(p) * k), length(dFdy(p) * k))); }
  vec2 pixelSnap(vec2 p, float k) { float s = pixelK(p, vec2(k)); return s <= 0.0 ? p : mix(p, (floor(p * k) + 0.5) / k, s); }
  vec3 pixelSnap(vec3 p, float k) { if (k <= 0.0) return p; float s = 1.0 - smoothstep(0.3, 0.65, max(max(fwidth(p.x), fwidth(p.y)), fwidth(p.z)) * k); return s <= 0.0 ? p : mix(p, (floor(p * k) + 0.5) / k, s); }
  vec4 pixelTex(sampler2D map, vec2 uv, vec2 k) {
    vec2 dx = dFdx(uv), dy = dFdy(uv); float s = pixelK(uv, k);
    if (s <= 0.0) return textureGrad(map, uv, dx, dy);
    vec2 t = 1.0 / k; return textureGrad(map, mix(uv, (floor(uv * k) + 0.5) * t, s), mix(dx, vec2(t.x * 0.5, 0.0), s), mix(dy, vec2(0.0, t.y * 0.5), s));
  }
  vec4 pixelTex(sampler2D map, vec2 uv, float k) { return pixelTex(map, uv, vec2(k)); }
`;
// (for a texture of its own: nearest when magnified, so each of its texels is a flat square close up)
export const nearestUp = (t) => { if (t) { t.magFilter = THREE.NearestFilter; t.needsUpdate = true; } return t; };
