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

export const buildPanelProfile = (panelSpec) => {
  const outerLoop = buildClosedRectangleLoop(panelSpec.width, panelSpec.height)
  const shape = makeShapeFromLoop(outerLoop)
  const holeLoops = []

  panelSpec.cutouts.forEach((cutout) => {
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

export const createExtrudedPanelGeometry = (panelSpec, bevelOptions = {}) => {
  const { shape, outerLoop, holeLoops } = buildPanelProfile(panelSpec)
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
