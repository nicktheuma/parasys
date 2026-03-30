import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { SurfaceUvMapping } from '@shared/types'

const noiseGlsl = /* glsl */ `
float _lsm_hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float _lsm_noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(_lsm_hash(p), _lsm_hash(p + vec3(1,0,0)), f.x),
        mix(_lsm_hash(p + vec3(0,1,0)), _lsm_hash(p + vec3(1,1,0)), f.x), f.y),
    mix(mix(_lsm_hash(p + vec3(0,0,1)), _lsm_hash(p + vec3(1,0,1)), f.x),
        mix(_lsm_hash(p + vec3(0,1,1)), _lsm_hash(p + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float _lsm_fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  vec3 pp = p;
  for (int i = 0; i < 5; i++) { v += a * _lsm_noise3(pp); pp *= 2.02; a *= 0.5; }
  return v;
}
float _lsm_voronoi(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  float md = 1.0;
  for (int i = -1; i <= 1; i++)
  for (int j = -1; j <= 1; j++)
  for (int k = -1; k <= 1; k++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = vec3(_lsm_hash(p+g), _lsm_hash(p+g+vec3(13.1,71.7,11.3)), _lsm_hash(p+g+vec3(31.2,18.4,47.9))) - 0.5;
    vec3 r = g + o - f;
    md = min(md, dot(r, r));
  }
  return clamp(1.0 - md * 4.0, 0.0, 1.0);
}
float _lsm_ridged(vec3 p) {
  float v = 0.0, a = 0.5;
  vec3 pp = p;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(_lsm_noise3(pp) * 2.0 - 1.0);
    v += a * n * n;
    pp *= 2.03; a *= 0.5;
  }
  return v;
}
float _lsm_turbulence(vec3 p) {
  float v = 0.0, a = 0.5;
  vec3 pp = p;
  for (int i = 0; i < 5; i++) { v += a * abs(_lsm_noise3(pp) * 2.0 - 1.0); pp *= 2.02; a *= 0.5; }
  return v;
}
float _lsm_marble(vec3 p) {
  return 0.5 + 0.5 * sin(p.x * 4.0 + _lsm_fbm(p) * 6.0);
}
float _lsm_layerNoise(int typ, vec3 wp, vec3 sc) {
  vec3 p = wp * sc;
  if (typ == 1) return _lsm_voronoi(p);
  if (typ == 2) return _lsm_fbm(p * 1.7) * 0.55 + 0.2;
  if (typ == 3) return _lsm_ridged(p);
  if (typ == 4) return _lsm_turbulence(p);
  if (typ == 5) return _lsm_marble(p);
  return _lsm_fbm(p);
}
vec3 _lsm_blendCol(int mode, vec3 base, vec3 layer, float t) {
  if (mode == 1) return mix(base, base * layer, t);
  if (mode == 2) {
    vec3 lo = base * layer * 2.0;
    vec3 hi = 1.0 - (1.0 - base) * (1.0 - layer);
    return mix(base, mix(lo, hi, step(0.5, base)), t);
  }
  return mix(base, layer, t);
}
`

function scaleVec(i: number): string {
  const L = `uL${i}`
  return `vec3(${L}Scale, ${L}ScaleY > 0.0 ? ${L}ScaleY : ${L}Scale, ${L}ScaleZ > 0.0 ? ${L}ScaleZ : ${L}Scale)`
}

const PER_LAYER = 'Mix Scale ScaleY ScaleZ Strength Rough Metal Disp Norm'.split(' ')
const layerUniforms = /* glsl */ `
uniform int uLayerCount;
${[0, 1, 2].map(i =>
  PER_LAYER.map(p => `uniform float uL${i}${p};`).join(' ') +
  ` uniform vec3 uL${i}Color; uniform int uL${i}Noise; uniform int uL${i}Blend;`
).join('\n')}
uniform float uAoFactor;
`

// Color / roughness / metalness — injected after metalnessmap_fragment
function colorBlock(i: number): string {
  const L = `uL${i}`
  return /* glsl */ `
  if (uLayerCount > ${i}) {
    vec3 csc${i} = ${scaleVec(i)};
    float cn${i} = _lsm_layerNoise(${L}Noise, wp, csc${i});
    float ct${i} = ${L}Mix * ${L}Strength * cn${i};
    albedo = _lsm_blendCol(${L}Blend, albedo, ${L}Color, ct${i});
    rough = mix(rough, ${L}Rough, ${L}Mix * cn${i});
    metal = mix(metal, ${L}Metal, ${L}Mix * cn${i});
  }`
}

const uvTransformGlsl = /* glsl */ `
vec3 _lsm_uvTransform(vec3 p, int fi) {
  vec2 sc; vec2 off; float rot;
  if (fi == 1) { sc = uUvScale[1]; off = uUvOff[1]; rot = uUvRot[1]; }
  else if (fi == 2) { sc = uUvScale[2]; off = uUvOff[2]; rot = uUvRot[2]; }
  else if (fi == 3) { sc = uUvScale[3]; off = uUvOff[3]; rot = uUvRot[3]; }
  else if (fi == 4) { sc = uUvScale[4]; off = uUvOff[4]; rot = uUvRot[4]; }
  else if (fi == 5) { sc = uUvScale[5]; off = uUvOff[5]; rot = uUvRot[5]; }
  else { sc = uUvScale[0]; off = uUvOff[0]; rot = uUvRot[0]; }
  float c = cos(rot);
  float s = sin(rot);
  vec3 q = p;
  float rx = c * q.x - s * q.z;
  float rz = s * q.x + c * q.z;
  q.x = rx * sc.x + off.x;
  q.z = rz * sc.y + off.y;
  return q;
}
`

const colorApplication = /* glsl */ `
{
  int _fg = int(vFaceGroup + 0.5);
  vec3 wp = _lsm_uvTransform(vWorldPosition, _fg);
  vec3 albedo = diffuseColor.rgb;
  float rough = roughnessFactor;
  float metal = metalnessFactor;
${colorBlock(0)}
${colorBlock(1)}
${colorBlock(2)}
  diffuseColor.rgb = albedo * uAoFactor;
  roughnessFactor = clamp(rough, 0.04, 1.0);
  metalnessFactor = clamp(metal, 0.0, 1.0);
}
`

// Normal perturbation — injected after normal_fragment_maps (where `normal` is defined)
function normalBlock(i: number): string {
  const L = `uL${i}`
  return /* glsl */ `
  if (uLayerCount > ${i} && ${L}Norm > 0.0) {
    vec3 nsc${i} = ${scaleVec(i)};
    float eps = 0.001;
    float nc${i} = _lsm_layerNoise(${L}Noise, nwp, nsc${i});
    float ndx${i} = _lsm_layerNoise(${L}Noise, nwp + vec3(eps,0.0,0.0), nsc${i}) - nc${i};
    float ndy${i} = _lsm_layerNoise(${L}Noise, nwp + vec3(0.0,eps,0.0), nsc${i}) - nc${i};
    float ndz${i} = _lsm_layerNoise(${L}Noise, nwp + vec3(0.0,0.0,eps), nsc${i}) - nc${i};
    vec3 npert${i} = normalize(vec3(-ndx${i}, -ndy${i}, -ndz${i})) * ${L}Norm * ${L}Mix;
    normal = normalize(normal + npert${i});
  }`
}

const normalApplication = /* glsl */ `
{
  int _nfg = int(vFaceGroup + 0.5);
  vec3 nwp = _lsm_uvTransform(vWorldPosition, _nfg);
${normalBlock(0)}
${normalBlock(1)}
${normalBlock(2)}
}
`

// Displacement — injected after displacementmap_vertex in vertex shader
function dispBlock(i: number): string {
  const L = `uL${i}`
  return /* glsl */ `
  if (uLayerCount > ${i} && ${L}Disp > 0.0) {
    vec3 dsc${i} = ${scaleVec(i)};
    vec3 dwp${i} = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float dn${i} = _lsm_layerNoise(${L}Noise, dwp${i}, dsc${i});
    transformed += objectNormal * dn${i} * ${L}Disp * ${L}Mix * 0.02;
  }`
}

const displacementApplication = /* glsl */ `
{
${dispBlock(0)}
${dispBlock(1)}
${dispBlock(2)}
}
`

const noiseToInt = (t: string) => {
  switch (t) {
    case 'voronoi': return 1
    case 'simplex': return 2
    case 'ridged': return 3
    case 'turbulence': return 4
    case 'marble': return 5
    default: return 0
  }
}
const blendToInt = (t: string) => (t === 'multiply' ? 1 : t === 'overlay' ? 2 : 0)

type Uniforms = Record<string, THREE.IUniform>

const IDENTITY_FACE_MAPPINGS: SurfaceUvMapping[] = Array.from({ length: 6 }, () => ({}))

function buildUniforms(): Uniforms {
  const u: Uniforms = {
    uLayerCount: { value: 0 },
    uAoFactor: { value: 1.0 },
    uUvScale: { value: Array.from({ length: 6 }, () => new THREE.Vector2(1, 1)) },
    uUvOff: { value: Array.from({ length: 6 }, () => new THREE.Vector2(0, 0)) },
    uUvRot: { value: new Float32Array(6) },
  }
  for (let i = 0; i < 3; i++) {
    const L = `uL${i}`
    u[`${L}Mix`] = { value: 0 }
    u[`${L}Scale`] = { value: 2 }
    u[`${L}ScaleY`] = { value: 0 }
    u[`${L}ScaleZ`] = { value: 0 }
    u[`${L}Strength`] = { value: 0.3 }
    u[`${L}Rough`] = { value: 0.5 }
    u[`${L}Metal`] = { value: 0 }
    u[`${L}Disp`] = { value: 0 }
    u[`${L}Norm`] = { value: 0 }
    u[`${L}Color`] = { value: new THREE.Color('#ffffff') }
    u[`${L}Noise`] = { value: 0 }
    u[`${L}Blend`] = { value: 0 }
  }
  return u
}

function createMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#c4a882',
    roughness: 0.5,
    metalness: 0.05,
  })

  const extraUniforms = buildUniforms()
  ;(mat as unknown as { _lsmUniforms: Uniforms })._lsmUniforms = extraUniforms

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, extraUniforms)

    // --- Vertex shader ---
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `varying vec3 vWorldPosition;
attribute float aFaceGroup;
varying float vFaceGroup;
${layerUniforms}
${noiseGlsl}
void main() {`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\nvFaceGroup = aFaceGroup;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <displacementmap_vertex>',
      `#include <displacementmap_vertex>\n${displacementApplication}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
    )

    // --- Fragment shader ---
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `varying vec3 vWorldPosition;
varying float vFaceGroup;
uniform vec2 uUvScale[6];
uniform vec2 uUvOff[6];
uniform float uUvRot[6];
${layerUniforms}
${noiseGlsl}
${uvTransformGlsl}
void main() {`,
    )
    // Color/roughness/metalness after both are defined
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>\n${colorApplication}`,
    )
    // Normal perturbation after normal is defined and normal maps applied
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n${normalApplication}`,
    )
  }

  mat.customProgramCacheKey = () => 'lsm-v5'

  return mat
}

function applySpec(mat: THREE.MeshPhysicalMaterial, spec: MaterialShaderSpec) {
  mat.color.set(spec.baseColorHex)
  mat.roughness = spec.globalRoughness
  mat.metalness = spec.globalMetalness

  const u = (mat as unknown as { _lsmUniforms: Uniforms })._lsmUniforms
  if (!u) return

  u.uAoFactor.value = spec.ambientOcclusion

  const layers = spec.layers.slice(0, 3)
  u.uLayerCount.value = layers.length

  for (let i = 0; i < 3; i++) {
    const L = layers[i]
    const pfx = `uL${i}`
    if (L) {
      u[`${pfx}Mix`].value = L.mix
      u[`${pfx}Scale`].value = L.noiseScale
      u[`${pfx}ScaleY`].value = L.noiseScaleY ?? 0
      u[`${pfx}ScaleZ`].value = L.noiseScaleZ ?? 0
      u[`${pfx}Strength`].value = L.noiseStrength
      u[`${pfx}Rough`].value = L.roughness
      u[`${pfx}Metal`].value = L.metalness
      u[`${pfx}Disp`].value = L.displacementStrength ?? 0
      u[`${pfx}Norm`].value = L.normalStrength ?? 0
      ;(u[`${pfx}Color`].value as THREE.Color).set(L.colorHex)
      u[`${pfx}Noise`].value = noiseToInt(L.noiseType)
      u[`${pfx}Blend`].value = blendToInt(L.blendMode)
    } else {
      u[`${pfx}Mix`].value = 0
      u[`${pfx}Scale`].value = 2
      u[`${pfx}ScaleY`].value = 0
      u[`${pfx}ScaleZ`].value = 0
      u[`${pfx}Strength`].value = 0.3
      u[`${pfx}Rough`].value = 0.5
      u[`${pfx}Metal`].value = 0
      u[`${pfx}Disp`].value = 0
      u[`${pfx}Norm`].value = 0
      ;(u[`${pfx}Color`].value as THREE.Color).set('#ffffff')
      u[`${pfx}Noise`].value = 0
      u[`${pfx}Blend`].value = 0
    }
  }

  mat.needsUpdate = true
}

export function LayeredShaderMaterial({
  spec,
  uvFaceMappings,
}: {
  spec: MaterialShaderSpec
  uvFaceMappings?: SurfaceUvMapping[]
}) {
  const mat = useMemo(() => createMaterial(), [])

  useLayoutEffect(() => {
    applySpec(mat, spec)
    const u = (mat as unknown as { _lsmUniforms: Uniforms })._lsmUniforms
    if (u) {
      const maps = uvFaceMappings ?? IDENTITY_FACE_MAPPINGS
      const scaleArr = u.uUvScale.value as THREE.Vector2[]
      const offArr = u.uUvOff.value as THREE.Vector2[]
      const rotArr = u.uUvRot.value as Float32Array
      for (let i = 0; i < 6; i++) {
        const m = maps[i] ?? {}
        scaleArr[i].set(m.scaleX ?? 1, m.scaleY ?? 1)
        offArr[i].set(m.offsetX ?? 0, m.offsetY ?? 0)
        rotArr[i] = m.rotation ?? 0
      }
    }
  }, [mat, spec, uvFaceMappings])

  useLayoutEffect(() => {
    return () => { mat.dispose() }
  }, [mat])

  return <primitive object={mat} attach="material" />
}
