import { useMemo } from 'react'
import * as THREE from 'three'

import { generatePanelSpecs } from '../../parametric/panelSpecs'
import { createExtrudedPanelGeometry } from '../../parametric/profileBuilder'

const toVector3 = (value) => {
  if (value?.isVector3) return value.clone()
  if (Array.isArray(value)) {
    return new THREE.Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
  }
  if (value && typeof value === 'object') {
    return new THREE.Vector3(value.x || 0, value.y || 0, value.z || 0)
  }
  return new THREE.Vector3()
}

export const usePanelLayout = ({
  width,
  height,
  depth,
  dividers,
  shelves,
  edgeOffset,
  slotOffset,
  materialThickness,
  bevelEnabled,
  bevelSize,
  bevelThickness,
  bevelSegments,
  interlockSlotsEnabled,
  interlockSlotClearance,
  interlockSlotLengthFactor,
}) => {
  const panelSpecs = useMemo(() => (
    generatePanelSpecs({
      width,
      height,
      depth,
      dividers,
      shelves,
      edgeOffset,
      slotOffset,
      materialThickness,
    })
  ), [width, height, depth, dividers, shelves, edgeOffset, slotOffset, materialThickness])

  const panelMeshes = useMemo(() => (
    panelSpecs.map((panelSpec) => ({
      panelSpec,
      ...createExtrudedPanelGeometry(panelSpec, {
        enabled: bevelEnabled,
        size: bevelSize,
        thickness: bevelThickness,
        segments: bevelSegments,
      }, {
        allPanelSpecs: panelSpecs,
        interlockSlots: {
          enabled: interlockSlotsEnabled,
          clearance: interlockSlotClearance,
          lengthFactor: interlockSlotLengthFactor,
        },
      }),
    }))
  ), [panelSpecs, bevelEnabled, bevelSize, bevelThickness, bevelSegments, interlockSlotsEnabled, interlockSlotClearance, interlockSlotLengthFactor])

  const panelLayoutMetrics = useMemo(() => {
    if (panelSpecs.length === 0) {
      return {
        center: new THREE.Vector3(),
        explodeDistance: 0.12,
      }
    }

    const center = panelSpecs.reduce((accumulator, panelSpec) => {
      return accumulator.add(toVector3(panelSpec.center))
    }, new THREE.Vector3()).multiplyScalar(1 / panelSpecs.length)

    let maxRadius = 0
    panelSpecs.forEach((panelSpec) => {
      const panelCenter = toVector3(panelSpec.center)
      const radius = panelCenter.distanceTo(center) + (Math.max(panelSpec.width, panelSpec.height) * 0.5)
      if (radius > maxRadius) maxRadius = radius
    })

    return {
      center,
      explodeDistance: Math.max(0.08, maxRadius * 0.55),
    }
  }, [panelSpecs])

  const dividerControlAnchors = useMemo(() => {
    const dividerPanels = panelSpecs.filter((panelSpec) => panelSpec.kind === 'vertical')
    if (dividerPanels.length === 0) {
      return {
        decrement: [-width / 2, 0, -depth / 2],
        increment: [width / 2, 0, depth / 2],
      }
    }

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    dividerPanels.forEach((panelSpec) => {
      const center = toVector3(panelSpec.center)
      minX = Math.min(minX, center.x)
      maxX = Math.max(maxX, center.x)
    })

    return {
      decrement: [minX, (height / 2) * 1.8, 0],
      increment: [maxX, (height / 2) * 1.8, 0],
    }
  }, [panelSpecs, width, height, depth])

  const shelfControlAnchors = useMemo(() => {
    const shelfPanels = panelSpecs.filter((panelSpec) => panelSpec.kind === 'shelf')
    if (shelfPanels.length === 0) {
      return {
        decrement: [0, -height / 2, 0],
        increment: [0, height / 2, 0],
      }
    }

    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    shelfPanels.forEach((panelSpec) => {
      const center = toVector3(panelSpec.center)
      minY = Math.min(minY, center.y)
      maxY = Math.max(maxY, center.y)
    })

    const xOffset = -width / 2 - 0.02

    return {
      decrement: [xOffset, minY, 0],
      increment: [xOffset, maxY, 0],
    }
  }, [panelSpecs, width, height])

  return {
    panelSpecs,
    panelMeshes,
    panelLayoutMetrics,
    dividerControlAnchors,
    shelfControlAnchors,
    toVector3,
  }
}
