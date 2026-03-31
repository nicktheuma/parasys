import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { LightingTabId, ResolvedConfiguratorLighting } from '@/lib/configuratorLighting'

const DEFAULT = '#7a9ab8'
const SELECTED = '#ff7a33'

type DirProps = {
  resolved: ResolvedConfiguratorLighting
  selectedId: LightingTabId | null
  productCenter: THREE.Vector3
}

/** Directional lights live on the Canvas root (not scaled by stage radius). */
export function DirectionalLightGizmos({ resolved, selectedId, productCenter }: DirProps) {
  const items: { id: LightingTabId; from: [number, number, number]; to: [number, number, number] }[] = [
    {
      id: 'directional0',
      from: productCenter
        .clone()
        .add(new THREE.Vector3(...resolved.directional0.position))
        .toArray() as [number, number, number],
      to: [productCenter.x, productCenter.y, productCenter.z],
    },
    {
      id: 'directional1',
      from: productCenter
        .clone()
        .add(new THREE.Vector3(...resolved.directional1.position))
        .toArray() as [number, number, number],
      to: [productCenter.x, productCenter.y, productCenter.z],
    },
    {
      id: 'directional2',
      from: productCenter
        .clone()
        .add(new THREE.Vector3(...resolved.directional2.position))
        .toArray() as [number, number, number],
      to: [productCenter.x, productCenter.y, productCenter.z],
    },
  ]
  return (
    <group renderOrder={1000}>
      {items.map(({ id, from, to }) => (
        <Line
          key={id}
          points={[from, to]}
          color={selectedId === id ? SELECTED : DEFAULT}
          lineWidth={selectedId === id ? 3 : 1.5}
          depthTest={false}
        />
      ))}
    </group>
  )
}

type StageProps = {
  radius: number
  resolved: ResolvedConfiguratorLighting
  selectedId: LightingTabId | null
  productCenter: THREE.Vector3
}

/** Ambient, spot, and fill — same space as ConfiguratorStageContent (scaled by radius). */
export function StageLightingGizmos({ radius, resolved, selectedId, productCenter }: StageProps) {
  const ks = resolved.keySpot
  const fp = resolved.fillPoint
  const c = productCenter
  const spotPos = c
    .clone()
    .add(
      new THREE.Vector3(
        ks.position[0] * radius,
        ks.position[1] * radius,
        ks.position[2] * radius,
      ),
    )
  const fillPos = c
    .clone()
    .add(
      new THREE.Vector3(
        fp.position[0] * radius,
        fp.position[1] * radius,
        fp.position[2] * radius,
      ),
    )
  const r = Math.max(0.02, radius)
  const ambColor = selectedId === 'ambient' ? SELECTED : DEFAULT
  const spotColor = selectedId === 'keySpot' ? SELECTED : DEFAULT
  const fillColor = selectedId === 'fillPoint' ? SELECTED : DEFAULT
  const ctr: [number, number, number] = [c.x, c.y, c.z]

  return (
    <group renderOrder={1000}>
      <mesh position={ctr}>
        <icosahedronGeometry args={[r * 0.08, 1]} />
        <meshBasicMaterial color={ambColor} wireframe depthTest={false} />
      </mesh>
      <Line
        points={[spotPos.toArray() as [number, number, number], ctr]}
        color={spotColor}
        lineWidth={selectedId === 'keySpot' ? 3 : 1.5}
        depthTest={false}
      />
      <mesh position={spotPos}>
        <octahedronGeometry args={[r * 0.045, 0]} />
        <meshBasicMaterial color={spotColor} wireframe depthTest={false} />
      </mesh>
      <Line
        points={[ctr, fillPos.toArray() as [number, number, number]]}
        color={fillColor}
        lineWidth={selectedId === 'fillPoint' ? 3 : 1.5}
        depthTest={false}
      />
      <mesh position={fillPos}>
        <octahedronGeometry args={[r * 0.04, 0]} />
        <meshBasicMaterial color={fillColor} wireframe depthTest={false} />
      </mesh>
    </group>
  )
}
