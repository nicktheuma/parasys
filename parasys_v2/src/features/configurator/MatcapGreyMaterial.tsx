import { useTexture } from '@react-three/drei'
import { useLayoutEffect } from 'react'
import * as THREE from 'three'

/** Neutral grey matcap (three.js example texture; folder is `matcaps`, not `matcap`). */
const MATCAP_URL =
  'https://threejs.org/examples/textures/matcaps/matcap-porcelain-white.jpg'

/**
 * Fallback surface when no catalog material is selected (no materials, or no admin default).
 */
export function MatcapGreyMaterial({
  opacity = 1,
}: {
  opacity?: number
}) {
  const tex = useTexture(MATCAP_URL) as THREE.Texture
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
  }, [tex])
  return (
    <meshMatcapMaterial
      matcap={tex}
      color="#8a8a8a"
      toneMapped={false}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
    />
  )
}
