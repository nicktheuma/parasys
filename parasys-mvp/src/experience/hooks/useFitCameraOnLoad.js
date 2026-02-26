import { useLayoutEffect } from 'react'
import * as THREE from 'three'

export const useFitCameraOnLoad = ({ furnitureGroupRef, orbitRef }) => {
  useLayoutEffect(() => {
    let rafId = null
    let attempts = 0
    let successfulFits = 0
    const maxAttempts = 30

    const fitOnLoad = () => {
      attempts += 1

      if (furnitureGroupRef.current && orbitRef.current) {
        const box = new THREE.Box3().setFromObject(furnitureGroupRef.current)

        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const controls = orbitRef.current
          const camera = controls.object
          const maxDim = Math.max(size.x, size.y, size.z)
          const fov = THREE.MathUtils.degToRad(camera.fov)
          const fitDistance = (maxDim / (2 * Math.tan(fov / 2))) * 1.25

          camera.position.set(center.x, center.y, center.z + fitDistance)
          controls.target.copy(center)
          controls.update()

          camera.near = 0.001
          camera.far = 500
          camera.updateProjectionMatrix()

          successfulFits += 1
        }
      }

      if (attempts < maxAttempts && successfulFits < 3) {
        rafId = requestAnimationFrame(fitOnLoad)
      }
    }

    rafId = requestAnimationFrame(fitOnLoad)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [furnitureGroupRef, orbitRef])
}
