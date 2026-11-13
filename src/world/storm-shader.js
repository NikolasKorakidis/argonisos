// The storm wall's shaders (stormwall.js): the cloud noise baked once into a 3D texture, the march through the cloud at
// a quarter of the resolution and its softening (the atmosphere pass lays the result over the frame), the bolts of
// lightning and the dust swept into the wall.
// The cloud is a volume, not a sheet: its shape comes from how far each point lies inside the marsh's border (a 2D
// field, `tField`: r the signed distance in metres, inside Valtos positive, g the smoothed ground) and how high it is
// above the ground. How far the cloud reaches out past the border at each height (`reach`) gives the storm its profile:
// a dark foot on the border, a shelf cloud jutting out over the land with a flat, ragged underside, a towering wall,
// and an anvil spreading out at the top some 800 m up. Noise (Perlin-Worley, as in Horizon Zero Dawn's clouds) pushes
// that surface in and out into billows and towers, turning slowly round the marsh and rolling upward as it goes.

// ---- The noise, baked into a 64³ texture that tiles: r Perlin-Worley (billows with soft gaps), g and b Worley at two
// finer scales (cauliflower detail), a Perlin fBm (to warp the others)
export const NOISE_FRAG = `
  uniform float uZ; varying vec2 vUv;
  vec3 h33(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453123); }
  float perlin(vec3 x, float P) {
    vec3 i = floor(x), f = fract(x), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); float r[8];
    for (int k = 0; k < 8; k++) { vec3 c = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)); r[k] = dot(normalize(h33(mod(i + c, P)) * 2.0 - 1.0), f - c); }
    return mix(mix(mix(r[0], r[1], u.x), mix(r[2], r[3], u.x), u.y), mix(mix(r[4], r[5], u.x), mix(r[6], r[7], u.x), u.y), u.z);
  }
  float worley(vec3 x, float P) {
    vec3 i = floor(x), f = fract(x); float d = 1.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int k = -1; k <= 1; k++) { vec3 c = vec3(float(k), float(y), float(z)); d = min(d, length(c + h33(mod(i + c, P)) - f)); }
    return d;
  }
  float wfbm(vec3 p, float P) { return (1.0 - worley(p * P, P)) * 0.625 + (1.0 - worley(p * P * 2.0, P * 2.0)) * 0.25 + (1.0 - worley(p * P * 4.0, P * 4.0)) * 0.125; }
  float pfbm(vec3 p, float P) { return perlin(p * P, P) * 0.6 + perlin(p * P * 2.0, P * 2.0) * 0.3 + perlin(p * P * 4.0, P * 4.0) * 0.15; }
  float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
  void main() {
    vec3 p = vec3(vUv, uZ);
    float pf = clamp(pfbm(p, 4.0) * 0.7 + 0.5, 0.0, 1.0), w4 = wfbm(p, 4.0);
    // (each stretched over the whole 0..1, from the ranges they come out in)
    float pw = clamp(remap(pf, w4 - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
    gl_FragColor = clamp(vec4((pw - 0.5) / 0.33, (wfbm(p, 8.0) - 0.12) / 0.75, (wfbm(p, 16.0) - 0.12) / 0.75, (pfbm(p, 2.0) * 0.7 + 0.5 - 0.36) / 0.32), 0.0, 1.0);
  }`;

// ---- What the march and the spread share
const COMMON = `
  precision highp sampler3D;
  uniform sampler2D tDepth, tField; uniform sampler3D tNoise;
  uniform mat4 projInv, camWorld; uniform vec3 camPos; uniform vec2 fullRes, camNF;
  uniform vec4 bounds; uniform vec3 field; uniform vec2 centre; uniform float uT, uTop, scale;
  vec3 worldAt(vec2 uv, float d) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (camWorld * v).xyz; }
  vec2 fieldAt(vec2 xz) { return texture2D(tField, ((xz + field.x) / field.y + 0.5) / field.z).rg; }
  // how far past the border (metres, out over the land) the cloud reaches at a height above the ground: a foot standing
  // just inside it, the shelf jutting out with its flat underside at some 55 m and its top sloping back to the wall, the
  // wall itself leaning out a little as it climbs, and the anvil spreading out over the land near the top
  float reach(float h) {
    float shelf = 125.0 * smoothstep(46.0, 64.0, h) * (1.0 - smoothstep(70.0, 290.0, h));
    float wall = -4.0 + 46.0 * smoothstep(0.0, 260.0, h), anvil = 320.0 * smoothstep(470.0, 760.0, h);
    return max(max(shelf, wall), anvil);
  }
  float amp(float h) { return 26.0 + 0.13 * max(h, 0.0); }   // (how far the billows push in and out: bigger higher up)
  vec3 turn(vec3 p, float a) { vec2 c = p.xz - centre; float s = sin(a), k = cos(a); vec2 r = centre + vec2(k * c.x - s * c.y, s * c.x + k * c.y); return vec3(r.x, p.y, r.y); }`;

export const MARCH_FRAG = `${COMMON}
  uniform vec3 sunDir, sunCol, ambCol, fogCol, flashCol, glowCol, mzCol; uniform float fogV, fogMax, glow, mzR1, mzAmt, mzTop, mzSoft;
  uniform vec4 flashP[4]; uniform float flashI[4]; uniform vec4 caves[4];
  // The cloud's surface at a point: how far inside it the point lies (metres; negative outside). The border field and
  // the profile give the smooth wall; on it great lobes and towers (taller than wide, warped), turning slowly round the
  // marsh, faster higher up; over them billows a hundred metres across rolling upward and turning a little faster, so it
  // churns on itself. lo and mid are handed back for the light.
  float envAt(vec3 p, out float h, out float lo, out float mid) {
    vec2 fg = fieldAt(p.xz); h = p.y - fg.y;
    vec4 L = texture(tNoise, turn(p, uT * (0.0014 + h * 0.000003)) / vec3(1500.0, 2200.0, 1500.0));
    vec3 q = turn(p, uT * (0.0024 + h * 0.000005)) + (L.a - 0.5) * vec3(260.0, 160.0, 260.0) - vec3(0.0, uT * 1.4, 0.0);
    lo = L.r; mid = texture(tNoise, q / 800.0).g;
    return fg.x + reach(h) + (lo - 0.5) * 2.0 * amp(h) * 1.7 + (mid - 0.5) * 2.0 * (18.0 + 0.04 * max(h, 0.0));
  }
  bool box(vec3 ro, vec3 rd, vec3 lo, vec3 hi, out float t0, out float t1) {
    vec3 inv = 1.0 / rd, a = (lo - ro) * inv, b = (hi - ro) * inv, mn = min(a, b), mx = max(a, b);
    t0 = max(max(mn.x, mn.y), mn.z); t1 = min(min(mx.x, mx.y), mx.z); return t1 > max(t0, 0.0);
  }
  void main() {
    vec2 uv = ((gl_FragCoord.xy - 0.5) * scale + 0.5) / fullRes; float d = texture2D(tDepth, uv).x;   // (the depth at one pixel of the patch this texel stands for)
    vec3 P = worldAt(uv, min(d, 0.9999)), rd = normalize(P - camPos); float tEnd = d < 0.99999 ? length(P - camPos) : 9000.0;
    float t0, t1; gl_FragColor = vec4(0.0);
    if (!box(camPos, rd, vec3(bounds.x, -40.0, bounds.y), vec3(bounds.z, uTop + 260.0, bounds.w), t0, t1)) return;
    t0 = max(t0, 0.0); t1 = min(t1, tEnd); if (t0 >= t1) return;
    // (a fixed dither on where each pixel's steps fall, against banding; fixed on the screen, so it never flickers)
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float t = t0, T = 1.0; vec3 L = vec3(0.0), surf = vec3(0.0); bool first = true, lit0 = false;
    // the player's mist, laid as the atmosphere pass lays it on what lies past its far edge (by where the line of sight is
    // when it reaches that edge), but only over the storm's foot: its towers rise clear of it, however high you stand
    float mist = mzAmt * (1.0 - smoothstep(mzTop - mzSoft, mzTop + mzSoft, camPos.y + rd.y * (mzR1 / max(length(rd.xz), 1e-3))));
    for (int i = 0; i < 64; i++) {
      if (t >= t1 || T < 0.04) break;
      vec3 p = camPos + rd * t; vec2 fg = fieldAt(p.xz); float h = p.y - fg.y;
      float edge = fg.x + reach(h) + amp(h) * 1.7 + 18.0 + 0.04 * h, r = length(p.xz);
      // nowhere near the cloud: stride on through the empty air by as much as the cloud is away (the border field
      // gives the distance), or straight on past its top
      if (h > uTop + 250.0) { if (rd.y >= 0.0) break; t += max((h - uTop - 250.0) / -rd.y, 0.0) + 3.0; continue; }   // (above it all: down to its top, or away)
      if (r > 2650.0) { t += 100.0; continue; }   // (past where its arms end, out at sea)
      if (edge < 0.0) { t += clamp(-edge * 0.8, 3.0, 250.0); continue; }
      float dt = clamp(t * 0.022, 2.0, 60.0);   // (longer strides further off, where a pixel spans more)
      if (first) { first = false; t += dt * jit; p = camPos + rd * t; }
      float lo, mid, env = envAt(p, h, lo, mid);
      // the tops: domed and ragged, thinning into the sky; the bottom on the ground. Where the border runs out to sea the
      // wall's arms sink and fray away into a trailing storm, raggedly, rather than ending in a cut
      float tail = smoothstep(1650.0, 2450.0, r + (lo - 0.5) * 260.0), fade = 1.0 - smoothstep(2250.0, 2600.0, r + (lo - 0.5) * 300.0 + (mid - 0.5) * 80.0);
      float topH = (uTop + (lo - 0.5) * 260.0 + (mid - 0.5) * 80.0) * (1.0 - tail * 0.85), dens = smoothstep(0.0, 30.0, env) * smoothstep(topH, topH - 120.0, h) * smoothstep(-25.0, 10.0, h) * fade;
      // the skin frays into wisps: finer billows eaten out of it, boiling upward
      if (env < 60.0 && dens > 0.0 && t < 900.0) { float det = texture(tNoise, turn(p, uT * 0.004) / 320.0 - vec3(0.0, uT * 0.006, 0.0)).b; dens = clamp(dens - (1.0 - det) * 0.8 * (1.0 - smoothstep(0.0, 60.0, env)), 0.0, 1.0); }
      // rain hanging in sheets under the shelf, from its underside to the ground, streaked and falling
      float rain = 0.0;
      if (h < 75.0 && fg.x > -135.0 && fg.x < 10.0 && t < 1200.0) { float s = texture(tNoise, vec3(turn(p, uT * 0.003).xz / mix(60.0, 260.0, smoothstep(150.0, 1500.0, t)), (p.y + uT * 26.0) / 900.0).xzy).g; rain = 0.15 * smoothstep(0.45, 0.8, s) * smoothstep(-135.0, -70.0, fg.x) * (1.0 - smoothstep(50.0, 70.0, h)); }
      float near = smoothstep(1.0, 14.0, t); dens *= near; rain *= near;   // (up close it parts like mist rather than meeting you as a sheet)
      // none in the Giants' caves by the border: their chambers are hollowed out of hills (the land's height there is the
      // cave's floor), so there is air under the rock that the cloud would otherwise fill
      for (int k = 0; k < 4; k++) { vec4 c = caves[k]; if (c.w > 0.0 && p.y < c.y + 30.0 && length(p.xz - c.xz) < c.w) { dens = 0.0; rain = 0.0; } }
      float a = 1.0 - exp(-(dens * 0.065 + rain * 0.02) * dt);
      // the electric glow on the boundary, low down: Zeus's ward, crackling where the cloud's skin meets the land
      float zap = glow * exp(-abs(env - 6.0) / 9.0) * (1.0 - smoothstep(0.0, 260.0, h)) * pow(mid, 5.0) * 6.0;
      if (a > 0.0005 || zap > 0.0005) {
        // the light of the cloud's surface where the ray first meets it (its slope from the field and noise round it):
        // the sun on the sides that face it, the sky's light on what faces up, the underside of the shelf in the dark
        if (!lit0 && dens > 0.05) {
          lit0 = true; float hh, l2, m2, e = 30.0;
          vec3 g = vec3(envAt(p + vec3(e, 0.0, 0.0), hh, l2, m2), envAt(p + vec3(0.0, e, 0.0), hh, l2, m2), envAt(p + vec3(0.0, 0.0, e), hh, l2, m2)) - env;
          vec3 N = -normalize(g + 1e-4), hz = vec3(0.0, smoothstep(-30.0, uTop, h), 0.0);
          float sun = clamp(dot(N, sunDir) * 0.6 + 0.4, 0.0, 1.0), sky = clamp(0.5 + 0.5 * N.y, 0.0, 1.0);
          surf = ambCol * sky * (0.06 + 0.94 * hz.y * hz.y) + sunCol * sun * sun * (0.05 + 0.95 * hz.y * hz.y);   // (the lower half sunk in its own shadow)
        }
        // and within that, each billow lit on its upper side and in shade below, darker the deeper in
        float skin = exp(-max(env, 0.0) / 45.0), bump = 0.55 + (mid - 0.5) * 1.4 + (lo - 0.5) * 0.6;
        vec3 c = (lit0 ? surf : ambCol * 0.1) * max(bump, 0.05) * max(bump, 0.05) * 1.6 * (0.2 + 0.8 * skin) * 0.4;
        c = mix(c, ambCol * 0.35, rain / max(rain + dens, 1e-3) * 0.7);
        // lightning inside the cloud, lighting it from within
        float fl = 0.0; for (int k = 0; k < 4; k++) if (flashI[k] > 0.0) fl += flashI[k] * exp(-length(p - flashP[k].xyz) / flashP[k].w);
        float fk = min(fogMax, 1.0 - exp(-t / fogV));
        c = mix(mix(c, fogCol, fk), mzCol, mist * (1.0 - smoothstep(60.0, 220.0, h))) + flashCol * fl * (0.3 + 0.7 * skin) * max(bump, 0.2) * (1.0 - fk * 0.7);
        L += T * (a * c + glowCol * zap * dt * 0.01 * (1.0 - fk));
        T *= 1.0 - a;
      }
      t += dt;
    }
    if (T < 0.04) T = 0.0;
    gl_FragColor = vec4(L, 1.0 - T);
    if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);   // (never let a bad sample spread through the bloom)
  }`;

// ---- The march softened: each texel with the eight round it (a tent), each counted as much as the depth it was marched
// against is the same as this one's, so the dither in where the steps fall melts away but a tree's edge stays an edge.
// (The atmosphere pass lays the result over the frame: atmosphere.js stormAt.)
export const BLUR_FRAG = `${COMMON}
  uniform sampler2D tStorm; uniform vec2 halfRes;
  float zAt(vec2 ih) { float d = texture2D(tDepth, (ih * scale + 0.5) / fullRes).x; return camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)); }
  void main() {
    vec2 i0 = gl_FragCoord.xy - 0.5; float z0 = zAt(i0); vec4 acc = vec4(0.0); float tot = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 ih = clamp(i0 + vec2(float(x), float(y)), vec2(0.0), halfRes - 1.0);
      float w = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0) / (1.0 + abs(zAt(ih) - z0) / (0.03 * z0 + 0.3));
      acc += texture2D(tStorm, (ih + 0.5) / halfRes) * w; tot += w;
    }
    gl_FragColor = acc / tot;
  }`;

// ---- The scene's depth kept as distance from the eye while a bolt is lit, for the bolts drawn after the atmosphere pass
// (by then the depth has been written over)
export const KEEP_FRAG = `
  uniform sampler2D tDepth; uniform vec2 camNF; varying vec2 vUv;
  void main() { float d = texture2D(tDepth, vUv).x; gl_FragColor = vec4(d > 0.99999 ? 60000.0 : camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)), 0.0, 0.0, 1.0); }`;

// ---- A bolt of lightning: each segment a ribbon turned to face the camera, a white-hot core in a blue glow, drawn after
// the atmosphere pass (over the storm cloud it strikes out of) and hidden behind whatever stands in front of it
export const BOLT_VERT = `
  attribute vec3 aB; attribute vec2 aSide; attribute float aBolt; uniform vec3 camPos; uniform float boltI[4];
  varying float vX, vI, vDist;
  void main() {
    vec3 a = position, b = aB, p = mix(a, b, aSide.y), dir = normalize(b - a + 1e-4), v = normalize(p - camPos);
    float dist = length(p - camPos), w = aSide.x * max(2.2, dist * 0.004) * (aBolt < 0.0 ? 0.0 : 1.0);
    vec3 side = normalize(cross(dir, v) + 1e-5); p += side * w * 3.0;
    vX = sign(aSide.x) * 3.0; vI = boltI[int(abs(aBolt))] * abs(aSide.x); vDist = dist;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
export const BOLT_FRAG = `
  uniform sampler2D tLin; uniform vec2 fullRes, camNF; uniform vec3 boltCol; uniform float fogV;
  varying float vX, vI, vDist;
  float lin(float d) { return camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)); }
  void main() {
    if (vI <= 0.0) discard;
    if (texture2D(tLin, gl_FragCoord.xy / fullRes).r < lin(gl_FragCoord.z) - 2.0) discard;
    float x = abs(vX), core = exp(-x * x * 6.0), halo = exp(-x * 0.9) * 0.45;
    gl_FragColor = vec4(boltCol * vI * (core * 3.0 + halo) * exp(-vDist / (fogV * 1.6)), 1.0);   // (alpha 1: additive blending weighs by it)
  }`;

// ---- Dust and leaves swept along the ground into the wall near it: a box of motes round the camera, each on its own
// path, drifting in on the wind and lifted as they near the cloud
export const DUST_VERT = `
  attribute vec4 aSeed; uniform vec3 camPos; uniform vec2 inward; uniform float uT, amount, speed, pxScale;
  varying float vA, vK;
  void main() {
    float B = 70.0; vec3 o = (aSeed.xyz - 0.5) * vec3(B, 1.0, B);
    vec2 drift = inward * uT * speed * (0.6 + aSeed.w * 0.8) + vec2(sin(uT * 1.3 + aSeed.w * 40.0), cos(uT * 1.1 + aSeed.x * 30.0)) * 1.5;
    vec2 xz = mod(o.xz + drift - camPos.xz + B * 0.5, B) - B * 0.5;
    float along = dot(xz, inward);   // (lifted as they go in)
    vec3 p = vec3(camPos.x + xz.x, camPos.y - 1.5 + aSeed.y * 6.0 + max(along, 0.0) * 0.35 + sin(uT * 3.0 + aSeed.z * 20.0) * 0.4, camPos.z + xz.y);
    vA = amount * (1.0 - smoothstep(B * 0.3, B * 0.5, length(xz))); vK = aSeed.w;
    vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (aSeed.w > 0.8 ? 0.14 : 0.06) * projectionMatrix[1][1] * pxScale / -mv.z;
  }`;
export const DUST_FRAG = `
  uniform vec3 dustCol; varying float vA, vK;
  void main() { vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25 || vA <= 0.0) discard; gl_FragColor = vec4(dustCol * (vK > 0.8 ? 0.8 : 1.0), vA * (1.0 - r * 4.0) * 0.8); }`;
