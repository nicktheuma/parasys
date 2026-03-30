import type * as THREE from 'three'

export type GeoNumber = { type: 'number'; v: number }

export type GeoPoint = { type: 'point'; x: number; y: number; z: number }

export type GeoCurve = {
  type: 'curve'
  points: Array<{ x: number; y: number; z: number }>
  closed: boolean
}

export type GeoMesh = {
  type: 'mesh'
  geometry: THREE.BufferGeometry
}

export type GeoValue = GeoNumber | GeoPoint | GeoCurve | GeoMesh

export function geoNum(v: number): GeoNumber {
  return { type: 'number', v }
}

export function geoPoint(x: number, y: number, z: number): GeoPoint {
  return { type: 'point', x, y, z }
}

export function geoCurve(
  points: Array<{ x: number; y: number; z: number }>,
  closed = false,
): GeoCurve {
  return { type: 'curve', points, closed }
}

export function geoMesh(geometry: THREE.BufferGeometry): GeoMesh {
  return { type: 'mesh', geometry }
}

export function geoToNumber(g: GeoValue | undefined): number | undefined {
  if (!g) return undefined
  switch (g.type) {
    case 'number':
      return g.v
    case 'point':
      return Math.hypot(g.x, g.y, g.z)
    case 'curve':
      return g.points.length > 0
        ? g.points.reduce((sum, p) => sum + Math.hypot(p.x, p.y, p.z), 0) / g.points.length
        : 0
    case 'mesh':
      return 0
  }
}

export function geoToPoint(g: GeoValue | undefined): GeoPoint | undefined {
  if (!g) return undefined
  switch (g.type) {
    case 'point':
      return g
    case 'number':
      return geoPoint(g.v, 0, 0)
    case 'curve':
      return g.points[0] ? geoPoint(g.points[0].x, g.points[0].y, g.points[0].z) : geoPoint(0, 0, 0)
    case 'mesh':
      return geoPoint(0, 0, 0)
  }
}
