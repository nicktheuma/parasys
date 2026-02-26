import * as THREE from 'three'

const UV_REPEAT_PER_METER = 2

const ensureClosedLoop = (points) => {
  if (points.length === 0) return points
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  if (firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]) return points
  return [...points, [...firstPoint]]
}

export const buildClosedRectangleLoop = (width, height) => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  return ensureClosedLoop([
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ])
}

const makeShapeFromLoop = (loop) => {
  const [firstPoint, ...remainingPoints] = loop
  const shape = new THREE.Shape()
  shape.moveTo(firstPoint[0], firstPoint[1])
  remainingPoints.forEach((point) => shape.lineTo(point[0], point[1]))
  shape.closePath()
  return shape
}

const makeHolePathFromRect = ({ centerX, centerY, width, height }) => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const loop = ensureClosedLoop([
    [centerX - halfWidth, centerY - halfHeight],
    [centerX - halfWidth, centerY + halfHeight],
    [centerX + halfWidth, centerY + halfHeight],
    [centerX + halfWidth, centerY - halfHeight],
  ])
  const [firstPoint, ...remainingPoints] = loop
  const path = new THREE.Path()
  path.moveTo(firstPoint[0], firstPoint[1])
  remainingPoints.forEach((point) => path.lineTo(point[0], point[1]))
  path.closePath()
  return { path, loop }
}

const worldPointToPanelProfile = (panelSpec, worldPoint) => {
  const [centerX, centerY, centerZ] = panelSpec.center
  const localX = worldPoint.x - centerX
  const localY = worldPoint.y - centerY
  const localZ = worldPoint.z - centerZ

  switch (panelSpec.plane) {
    case 'YZ':
      return [localZ, localY]
    case 'XZ':
      return [localX, localZ]
    case 'XY':
    default:
      return [localX, localY]
  }
}

const cutoutFitsPanel = (panelSpec, cutout, epsilon = 0.00005) => {
  const halfPanelWidth = panelSpec.width / 2
  const halfPanelHeight = panelSpec.height / 2
  const halfCutoutWidth = cutout.width / 2
  const halfCutoutHeight = cutout.height / 2

  if (cutout.width <= 0 || cutout.height <= 0) return false

  const minX = cutout.centerX - halfCutoutWidth
  const maxX = cutout.centerX + halfCutoutWidth
  const minY = cutout.centerY - halfCutoutHeight
  const maxY = cutout.centerY + halfCutoutHeight

  return (
    minX > (-halfPanelWidth + epsilon) &&
    maxX < (halfPanelWidth - epsilon) &&
    minY > (-halfPanelHeight + epsilon) &&
    maxY < (halfPanelHeight - epsilon)
  )
}

const buildInterlockSlots = (panelSpec, allPanelSpecs = [], interlockSlots = {}) => {
  if (!interlockSlots.enabled) return []
  if (panelSpec.kind !== 'vertical' && panelSpec.kind !== 'shelf') return []

  const clearance = Math.max(0, interlockSlots.clearance ?? 0)
  const lengthFactor = Math.max(1, interlockSlots.lengthFactor ?? 1.6)
  const slotShort = Math.max(0.0001, panelSpec.thickness + clearance)
  const slotLong = Math.max(slotShort, (panelSpec.thickness * lengthFactor) + clearance)

  const counterpartKind = panelSpec.kind === 'vertical' ? 'shelf' : 'vertical'
  const counterparts = allPanelSpecs.filter((candidate) => candidate.kind === counterpartKind)
  const slotCutouts = []

  counterparts.forEach((counterpart) => {
    const intersectionPoint = new THREE.Vector3(
      panelSpec.kind === 'vertical' ? panelSpec.center[0] : counterpart.center[0],
      panelSpec.kind === 'vertical' ? counterpart.center[1] : panelSpec.center[1],
      (panelSpec.center[2] + counterpart.center[2]) * 0.5,
    )

    const [centerX, centerY] = worldPointToPanelProfile(panelSpec, intersectionPoint)
    const cutout = panelSpec.kind === 'vertical'
      ? { centerX, centerY, width: slotLong, height: slotShort }
      : { centerX, centerY, width: slotShort, height: slotLong }

    if (cutoutFitsPanel(panelSpec, cutout)) {
      slotCutouts.push(cutout)
    }
  })

  return slotCutouts
}

export const buildPanelProfile = (panelSpec, profileOptions = {}) => {
  const outerLoop = buildClosedRectangleLoop(panelSpec.width, panelSpec.height)
  const shape = makeShapeFromLoop(outerLoop)
  const holeLoops = []
  const explicitCutouts = panelSpec.cutouts || []
  const autoInterlockCutouts = buildInterlockSlots(
    panelSpec,
    profileOptions.allPanelSpecs,
    profileOptions.interlockSlots,
  )
  const allCutouts = [...explicitCutouts, ...autoInterlockCutouts]

  allCutouts.forEach((cutout) => {
    const { path, loop } = makeHolePathFromRect(cutout)
    shape.holes.push(path)
    holeLoops.push(loop)
  })

  return {
    outerLoop,
    holeLoops,
    shape,
  }
}

export const createExtrudedPanelGeometry = (panelSpec, bevelOptions = {}, profileOptions = {}) => {
  const { shape, outerLoop, holeLoops } = buildPanelProfile(panelSpec, profileOptions)
  const maxBevelFromThickness = Math.max(0, (panelSpec.thickness * 0.5) - 0.00001)
  const bevelEnabled = Boolean(bevelOptions.enabled)
  const bevelSize = THREE.MathUtils.clamp(bevelOptions.size ?? 0.0002, 0, maxBevelFromThickness)
  const bevelThickness = THREE.MathUtils.clamp(bevelOptions.thickness ?? 0.0002, 0, maxBevelFromThickness)
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
    const minX = bounds.min.x
    const minY = bounds.min.y
    const minZ = bounds.min.z

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const y = positions.getY(index)
      const z = positions.getZ(index)
      const nx = Math.abs(normals.getX(index))
      const ny = Math.abs(normals.getY(index))
      const nz = Math.abs(normals.getZ(index))

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

      uv[(index * 2)] = u
      uv[(index * 2) + 1] = v
    }

    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geometry.attributes.uv.needsUpdate = true
  }

  return {
    geometry,
    vectorLoops: {
      outerLoop,
      holeLoops,
    },
  }
}
