import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { PanelSpec } from '../../src/features/parametric/mvp1/panelSpecs.ts'

/**
 * Matches `ParametricPanelProduct` root: `<group position={[0, heightM/2, 0]}>` so the assembly
 * sits on the floor (Y-up) like the viewer. Without this, STL appears “on its back” vs on-screen.
 */
export function buildStlFromPanels(panels: PanelSpec[], rootYOffsetM: number): Buffer {
  const group = new THREE.Group()
  group.position.set(0, rootYOffsetM, 0)
  for (const p of panels) {
    const geom = new THREE.BoxGeometry(p.width, p.height, p.thickness)
    const mesh = new THREE.Mesh(geom)
    mesh.position.set(p.center[0], p.center[1], p.center[2])
    mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2])
    group.add(mesh)
  }
  group.updateMatrixWorld(true)
  const exporter = new STLExporter()
  const ascii = exporter.parse(group, { binary: false }) as string
  return Buffer.from(ascii, 'utf8')
}

export function buildPlaceholderStlBox(widthM: number, heightM: number, depthM: number): Buffer {
  const group = new THREE.Group()
  group.position.set(0, heightM / 2, 0)
  const geom = new THREE.BoxGeometry(widthM, heightM, depthM)
  const mesh = new THREE.Mesh(geom)
  group.add(mesh)
  group.updateMatrixWorld(true)
  const exporter = new STLExporter()
  const ascii = exporter.parse(group, { binary: false }) as string
  return Buffer.from(ascii, 'utf8')
}
