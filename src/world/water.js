// Water: one shader for the open sea and the Valtos marsh. Depth colour comes from the world height texture (baked by the
// terrain worker), with ripples, fresnel sky reflection, sun glints, caustics in the shallows and lapping shoreline foam.
// Where the swamp mask is set the water turns murky green-brown and grows rafts of duckweed.
import * as THREE from 'three';
import { scene, waterNormals } from '../render/core.js';

export const WATER_U = { uTime: { value: 0 }, uH: { value: null }, uHExt: { value: 4096 }, uNorm: { value: waterNormals }, uSky: { value: new THREE.Color(0x3a78c8) },
  uHor: { value: new THREE.Color(0xb8dcf0) }, uDay: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff1d6) } };
export function makeWaterMat({ level, shallow, deep, foam = 1, depthScale = 6, clarity = 1, weed = 0, ripple = 1 }) {
  const u = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), WATER_U,
    { uLevel: { value: level }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: foam }, uDS: { value: depthScale }, uClar: { value: clarity },
      uWeed: { value: weed }, uRip: { value: ripple } });
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, fog: true, depthWrite: false,
    vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform float uTime, uLevel, uFoam, uDS, uClar, uWeed, uRip, uDay, uHExt; uniform sampler2D uH, uNorm; uniform vec3 uShallow, uDeep, uSky, uHor, uSunDir, uSunCol; varying vec3 vW;
      #include <fog_pars_fragment>
      vec3 nrm(vec2 uv){ vec3 t = texture2D(uNorm, uv).rgb * 2.0 - 1.0; return vec3(t.r, t.b, t.g); }
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float t = uTime;
        vec2 huv = vW.xz / uHExt + 0.5;
        vec2 hs = (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) ? texture2D(uH, huv).rg : vec2(-40.0, 0.0);
        float ground = hs.r, marsh = smoothstep(0.35, 0.75, hs.g);
        float depth = max(uLevel - ground, 0.0);
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        // three ripple scales; far away the small ones fade so the surface doesn't sparkle into noise
        float nk = mix(1.0, 0.3, smoothstep(40.0, 280.0, dist));
        vec3 n1 = nrm(vW.xz * 0.035 * uRip + vec2(t * 0.02, t * 0.013)), n2 = nrm(vW.xz * 0.11 * uRip - vec2(t * 0.03, -t * 0.021)), n3 = nrm(vW.xz * 0.008 + vec2(-t * 0.004, t * 0.006));
        vec3 n = normalize(vec3((n1.x + n2.x * 0.7 * nk + n3.x * 1.3) * nk, 3.2, (n1.z + n2.z * 0.7 * nk + n3.z * 1.3) * nk));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        // body colour: light absorbed with depth (Beer-Lambert)
        float ab = 1.0 - exp(-depth / uDS * 2.4);
        vec3 body = mix(mix(uShallow, uDeep, ab), mix(vec3(0.36, 0.42, 0.2), vec3(0.13, 0.19, 0.1), ab), marsh) * mix(vec3(0.07, 0.1, 0.18), vec3(1.0), uDay);   // water darkens to moonlit blue at night
        // caustics dancing on the shallow bottom
        vec2 cp = vW.xz * 0.42 + n.xz * 0.8;
        float c1 = abs(sin(cp.x * 1.7 + t * 1.1 + sin(cp.y * 1.3 - t * 0.7) * 1.6)), c2 = abs(sin(cp.y * 1.9 - t * 0.9 + sin(cp.x * 1.1 + t * 0.6) * 1.5));
        body += pow(1.0 - min(c1, c2), 7.0) * (1.0 - ab) * smoothstep(0.05, 0.7, depth) * 0.45 * min(uClar, 1.5) * (1.0 - max(uWeed, marsh) * 0.8);
        // reflection: sky gradient with drifting cloud shapes, and the sun
        vec3 R = reflect(-V, n);
        vec3 refl = mix(uHor, uSky, clamp(R.y * 1.5, 0.0, 1.0));
        float cl = vn(R.xz / (R.y + 0.3) * 1.6 + vec2(t * 0.015, 0.0)) * 0.65 + vn(R.xz / (R.y + 0.3) * 4.0) * 0.35;
        refl = mix(refl, vec3(1.0), smoothstep(0.55, 0.8, cl) * 0.35 * clamp(R.y * 3.0, 0.0, 1.0));
        refl *= mix(1.0, 0.5, marsh);                       // the marsh is dark and peaty: a dull, tea-coloured mirror
        vec3 col = mix(body, refl, clamp(F * 0.85 + 0.04, 0.0, 1.0));
        vec3 Hh = normalize(normalize(uSunDir) + V); float sp = max(dot(n, Hh), 0.0);
        col += uSunCol * (pow(sp, 320.0) * 3.2 + pow(sp, 45.0) * 0.1) * (1.0 - max(uWeed, marsh) * 0.6);
        // shoreline: a solid wet line plus foam lapping in and out, broken up by noise
        float edge = 1.0 - smoothstep(0.0, 1.0, depth);
        float nz = texture2D(uNorm, vW.xz * 0.07 + vec2(t * 0.01, -t * 0.007)).r;
        float lap = smoothstep(0.6, 0.95, sin(depth * 8.0 - t * 1.5 + nz * 5.0) * 0.5 + 0.5);
        float foam = clamp(pow(edge, 3.0) * 1.3 + lap * edge * 0.9, 0.0, 1.0) * smoothstep(0.3, 0.62, nz + edge * 0.45) * uFoam * (1.0 - marsh);   // still marsh pools don't foam
        col = mix(col, vec3(0.96, 0.98, 1.0) * mix(0.25, 1.0, uDay), foam * 0.85);
        // marsh: floating duckweed rafts
        float wk = 0.0;
        float weedK = max(uWeed, marsh);
        if (weedK > 0.0) { float w = vn(vW.xz * 0.11) * 0.6 + vn(vW.xz * 0.45) * 0.4; wk = smoothstep(0.52, 0.6, w) * weedK;
          col = mix(col, vec3(0.2, 0.31, 0.09) * (0.75 + 0.5 * vn(vW.xz * 3.0)), wk); }
        float alpha = mix(0.4, 0.97, smoothstep(0.0, 1.6 / uClar, depth));
        alpha = max(alpha, max(foam, wk)) * smoothstep(0.0, 0.05, depth + foam * 0.05);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The sea: a large plane at sea level that follows the camera in steps (its pattern is world-space, so it never swims)
export const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1).rotateX(-Math.PI / 2), makeWaterMat({ level: 0, shallow: 0x4ad3c8, deep: 0x0a3b66, foam: 1, depthScale: 7 }));
sea.renderOrder = 1; sea.frustumCulled = false; scene.add(sea);
export function setHeightTexture({ data, N, extent }) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  WATER_U.uH.value = t; WATER_U.uHExt.value = extent; return t;
}
export function updateWater(time, camPos, light, skyDome, sunDir, moonDir) {
  WATER_U.uTime.value = time; WATER_U.uDay.value = Math.min(1, light.day + light.dusk * 0.3);
  WATER_U.uSky.value.copy(skyDome.material.uniforms.top.value); WATER_U.uHor.value.copy(skyDome.material.uniforms.hor.value);
  WATER_U.uSunDir.value.copy(sunDir.y > 0 ? sunDir : moonDir);
  WATER_U.uSunCol.value.setHex(light.day > 0.1 ? (light.dusk > 0.4 ? 0xffb070 : 0xfff1d6) : 0x7088b8).multiplyScalar(0.3 + light.day * 0.7);
  sea.position.set(Math.round(camPos.x / 100) * 100, 0, Math.round(camPos.z / 100) * 100);
}
