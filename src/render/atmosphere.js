// The air, painted after the scene from its depth: morning mist that lies in the low ground and thins with height (heavy
// at first light, burning off as the day warms), a haze that glows towards the sun when you look into the light, and
// shafts of sun breaking past trees, trunks and ridges (rays marched towards the sun on the screen, lit wherever the
// sky shows through). All in linear light, before bloom and tone mapping.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from '../../jsm/postprocessing/Pass.js';
import { MIST_R0, MIST_R1 } from '../world/vegetation.js';

export const ATMO = {
  tDiffuse: { value: null }, tDepth: { value: null },
  projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) }, sunUV: { value: new THREE.Vector2(0.5, 0.5) }, sunVis: { value: 0 },
  mistCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, mistAmt: { value: 0 }, mistBase: { value: 0 }, mistH: { value: 14 }, mistDen: { value: 0.012 },
  hazeCol: { value: new THREE.Color(1, 0.75, 0.5) }, hazeAmt: { value: 0 }, rayAmt: { value: 0.5 }, rays: { value: 1 },
  vigOffset: { value: 0.95 }, vigDark: { value: 1.15 },
  // a soft blur on what lies far off, so the end of the view melts into the haze instead of ending in a sharp line
  texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, blurNear: { value: 600 }, blurFar: { value: 1100 }, blurAmt: { value: 1 },
  // the focus (tester feedback, 15 Oct): sharp round the crosshair, softening toward the edges of the screen, so the
  // cheaper detail at the edges of your view isn't noticed (focus: the blur radius in pixels at the screen's edge)
  focus: { value: 3 }, aspect: { value: 16 / 9 },
  // the player's mist (tester feedback, 15 and 16 Oct): clear for MIST_R0 round the hero, thickening to mzAmt by MIST_R1
  // (hiding about two thirds of what lies behind) and staying there, half grown where the grass ends (GRASS_R); up to a
  // ceiling (mzTop) a little over the tallest thing standing near, above which the sky stays clear. It hides how much
  // less is drawn out there (see vegetation.js).
  mzC: { value: new THREE.Vector2() }, mzR0: { value: MIST_R0 }, mzR1: { value: MIST_R1 }, mzAmt: { value: 0.68 }, mzTop: { value: 30 }, mzSoft: { value: 10 }, mzCol: { value: new THREE.Color(0.7, 0.75, 0.8) },
  // the grade (white balance, saturation, a tint in the shadows) and the cloud shadows drifting over the land
  gTint: { value: new THREE.Color(1, 1, 1) }, gSat: { value: 1 }, gShadow: { value: new THREE.Color(0, 0, 0) },
  cloudOff: { value: new THREE.Vector2() }, cloudCover: { value: 0.4 }, cloudK: { value: 0 },
};
const SAMPLES = 32;
export class AtmospherePass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: ATMO, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform mat4 projInv, camWorld; uniform vec3 camPos, sunDir, sunCol, mistCol, hazeCol, mzCol;
        uniform vec2 sunUV, cloudOff, texel, mzC; uniform float blurNear, blurFar, blurAmt, focus, aspect, mzR0, mzR1, mzAmt, mzTop, mzSoft, sunVis, mistAmt, mistBase, mistH, mistDen, hazeAmt, rayAmt, rays, vigOffset, vigDark, gSat, cloudCover, cloudK;
        uniform vec3 gTint, gShadow; varying vec2 vUv;
        float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
        vec3 worldAt(vec2 uv, float d) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (camWorld * v).xyz; }
        void main() {
          vec4 col = texture2D(tDiffuse, vUv); float d = texture2D(tDepth, vUv).x;
          // the blur: the focus (growing from the crosshair toward the edges of the screen) and, far off, a little more
          // with distance; eight taps round a ring that widens with both
          float bk = focus * smoothstep(0.15, 0.85, length((vUv - 0.5) * vec2(aspect, 1.0)));
          vec3 P = worldAt(vUv, min(d, 0.9999)); float dist = length(P - camPos);
          if (d < 0.99999) bk = max(bk, 2.4 * blurAmt * smoothstep(blurNear, blurFar, dist));
          if (bk > 0.05) { vec3 acc = col.rgb; float n = 1.0; for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854 + 0.39; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * texel * bk).rgb; n += 1.0; }
            if (bk > 1.5) for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * texel * bk * 0.5).rgb; n += 1.0; }   // (an inner ring for the wider blur, so it stays smooth)
            col.rgb = acc / n; }
          if (d < 0.99999) {
            vec3 V = P - camPos; vec3 vd = V / max(dist, 1e-3);
            float toSun = max(dot(vd, sunDir), 0.0);
            // cloud shadows: soft patches of shade drifting across the land with the wind
            if (cloudK > 0.001) { vec2 q = (P.xz + cloudOff) * 0.0035; float n = vn(q) * 0.65 + vn(q * 2.3 + 7.1) * 0.35;
              col.rgb *= 1.0 - cloudK * smoothstep(cloudCover, cloudCover + 0.18, n); }
            // mist: density falling off with height above the valley floor, averaged along the ray from the camera's height
            // to the point's (the exact integral of an exponential), so it pools in hollows and thins up on the hills
            float h0 = max(camPos.y - mistBase, 0.0), h1 = max(P.y - mistBase, 0.0), dh = h1 - h0;
            float avg = abs(dh) < 0.05 ? exp(-h0 / mistH) : mistH * (exp(-h0 / mistH) - exp(-h1 / mistH)) / dh;
            float mist = (1.0 - exp(-mistDen * avg * dist)) * mistAmt;
            col.rgb = mix(col.rgb, mistCol + sunCol * pow(toSun, 6.0) * 0.5, clamp(mist, 0.0, 0.92));
            // haze glowing towards the sun, deeper with distance
            col.rgb += hazeCol * pow(toSun, 5.0) * (1.0 - exp(-dist / 900.0)) * hazeAmt;
          }
          // the player's mist: how far out from the hero (across the ground) and how high; for the sky, and for anything past
          // the mist's far edge, where the line of sight is when it reaches that edge, so only the band low over the horizon
          // is covered and nothing far off (a giant tree on a ridge) stands out of the mist above its ceiling
          vec3 rd = normalize(P - camPos); float mpEdge = camPos.y + rd.y * (mzR1 / max(length(rd.xz), 1e-3)), mh = mzR1, mp = mpEdge;
          if (d < 0.99999) { mh = length(P.xz - mzC); mp = mix(P.y, mpEdge, smoothstep(mzR1 * 0.9, mzR1 * 1.1, mh)); }
          col.rgb = mix(col.rgb, mzCol, mzAmt * smoothstep(mzR0, mzR1, mh) * (1.0 - smoothstep(mzTop - mzSoft, mzTop + mzSoft, mp)));
          // shafts of sun: march towards the sun on the screen, gathering light wherever the sky shows through
          if (sunVis > 0.001 && rays > 0.5) {
            vec2 st = (sunUV - vUv) / float(${SAMPLES}) * 0.92, uv = vUv; float lit = 0.0, w = 1.0, tot = 0.0;
            for (int i = 0; i < ${SAMPLES}; i++) { uv += st; float sky = step(0.99999, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x); lit += sky * w; tot += w; w *= 0.95; }
            float fall = 1.0 - smoothstep(0.0, 0.9, length((vUv - sunUV) * vec2(1.6, 1.0)));
            col.rgb += sunCol * (lit / tot) * fall * sunVis * rayAmt;
          }
          // the grade: white balance and saturation for the place and the hour, a cool or warm cast in the shadows
          col.rgb *= gTint; float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722)); col.rgb = max(mix(vec3(l), col.rgb, gSat), 0.0);
          col.rgb += gShadow * (1.0 - smoothstep(0.0, 0.35, l)) * 0.06;
          vec2 vu = (vUv - 0.5) * vigOffset; col.rgb = mix(col.rgb, vec3(1.0 - vigDark), dot(vu, vu));   // the vignette
          gl_FragColor = col;
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    ATMO.tDiffuse.value = readBuffer.texture; ATMO.tDepth.value = readBuffer.depthTexture; ATMO.texel.value.set(1 / readBuffer.width, 1 / readBuffer.height); ATMO.aspect.value = readBuffer.width / readBuffer.height;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); if (this.clear) renderer.clear();
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}

// Per frame: where the camera and the sun are, and how much mist, haze and light there is
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
// The look for the place and the hour: warm and golden in the meadows, cool and green in the forest and under the giants,
// amber at sunrise and sunset, blue and muted at night
const G = { pedias: [1.04, 1.0, 0.93, 1.08, [0.02, 0.0, -0.02]], yleos: [0.95, 1.01, 0.98, 0.96, [-0.02, 0.01, 0.03]], dusk: [1.1, 0.97, 0.84, 1.12, [0.03, -0.01, -0.03]], night: [0.86, 0.93, 1.1, 0.8, [-0.02, 0.0, 0.05]], giant: [0.92, 1.03, 0.94, 0.94, [-0.03, 0.02, 0.0]] };
const _t = new THREE.Color(), _sh = new THREE.Vector3();
function grade(o) {
  const w = { pedias: o.wp * (1 - o.dusk) * (1 - o.night), yleos: o.wy * (1 - o.dusk) * (1 - o.night), dusk: o.dusk * (1 - o.night), night: o.night, giant: o.giant * 1.2 }; let tot = 0;
  _t.setRGB(0, 0, 0); _sh.set(0, 0, 0); let sat = 0;
  for (const k in w) { const g = G[k], a = w[k]; if (a <= 0) continue; tot += a; _t.r += g[0] * a; _t.g += g[1] * a; _t.b += g[2] * a; sat += g[3] * a; _sh.x += g[4][0] * a; _sh.y += g[4][1] * a; _sh.z += g[4][2] * a; }
  tot = Math.max(tot, 1e-3); ATMO.gTint.value.setRGB(_t.r / tot, _t.g / tot, _t.b / tot); ATMO.gSat.value = sat / tot; ATMO.gShadow.value.setRGB(_sh.x / tot, _sh.y / tot, _sh.z / tot);
}
export function updateAtmosphere(camera, o) {
  grade(o);
  ATMO.cloudOff.value.x += o.dt * (3 + o.overcast * 9); ATMO.cloudOff.value.y += o.dt * 1.2;
  ATMO.cloudCover.value = 0.5 - o.overcast * 0.25; ATMO.cloudK.value = 0.28 * o.day * Math.max(0, Math.min(1, (o.sunDir.y - 0.05) / 0.2)) * (1 - o.overcast * 0.7);
  ATMO.projInv.value.copy(camera.projectionMatrixInverse); ATMO.camWorld.value.copy(camera.matrixWorld); ATMO.camPos.value.copy(camera.position);
  ATMO.sunDir.value.copy(o.sunDir).normalize();
  ATMO.sunCol.value.copy(o.sunCol).multiplyScalar(o.sunK);
  ATMO.mistCol.value.copy(o.fogCol).lerp(o.sunCol, 0.15 * o.day).multiplyScalar(0.9 + 0.3 * o.day);
  if (o.fogFar) { ATMO.blurFar.value = o.fogFar * 0.85; ATMO.blurNear.value = o.fogFar * 0.4; }   // (with the fog: high up, where it clears, the blur moves out too)
  if (o.player) ATMO.mzC.value.set(o.player.x, o.player.z);
  if (o.mistTop !== undefined) ATMO.mzTop.value = o.mistTop;
  ATMO.mzCol.value.copy(o.fogCol).lerp(o.sunCol, 0.08 * o.day);
  ATMO.mistAmt.value = o.mist; ATMO.mistBase.value = o.ground - 6; ATMO.mistDen.value = o.mistDen;
  ATMO.hazeCol.value.copy(o.sunCol).multiplyScalar(0.35 * o.sunK); ATMO.hazeAmt.value = (0.25 + o.dusk * 0.9) * o.day;
  // the sun on the screen, and how strongly its shafts show (only with the sun up, ahead of you, and not behind cloud)
  _v.copy(camera.position).addScaledVector(ATMO.sunDir.value, 1000).project(camera);
  camera.getWorldDirection(_f); const ahead = _f.dot(ATMO.sunDir.value);
  ATMO.sunUV.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
  ATMO.sunVis.value = Math.max(0, Math.min(1, (ahead - 0.15) / 0.4)) * Math.max(0, Math.min(1, (o.sunDir.y + 0.02) / 0.12)) * o.day * (1 - o.overcast) * o.rays;
}
