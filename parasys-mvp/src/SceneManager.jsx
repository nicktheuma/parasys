import * as THREE from 'three'
import { Line, Text, Billboard, Html } from '@react-three/drei'
import React, { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'

const DimensionColor = '#d0d0d0';
const DimensionHoverColor = '#0800ff';

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
  const totalMovement = useRef(0)  // Track total pixel movement to detect click vs drag
  const editStart = useRef({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(label.toFixed(2))
  const inputRef = useRef(null)
  const { controls } = useThree()

  const onPointerDown = (e) => {
    if (!setWidth) return
    e.stopPropagation()
    dragging.current = true
    try { e.target.setPointerCapture(e.pointerId) } catch {}
    startX.current = e.nativeEvent?.clientX || e.clientX || 0  // Use screen coordinates
    startWidth.current = label
    totalMovement.current = 0  // Reset movement tracking
    if (controls) controls.enabled = false

    // Attach document-level listeners for drag-away behavior
    const handleGlobalMove = (moveEvent) => {
      if (!dragging.current || !setWidth) return
      const screenDx = moveEvent.clientX - startX.current
      totalMovement.current = Math.abs(screenDx)  // Track total movement
      const worldDx = screenDx * 0.01  // Scale screen pixels to world units
      const newWidth = startWidth.current + worldDx * 2
      const snapped = Math.min(max, Math.max(min, Math.round(newWidth / step) * step))
      if (snapped !== label) setWidth(snapped)
    }

    const handleGlobalUp = (upEvent) => {
      dragging.current = false
      if (controls) controls.enabled = true
      document.removeEventListener('mousemove', handleGlobalMove)
      document.removeEventListener('mouseup', handleGlobalUp)

      // If movement was minimal, treat as click and enable editing
      if (totalMovement.current < 5) {
        setIsEditing(true)
        setInputValue(label.toFixed(2))
        editStart.current = { x: upEvent?.clientX || startX.current, y: upEvent?.clientY || 0 }
      }
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
    totalMovement.current = Math.abs(screenDx)  // Track total movement
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

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
  }

  const applyInputValue = () => {
    if (!setWidth) return
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue)) {
      const clamped = Math.min(max, Math.max(min, numValue))
      const snapped = Math.round(clamped / step) * step
      setWidth(snapped)
    }
    setIsEditing(false)
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyInputValue()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // While editing, hide input if the mouse is moved after entering edit mode
  React.useEffect(() => {
    if (!isEditing) return
    const onEditMouseMove = (e) => {
      const dx = Math.abs(e.clientX - editStart.current.x)
      const dy = Math.abs((e.clientY || 0) - editStart.current.y)
      if (dx > 5 || dy > 5) {
        setIsEditing(false)
      }
    }
    document.addEventListener('mousemove', onEditMouseMove)
    return () => document.removeEventListener('mousemove', onEditMouseMove)
  }, [isEditing])

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

          {isEditing ? (
            <Html position={[center[0] - (Math.abs(center_R[0] - center_L[0]))/2, center[1] - (Math.abs(center_R[0] - center_L[0]))*13/16, center[2]]} scale={0.001} distanceFactor={1}>
              <input
                ref={inputRef}
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={applyInputValue}
                onKeyDown={handleInputKeyDown}
                step={step}
                min={min}
                max={max}
                style={{
                  anchorX: 'center',
                  anchorY: 'middle',
                  width: Math.abs(center_R[0] - center_L[0])/1.5 * 1000, // Scale up for HTML input
                  height: '20px',
                  padding: '4px 8px',
                  fontSize: '14px',
                  border: '1px solid #ff0000',
                  borderColor: DimensionHoverColor,
                  borderRadius: '4px',
                  backgroundColor: '#ffffff15',
                  color: DimensionHoverColor,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </Html>
          ) : (
            <Text className="dimension-label"
              fontSize={fontSize}
              color={hovered ? DimensionHoverColor : DimensionColor}
              anchorX="center"
              anchorY="middle"
            >
              {(label * 1).toFixed(2)}m
            </Text>
          )}
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

