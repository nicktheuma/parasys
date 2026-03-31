import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MaterialShaderSpec } from '@/lib/materialShader'

type Props = {
  url: string
  /** Uniform scale applied to the cloned scene (bbox fit from parent) */
  scale: number
  position: [number, number, number]
  materialSpec: MaterialShaderSpec
}

function applySpecToScene(root: THREE.Object3D, spec: MaterialShaderSpec) {
  const color = new THREE.Color(spec.baseColorHex)
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: spec.globalRoughness,
        metalness: spec.globalMetalness,
        envMapIntensity: 1,
      })
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.())
      else o.material?.dispose?.()
      o.material = mat
    }
  })
}

/**
 * GLB instance: clone scene, apply PBR approximated from shader spec (layered noise is box-only).
 */
export function PropGlbMesh({ url, scale, position, materialSpec }: Props) {
  const { scene } = useGLTF(url)
  const rootRef = useRef<THREE.Group>(null)
  const root = useMemo(() => scene.clone(true), [scene])

  useLayoutEffect(() => {
    applySpecToScene(root, materialSpec)
  }, [root, materialSpec])

  return (
    <group ref={rootRef} position={position} scale={scale}>
      <primitive object={root} />
    </group>
  )
}
