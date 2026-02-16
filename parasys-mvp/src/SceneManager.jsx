import * as THREE from 'three'
import { Line, Text, Billboard } from '@react-three/drei'
import React, { useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'

const DimensionColor = '#3c00ff';
const DimensionHoverColor = '#ff0000';

export function WidthDimensionLine({ start, end, label, centerGap = 0.1, anchorGap = 0.02, dimensionGap=0.05,fontSize = 0.05, setWidth, min = 0.05, max = 2, step = 0.01 }) {
  // Calculate the center point for the label
  const s = new THREE.Vector3(start[0], start[1] + dimensionGap, start[2]);
  const e = new THREE.Vector3(end[0], end[1] + dimensionGap, end[2]);  
  
  const center = [
    (s.x + e.x) / 2,
    (s.y + e.y) / 2,
    (s.z + e.z) / 2,
  ]
  const center_L = [center[0] - centerGap, center[1], center[2]]
  const center_R = [center[0] + centerGap, center[1], center[2]]

  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(label)
  const [hovered, setHovered] = useState(false)
  const { controls } = useThree()

  const onPointerDown = (e) => {
    if (!setWidth) return
    e.stopPropagation()
    dragging.current = true
    try { e.target.setPointerCapture(e.pointerId) } catch {}
    startX.current = e.nativeEvent?.clientX || e.clientX || 0  // Use screen coordinates
    startWidth.current = label
    if (controls) controls.enabled = false

    // Attach document-level listeners for drag-away behavior
    const handleGlobalMove = (moveEvent) => {
      if (!dragging.current || !setWidth) return
      const screenDx = moveEvent.clientX - startX.current
      const worldDx = screenDx * 0.01  // Scale screen pixels to world units
      const newWidth = startWidth.current + worldDx * 2
      const snapped = Math.min(max, Math.max(min, Math.round(newWidth / step) * step))
      if (snapped !== label) setWidth(snapped)
    }

    const handleGlobalUp = () => {
      dragging.current = false
      if (controls) controls.enabled = true
      document.removeEventListener('mousemove', handleGlobalMove)
      document.removeEventListener('mouseup', handleGlobalUp)
    }

    document.addEventListener('mousemove', handleGlobalMove)
    document.addEventListener('mouseup', handleGlobalUp)
  }

  const onPointerMove = (e) => {
    // Only process if actively dragging
    if (!dragging.current) return
    if (!setWidth) return
    e.stopPropagation()
    // Use screen coordinates for consistency with document listener
    const clientX = e.nativeEvent?.clientX || e.clientX || 0
    const screenDx = clientX - startX.current
    const worldDx = screenDx * 0.01  // Scale screen pixels to world units
    const newWidth = startWidth.current + worldDx * 2
    const snapped = Math.min(max, Math.max(min, Math.round(newWidth / step) * step))
    if (snapped !== label) setWidth(snapped)
  }

  const onPointerUp = (e) => {
    if (!setWidth) return
    e.stopPropagation()
    dragging.current = false
    try { e.target.releasePointerCapture(e.pointerId) } catch {}
    if (controls) controls.enabled = true
  }

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[s, center_L]} color={hovered ? DimensionHoverColor : DimensionColor} lineWidth={1} dashed={false} />
      <Line points={[center_R, e]} color={hovered ? DimensionHoverColor : DimensionColor} lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [s.x, s.y, s.z], 
          [s.x, s.y -  (dimensionGap - anchorGap), s.z] // Small tick downwards
        ]} 
        color={hovered ? DimensionHoverColor : DimensionColor}
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [e.x, e.y, e.z], 
          [e.x, e.y - (dimensionGap - anchorGap), e.z] 
        ]} 
        color={hovered ? DimensionHoverColor : DimensionColor} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[0, s.y, s.z]}>
        <group>
          <mesh
            position={[center[0], center[1] - (Math.abs(center_R[0] - center_L[0])), center[2]]}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
          >
            <planeGeometry args={[(Math.abs(center_R[0] - center_L[0]) / 1.5), (Math.abs(center_R[0] - center_L[0]) / 4)]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          <Text className="dimension-label"
            fontSize={fontSize}
            color={hovered ? DimensionHoverColor : DimensionColor}
            anchorX="center"
            anchorY="middle"
          >
            {(label * 1).toFixed(2)}m
          </Text>
        </group>
      </Billboard>
    </group>
  )
}

export function HeightDimensionLine({ start, end, label, centerGap = 0.1, anchorGap = 0.02, dimensionGap=0.05,fontSize = 0.05 }) {
  // Calculate the center point for the label
  const s = new THREE.Vector3(start[0] + dimensionGap, start[1], start[2]);
  const e = new THREE.Vector3(end[0] + dimensionGap, end[1], end[2]);  
  
  const center = [
    (s.x + e.x) / 2,
    (s.y + e.y) / 2,
    (s.z + e.z) / 2,
  ]
  const center_L = [center[0], center[1] - (centerGap/2), center[2]]
  const center_R = [center[0], center[1] + (centerGap/2), center[2]]

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[s, center_L]} color={DimensionColor} lineWidth={1} dashed={false} />
      <Line points={[center_R, e]} color={DimensionColor} lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [s.x, s.y, s.z], 
          [s.x - (dimensionGap - anchorGap), s.y, s.z] // Small tick downwards
        ]} 
        color={DimensionColor} 
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [e.x, e.y, e.z], 
          [e.x - (dimensionGap - anchorGap), e.y, e.z] 
        ]} 
        color={DimensionColor} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[s.x, 0, s.z]}>
          <Text
            fontSize={fontSize}
            color={DimensionColor}
            anchorX="center"
            anchorY="middle"
          >
            {(label * 1).toFixed(2)}m
          </Text>
      </Billboard>
    </group>
  )
}

export function DepthDimensionLine({ start, end, label, centerGap = 0.1, anchorGap = 0.02, dimensionGap=0.05,fontSize = 0.05 }) {
  // Calculate the center point for the label
  const s = new THREE.Vector3(start[0] + dimensionGap, start[1], start[2]);
  const e = new THREE.Vector3(end[0] + dimensionGap, end[1], end[2]);  
  
  const center = [
    (s.x + e.x) / 2,
    (s.y + e.y) / 2,
    (s.z + e.z) / 2,
  ]
  const center_L = [center[0], center[1], center[2] + (centerGap/2)]
  const center_R = [center[0], center[1], center[2] - (centerGap/2)]

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[s, center_L]} color={DimensionColor} lineWidth={1} dashed={false} />
      <Line points={[center_R, e]} color={DimensionColor} lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [s.x, s.y, s.z], 
          [s.x - (dimensionGap - anchorGap), s.y, s.z] // Small tick downwards
        ]} 
        color={DimensionColor} 
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [e.x, e.y, e.z], 
          [e.x - (dimensionGap - anchorGap), e.y, e.z] 
        ]} 
        color={DimensionColor} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[s.x, s.y, 0]}>
          <Text
            fontSize={fontSize}
            color={DimensionColor}
            anchorX="center"
            anchorY="middle"
          >
            {(label * 1).toFixed(2)}m
          </Text>
      </Billboard>
    </group>
  )
}

