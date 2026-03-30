import * as THREE from 'three'
import type { PanelCutout, PanelSpec } from './panelSpecs'

const UV_REPEAT_PER_METER = 2

const ensureClosedLoop = (points: number[][]): number[][] => {
  if (points.length === 0) return points
  const first = points[0]
  const last = points[points.length - 1]
  if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) return points
  return [...points, [...first!]]
}

export const buildClosedRectangleLoop = (width: number, height: number): number[][] => {
  const hw = width / 2
  const hh = height / 2
  return ensureClosedLoop([
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ])
}

const makeShapeFromLoop = (loop: number[][]): THREE.Shape => {
  const [first, ...rest] = loop
  const shape = new THREE.Shape()
  shape.moveTo(first![0]!, first![1]!)
  rest.forEach((p) => shape.lineTo(p[0]!, p[1]!))
  shape.closePath()
  return shape
}

const makeHolePathFromRect = ({ centerX, centerY, width, height }: PanelCutout) => {
  const hw = width / 2
  const hh = height / 2
  const loop = ensureClosedLoop([
    [centerX - hw, centerY - hh],
    [centerX - hw, centerY + hh],
    [centerX + hw, centerY + hh],
    [centerX + hw, centerY - hh],
  ])
  const [first, ...rest] = loop
  const path = new THREE.Path()
  path.moveTo(first![0]!, first![1]!)
  rest.forEach((p) => path.lineTo(p[0]!, p[1]!))
  path.closePath()
  return { path, loop }
}

const worldPointToPanelProfile = (panelSpec: PanelSpec, worldPoint: THREE.Vector3): [number, number] => {
  const [cx, cy, cz] = panelSpec.center
  const lx = worldPoint.x - cx
  const ly = worldPoint.y - cy
  const lz = worldPoint.z - cz

  switch (panelSpec.plane) {
    case 'YZ':
      return [lz, ly]
    case 'XZ':
      return [lx, lz]
    case 'XY':
    default:
      return [lx, ly]
  }
}

const cutoutFitsPanel = (panelSpec: PanelSpec, cutout: PanelCutout, epsilon = 0.00005): boolean => {
  const hpw = panelSpec.width / 2
  const hph = panelSpec.height / 2
  const hcw = cutout.width / 2
  const hch = cutout.height / 2
  if (cutout.width <= 0 || cutout.height <= 0) return false
  const minX = cutout.centerX - hcw
  const maxX = cutout.centerX + hcw
  const minY = cutout.centerY - hch
  const maxY = cutout.centerY + hch
  return minX > -hpw + epsilon && maxX < hpw - epsilon && minY > -hph + epsilon && maxY < hph - epsilon
}

const buildInterlockSlots = (
  panelSpec: PanelSpec,
  allPanelSpecs: PanelSpec[] = [],
  interlockSlots: { enabled?: boolean; clearance?: number; lengthFactor?: number } = {},
): PanelCutout[] => {
  if (!interlockSlots.enabled) return []
  if (panelSpec.kind !== 'vertical' && panelSpec.kind !== 'shelf') return []
  const clearance = Math.max(0, interlockSlots.clearance ?? 0)
  const lengthFactor = Math.max(1, interlockSlots.lengthFactor ?? 1.6)
  const slotShort = Math.max(0.0001, panelSpec.thickness + clearance)
  const slotLong = Math.max(slotShort, panelSpec.thickness * lengthFactor + clearance)
  const counterpartKind = panelSpec.kind === 'vertical' ? 'shelf' : 'vertical'
  const counterparts = allPanelSpecs.filter((p) => p.kind === counterpartKind)
  const slotCutouts: PanelCutout[] = []

  counterparts.forEach((counterpart) => {
    const intersection = new THREE.Vector3(
      panelSpec.kind === 'vertical' ? panelSpec.center[0] : counterpart.center[0],
      panelSpec.kind === 'vertical' ? counterpart.center[1] : panelSpec.center[1],
      (panelSpec.center[2] + counterpart.center[2]) * 0.5,
    )
    const [centerX, centerY] = worldPointToPanelProfile(panelSpec, intersection)
    const cutout =
      panelSpec.kind === 'vertical'
        ? { centerX, centerY, width: slotLong, height: slotShort }
        : { centerX, centerY, width: slotShort, height: slotLong }
    if (cutoutFitsPanel(panelSpec, cutout)) slotCutouts.push(cutout)
  })

  return slotCutouts
}

export const buildPanelProfile = (
  panelSpec: PanelSpec,
  profileOptions: {
    allPanelSpecs?: PanelSpec[]
    interlockSlots?: { enabled?: boolean; clearance?: number; lengthFactor?: number }
  } = {},
) => {
  const outerLoop = buildClosedRectangleLoop(panelSpec.width, panelSpec.height)
  const shape = makeShapeFromLoop(outerLoop)
  const explicit = panelSpec.cutouts ?? []
  const auto = buildInterlockSlots(panelSpec, profileOptions.allPanelSpecs, profileOptions.interlockSlots)
  const holeLoops: number[][][] = []

  ;[...explicit, ...auto].forEach((cutout) => {
    const { path, loop } = makeHolePathFromRect(cutout)
    shape.holes.push(path)
    holeLoops.push(loop)
  })

  return { shape, outerLoop, holeLoops }
}

export const createExtrudedPanelGeometry = (
  panelSpec: PanelSpec,
  bevelOptions: { enabled?: boolean; size?: number; thickness?: number; segments?: number } = {},
  profileOptions: {
    allPanelSpecs?: PanelSpec[]
    interlockSlots?: { enabled?: boolean; clearance?: number; lengthFactor?: number }
  } = {},
) => {
  const { shape, outerLoop, holeLoops } = buildPanelProfile(panelSpec, profileOptions)
  const maxBevel = Math.max(0, panelSpec.thickness * 0.5 - 0.00001)
  const bevelEnabled = Boolean(bevelOptions.enabled)
  const bevelSize = THREE.MathUtils.clamp(bevelOptions.size ?? 0.0002, 0, maxBevel)
  const bevelThickness = THREE.MathUtils.clamp(bevelOptions.thickness ?? 0.0002, 0, maxBevel)
  const bevelSegments = Math.max(1, Math.round(bevelOptions.segments ?? 2))
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: panelSpec.thickness,
    bevelEnabled,
    bevelSize,
    bevelThickness,
    bevelSegments,
    steps: 1,
    curveSegments: 1,
  })
  geometry.center()
  geometry.computeBoundingBox()

  const positions = geometry.attributes.position
  const normals = geometry.attributes.normal
  const bounds = geometry.boundingBox
  if (positions && normals && bounds) {
    const uv = new Float32Array(positions.count * 2)
    const faceGroup = new Float32Array(positions.count)
    const minX = bounds.min.x
    const minY = bounds.min.y
    const minZ = bounds.min.z
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      const rnx = normals.getX(i)
      const rny = normals.getY(i)
      const rnz = normals.getZ(i)
      const nx = Math.abs(rnx)
      const ny = Math.abs(rny)
      const nz = Math.abs(rnz)
      let u = 0
      let v = 0
      if (nz > 0.9) {
        u = (x - minX) * UV_REPEAT_PER_METER
        v = (y - minY) * UV_REPEAT_PER_METER
      } else if (nx >= ny) {
        u = (y - minY) * UV_REPEAT_PER_METER
        v = (z - minZ) * UV_REPEAT_PER_METER
      } else {
        u = (x - minX) * UV_REPEAT_PER_METER
        v = (z - minZ) * UV_REPEAT_PER_METER
      }
      uv[i * 2] = u
      uv[i * 2 + 1] = v

      // Face group: 0=front(+Z) 1=back(-Z) 2=right(+X) 3=left(-X) 4=top(+Y) 5=bottom(-Y)
      if (nz > nx && nz > ny) {
        faceGroup[i] = rnz > 0 ? 0 : 1
      } else if (nx > ny) {
        faceGroup[i] = rnx > 0 ? 2 : 3
      } else {
        faceGroup[i] = rny > 0 ? 4 : 5
      }
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geometry.setAttribute('aFaceGroup', new THREE.Float32BufferAttribute(faceGroup, 1))
    geometry.attributes.uv.needsUpdate = true
  }

  return { geometry, vectorLoops: { outerLoop, holeLoops } }
}
