import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const easeOutCubic = (t) => 1 - ((1 - t) ** 3)
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2
const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2))
}

export const useFurnitureAnimation = ({
  dividers,
  shelves,
  panelLayoutMetrics,
  panelMeshRefs,
  panelMeshTargetsRef,
  fadeMaterials,
  enhancedAssetsReady,
  boundingRef,
  showDevTools,
  width,
  height,
  depth,
  startDims,
}) => {
  const introProgressRef = useRef(0)
  const materialFadeRef = useRef(0)
  const structureTransitionRef = useRef(1)
  const hasSeenCountsRef = useRef(false)
  const structureAnimatedKindsRef = useRef(new Set())
  const lastCountsRef = useRef({ dividers: 1, shelves: 1 })

  useEffect(() => {
    if (!hasSeenCountsRef.current) {
      hasSeenCountsRef.current = true
      lastCountsRef.current = { dividers, shelves }
      return
    }

    const changedKinds = new Set()
    if (dividers !== lastCountsRef.current.dividers) changedKinds.add('vertical')
    if (shelves !== lastCountsRef.current.shelves) changedKinds.add('shelf')

    structureAnimatedKindsRef.current = changedKinds
    if (changedKinds.size > 0) {
      structureTransitionRef.current = 0
    }
    lastCountsRef.current = { dividers, shelves }
  }, [dividers, shelves])

  const animateFurniture = (delta) => {
    const introCap = enhancedAssetsReady ? 1 : 0.86
    const introBlend = 1 - Math.exp(-delta * 2.6)
    introProgressRef.current = THREE.MathUtils.lerp(introProgressRef.current, introCap, introBlend)
    const introT = THREE.MathUtils.clamp(introProgressRef.current, 0, 1)
    const positionT = easeOutCubic(introT)
    const scaleT = THREE.MathUtils.clamp(easeOutBack(introT), 0, 1.12)

    const structureBlend = 1 - Math.exp(-delta * 2.6)
    structureTransitionRef.current = THREE.MathUtils.lerp(
      structureTransitionRef.current,
      1,
      structureBlend,
    )
    const structureT = THREE.MathUtils.clamp(easeInOutSine(structureTransitionRef.current), 0, 1)
    if (structureTransitionRef.current > 0.995) {
      structureAnimatedKindsRef.current.clear()
    }

    const targetFade = enhancedAssetsReady ? 1 : 0
    const fadeBlend = 1 - Math.exp(-delta * 3.2)
    materialFadeRef.current = THREE.MathUtils.lerp(materialFadeRef.current, targetFade, fadeBlend)
    const materialFade = THREE.MathUtils.clamp(materialFadeRef.current, 0, 1)

    fadeMaterials.forEach((candidateMaterial) => {
      candidateMaterial.opacity = materialFade
      candidateMaterial.depthWrite = materialFade > 0.98
    })

    const { center: layoutCenter, explodeDistance } = panelLayoutMetrics
    panelMeshRefs.current.forEach((mesh, panelId) => {
      const targetMeta = panelMeshTargetsRef.current.get(panelId)
      if (!mesh || !targetMeta) return

      const { targetPosition, seed, kind } = targetMeta
      const direction = targetPosition.clone().sub(layoutCenter)
      if (direction.lengthSq() < 1e-6) {
        direction.set(
          THREE.MathUtils.mapLinear((seed % 97), 0, 96, -0.55, 0.55),
          THREE.MathUtils.mapLinear((seed % 89), 0, 88, -0.25, 0.4),
          THREE.MathUtils.mapLinear((seed % 83), 0, 82, -0.55, 0.55),
        )
      }
      direction.normalize()
      const startPosition = targetPosition.clone().add(direction.multiplyScalar(explodeDistance))

      if (introT < 0.995) {
        mesh.position.lerpVectors(startPosition, targetPosition, positionT)
        mesh.scale.setScalar(THREE.MathUtils.clamp(scaleT, 0.001, 1.06))
        return
      }

      if (kind === 'vertical' || kind === 'shelf') {
        const shouldAnimateKind = structureAnimatedKindsRef.current.has(kind)
        if (shouldAnimateKind) {
          const countChangeStart = targetPosition.clone()
          if (kind === 'vertical') {
            countChangeStart.x = THREE.MathUtils.lerp(targetPosition.x, layoutCenter.x, 0.22)
          } else {
            countChangeStart.y = THREE.MathUtils.lerp(targetPosition.y, layoutCenter.y, 0.22)
          }

          mesh.position.lerpVectors(countChangeStart, targetPosition, structureT)
          mesh.scale.setScalar(THREE.MathUtils.lerp(0.9, 1, structureT))
          return
        }
      }

      mesh.position.copy(targetPosition)
      mesh.scale.setScalar(1)
    })

    if (boundingRef.current && showDevTools === true) {
      boundingRef.current.scale.x = THREE.MathUtils.lerp(boundingRef.current.scale.x, width / startDims.x, 0.1)
      boundingRef.current.scale.y = THREE.MathUtils.lerp(boundingRef.current.scale.y, height / startDims.y, 0.1)
      boundingRef.current.scale.z = THREE.MathUtils.lerp(boundingRef.current.scale.z, depth / startDims.z, 0.1)
    }
  }

  return { animateFurniture }
}
