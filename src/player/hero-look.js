// The hero in paint (the Greek reviewer, 23 Nov: "everything: skin, face, clothes and armour, more stylised", the way
// Valheim's people look). The meshes and their palette atlases stay as they are (each part one flat colour from a cell);
// what changes is how that colour is lit and laid on, in one shader shared by every material the hero wears:
//   the light: a soft painted ramp in place of the smooth Lambert falloff (a lit side and a shade side with a soft edge
//     between, every light alike: sun, moon and fire), a warm band where the light turns away on skin, and no glossy
//     highlight on anything but metal, whose highlight is a painted spot with a hard edge;
//   the surface: what each fragment is (skin, cloth, leather, metal, hair or a face's feature: sort, told by its cell or
//     its colour) picks a painted treatment. Cloth gets a coarse weave and leather a mottle, hair streaks; metal a pale
//     painted edge on its bevels and dark creases; folds and crevices are darkened by how concave the surface is there.
//     Skin and the face's features stay clean, so brows, eyes and mouth read from afar. The patterns are laid on the
//     body in its rest pose, in metres (aRest: they don't swim as the body moves), on the shared grid of texels
//     (render/pixel.js: pixelSnap and the Pixel texture setting), so the hero's detail has the world's texels.
// Every material kind is one program (its key), with the same uniforms (PIXEL_U among them).
import * as THREE from 'three';
import { PIXEL, PIXEL_GLSL, PIXEL_U } from '../render/pixel.js';

// Each fragment's kind, as sort sets hKind: SKIN, CLOTH, LEATHER, METAL, HAIR, PLAIN (a face's feature, left as it is)
export const KIND = { skin: '0.0', cloth: '1.0', leather: '2.0', metal: '3.0', hair: '4.0', plain: '5.0' };
// How many of the world's texels to one of the hero's: the world's are 14 cm (Mild), a body's width; the hero's 3.5 cm
const DENSER = 4;

const VERT_PARS = 'attribute vec4 aRest; attribute vec3 aRestN; varying vec4 vRest; varying vec3 vRestN;';
const FRAG_PARS = `${PIXEL_GLSL}
  varying vec4 vRest; varying vec3 vRestN;
  float hKind = 5.0;   // (what this fragment is: KIND in hero-look.js)
  float hLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 hMute(vec3 c, float k) { return mix(vec3(hLuma(c)), c, k); }   // (the atlas's colours less saturated, Valheim's muted ones)
  float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Gold and bronze told by their colour (bright, yellow to orange, little blue: not leather, cloth or skin)
  // (or a bright pink-orange: the Corinthian set's bronze, which is redder)
  float hMetal(vec3 c) { float r = max(c.r, 1e-3), gr = c.g / r, br = c.b / r; return max(smoothstep(0.15, 0.28, c.r) * smoothstep(0.42, 0.55, gr) * (1.0 - smoothstep(0.18, 0.3, br)),
    step(0.3, c.r) * step(0.38, gr) * step(gr, 0.6) * step(br, 0.36)); }
  // Leather told by its colour: dark, warm and not grey (straps, belts, sandals)
  float hLeather(vec3 c) { float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); return step(c.b, c.g) * step(c.g, c.r) * step(0.3, (mx - mn) / max(mx, 1e-3)) * step(mx, 0.3); }
  // The painted detail, on the face of the rest pose's box that the surface turns to most (a flat projection: no blur
  // between projections, as a painter's strokes go one way or the other), on the texel grid
  vec3 hPaint(vec3 c) {
    vec3 a = abs(vRestN); vec2 p = a.x > a.y && a.x > a.z ? vRest.zy : a.y > a.z ? vRest.xz : vRest.xy;
    float D = (uTexel > 0.0 ? uTexel : ${PIXEL.mild.toFixed(1)}) * ${DENSER.toFixed(1)}, cav = vRest.w;
    vec2 g = pixelSnap(p, uTexel > 0.0 ? D : 0.0) * D, cell = floor(g), f = fract(g);
    // (no detail where a texel would come under a pixel or so: it would only shimmer)
    float fine = 1.0 - smoothstep(0.4, 0.9, max(length(dFdx(p)), length(dFdy(p))) * D), n = hHash(cell);
    float fold = smoothstep(0.02, 0.3, cav), ridge = smoothstep(0.03, 0.25, -cav);
    // (lit from above in the paint itself, as hand-painted models are: the sky's light, which lights the hero more than
    // the sun does, then still shapes the form; skin's darker side warmer, as a painter shades it; the face's features
    // left as they are)
    float top = smoothstep(-0.6, 0.8, vRestN.y); if (hKind < 4.5) c *= hKind < 0.5 ? mix(vec3(0.84, 0.74, 0.7), vec3(1.08), top) : vec3(0.8 + 0.28 * top);
    if (hKind < 0.5) {   // skin: clean, only its hollows a little darker and redder (under the brow, by the nose)
      c *= mix(vec3(1.0), vec3(0.82, 0.68, 0.62), fold * 0.8);
    } else if (hKind < 1.5) {   // cloth: over and under threads, a little uneven, the folds dark, the ridges caught
      float over = mod(cell.x + cell.y, 2.0), th = over > 0.5 ? f.y : f.x, w = mix(0.965, 1.03, over) * (1.0 - 0.1 * pow(2.0 * th - 1.0, 2.0)) * (0.955 + 0.09 * n);   // (faint: a painted cloth, not a gingham)
      c *= mix(1.0, w, fine) * (1.0 - 0.45 * fold) * (1.0 + 0.12 * ridge) * (1.0 - 0.2 * smoothstep(0.4, 0.9, hLuma(c)));   // (white undyed wool, never paper white)
    } else if (hKind < 2.5) {   // leather: darker, in blotches two texels across, worn paler on its edges
      c *= 0.8 * mix(1.0, 0.9 + 0.18 * hHash(floor(g * 0.5)), fine) * (1.0 - 0.4 * fold) * (1.0 + 0.25 * ridge);
    } else if (hKind < 3.5) {   // metal: a darker body lit from above, pale paint on its bevels, its creases dark
      c = hMute(c, 1.2) * (0.6 + 0.3 * clamp(vRestN.y * 0.5 + 0.5, 0.0, 1.0)) * mix(1.0, 0.94 + 0.1 * n, fine);   // (richer than the rest: gold must still read as gold)
      c = mix(c, min(c * 1.9, vec3(1.0)), 0.75 * smoothstep(0.06, 0.3, -cav)) * (1.0 - 0.5 * fold);   // (the bevels in the metal's own hue, paler)
    } else if (hKind < 4.5) {   // hair: streaks down it (each texel column its own, in runs of four), its clumps' crevices dark
      c *= mix(1.0, 0.82 + 0.3 * hHash(vec2(cell.x, floor(cell.y * 0.25))), fine) * (1.0 - 0.5 * fold) * (1.0 + 0.15 * ridge);
    }
    return c;
  }`;
// The light, painted: the ramp, the warm edge on skin, metal's spot (the rest of three's lighting, shadows and the sky's
// light from every side, as for every other material)
const LIGHT = `
  void RE_Direct_Hero( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
    float nl = dot( geometryNormal, directLight.direction ), w = saturate( nl * 0.85 + 0.15 );
    float ramp = 0.62 * smoothstep( 0.12, 0.34, w ) + 0.3 * smoothstep( 0.34, 1.0, w );   // (the lit side nearly flat, the shade side flat: one soft edge between)
    vec3 irr = ramp * directLight.color;
    float edge = exp( -pow( ( nl - 0.04 ) / 0.15, 2.0 ) );   // (where the light turns away: warm on skin, as blood shows through it)
    irr += directLight.color * edge * ( hKind < 0.5 ? vec3( 0.26, 0.1, 0.04 ) : vec3( 0.04, 0.025, 0.01 ) );
    reflectedLight.directDiffuse += irr * BRDF_Lambert( material.diffuseColor );
    if ( hKind > 2.5 && hKind < 3.5 ) {
      float nh = saturate( dot( geometryNormal, normalize( directLight.direction + geometryViewDir ) ) );
      reflectedLight.directSpecular += directLight.color * smoothstep( 0.86, 0.92, nh ) * step( 0.0, nl ) * mix( material.diffuseColor, vec3( 1.0 ), 0.45 ) * 0.32;
    }
  }
  #undef RE_Direct
  #define RE_Direct RE_Direct_Hero`;

// A material of the hero's: map and colour as before, rough and not metal (metal is painted, not reflected), the
// shader painted as above. key: its program's; U: its own uniforms; pars: their GLSL declarations; sort: GLSL run on
// the colour from the map (q its uv), which recolours it and sets hKind
export function heroMaterial({ map, color = 0xffffff, key, U = {}, pars = '', sort, side = THREE.FrontSide }) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness: 1, metalness: 0, side });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U, PIXEL_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vRestN = aRestN;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\n${pars}\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n{ vec2 q = vMapUv; ${sort} }\ndiffuseColor.rgb = hPaint(diffuseColor.rgb);`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${LIGHT}`);
  };
  m.customProgramCacheKey = () => key;
  m.userData.look = U; return m;
}

// Where each point of the hero lies in the rest pose (in the hero's frame, metres) and the way it faces there, with how
// concave the surface is round it (aRest.w: + in a fold or crease, - on a ridge or bevel), for the painted detail. Once
// per body, after it is dressed, standing in its rest pose; frame: the hero's own group.
export function restLook(meshes, frame) {
  frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert(), v = new THREE.Vector3(), n = new THREE.Vector3(), mw = new THREE.Matrix4(), nm = new THREE.Matrix3();
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, k = P.count; if (!N) continue;
    const rest = new Float32Array(k * 4), rn = new Float32Array(k * 3); nm.getNormalMatrix(mw.multiplyMatrices(inv, m.matrixWorld));
    for (let i = 0; i < k; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).applyMatrix4(inv); rest[i * 4] = v.x; rest[i * 4 + 1] = v.y; rest[i * 4 + 2] = v.z;
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); rn[i * 3] = n.x; rn[i * 3 + 1] = n.y; rn[i * 3 + 2] = n.z;
    }
    hollows(g, rest, rn);
    g.setAttribute('aRest', new THREE.BufferAttribute(rest, 4)); g.setAttribute('aRestN', new THREE.BufferAttribute(rn, 3));
  }
}
// How concave the surface is at each point: the mean of how far its neighbours rise over the plane it faces (their
// direction against its normal). The points split at a seam or a hard edge are taken together (welded by place, their
// normals averaged), so a bevel's edge counts as a ridge and a crease as a fold on both sides of it.
function hollows(g, rest, rn) {
  const k = rest.length / 4, weld = new Int32Array(k), at = new Map(), pos = [], nor = [];
  for (let i = 0; i < k; i++) {
    const key = `${Math.round(rest[i * 4] * 2000)},${Math.round(rest[i * 4 + 1] * 2000)},${Math.round(rest[i * 4 + 2] * 2000)}`;
    let w = at.get(key); if (w === undefined) { w = pos.length / 3; at.set(key, w); pos.push(rest[i * 4], rest[i * 4 + 1], rest[i * 4 + 2]); nor.push(0, 0, 0); }
    weld[i] = w; nor[w * 3] += rn[i * 3]; nor[w * 3 + 1] += rn[i * 3 + 1]; nor[w * 3 + 2] += rn[i * 3 + 2];
  }
  const W = pos.length / 3, sum = new Float32Array(W), cnt = new Float32Array(W);
  for (let w = 0; w < W; w++) { const l = Math.hypot(nor[w * 3], nor[w * 3 + 1], nor[w * 3 + 2]) || 1; nor[w * 3] /= l; nor[w * 3 + 1] /= l; nor[w * 3 + 2] /= l; }
  const I = g.index ? g.index.array : Array.from({ length: k }, (_, i) => i);
  const side = (a, b) => {
    const dx = pos[b * 3] - pos[a * 3], dy = pos[b * 3 + 1] - pos[a * 3 + 1], dz = pos[b * 3 + 2] - pos[a * 3 + 2], l = Math.hypot(dx, dy, dz); if (l < 1e-6) return;
    sum[a] += (dx * nor[a * 3] + dy * nor[a * 3 + 1] + dz * nor[a * 3 + 2]) / l; cnt[a]++;
  };
  for (let t = 0; t + 2 < I.length; t += 3) { const a = weld[I[t]], b = weld[I[t + 1]], c = weld[I[t + 2]]; side(a, b); side(b, a); side(b, c); side(c, b); side(a, c); side(c, a); }
  for (let i = 0; i < k; i++) { const w = weld[i]; rest[i * 4 + 3] = cnt[w] ? sum[w] / cnt[w] : 0; }
}
