import * as THREE from 'three'

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

export const createExtrudedPanelGeometry = (panelSpec) => {
  const { shape, outerLoop, holeLoops } = buildPanelProfile(panelSpec)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: panelSpec.thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  })
  geometry.center()
  return {
    geometry,
    vectorLoops: {
      outerLoop,
      holeLoops,
    },
  }
}
