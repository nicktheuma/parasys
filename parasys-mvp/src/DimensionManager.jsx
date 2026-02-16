import * as THREE from 'three'
import { Line, Text, Billboard, Html } from '@react-three/drei'
import React, { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// Hook to read CSS color variables from :root
function useCssColors(defaultDim = '#d0d0d0', defaultHover = '#0800ff') {
  const [dimColor, setDimColor] = useState(defaultDim)
  const [hoverColor, setHoverColor] = useState(defaultHover)
  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const dc = s.getPropertyValue('--dimension-color')
    const hc = s.getPropertyValue('--interaction-color')
    if (dc) setDimColor(dc.trim())
    if (hc) setHoverColor(hc.trim())
  }, [])
  return { dimColor, hoverColor }
}

export function PlaneDimensionLine({ start, end, label, centerGap = 0.02, anchorGap = 0.01, dimensionGap=0.03, fontSize = 0.02, setDimension, min = 0.05, max = 2, step = 0.001 }) {
  // Determine plane of the dimension line based on start and end points
  const vectorDiff = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const dimensionGapVector = new THREE.Vector3(0, 0, 0);
  const centerGapVector = new THREE.Vector3(0, 0, 0);
  const anchorGapVector = new THREE.Vector3(0, 0, 0);
  const s = new THREE.Vector3(start[0], start[1], start[2]);
  const e = new THREE.Vector3(end[0], end[1], end[2]);
  const center = new THREE.Vector3((s.x + e.x) / 2, (s.y + e.y) / 2, (s.z + e.z) / 2);
  const center_L = new THREE.Vector3();
  const center_R = new THREE.Vector3();
  centerGap = Math.max(fontSize*1.8, 0.001);

  if (vectorDiff.x === 0 && vectorDiff.z === 0) {
    // Vertical line in XZ plane, dimension is along Y axis
    dimensionGapVector.set(dimensionGap, 0, 0)
    centerGapVector.set(0, centerGap * 0.35, 0)
    anchorGapVector.set(anchorGap, 0, 0)
  } else if (vectorDiff.y === 0 && vectorDiff.z === 0) {
    // Horizontal line in XY plane, dimension is along X axis
    dimensionGapVector.set(0, dimensionGap, 0)
    centerGapVector.set(centerGap, 0, 0)
    anchorGapVector.set(0, anchorGap, 0)
  } else if (vectorDiff.x === 0 && vectorDiff.y === 0) {
    // Horizontal line in YZ plane, dimension is along Z axis
    dimensionGapVector.set(dimensionGap, 0, 0)
    centerGapVector.set(0, 0, centerGap * -0.5)
    anchorGapVector.set(anchorGap, 0, 0)
  }
  s.set(start[0] + dimensionGapVector.x, start[1] + dimensionGapVector.y, start[2] + dimensionGapVector.z)
  e.set(end[0] + dimensionGapVector.x, end[1] + dimensionGapVector.y, end[2] + dimensionGapVector.z)
  center.set(
    (s.x + e.x) / 2,
    (s.y + e.y) / 2,
    (s.z + e.z) / 2,
  )
  center_L.set(center.x - centerGapVector.x, center.y - centerGapVector.y, center.z - centerGapVector.z)
  center_R.set(center.x + centerGapVector.x, center.y + centerGapVector.y, center.z + centerGapVector.z)
  start = [start[0] + anchorGapVector.x, start[1] + anchorGapVector.y, start[2] + anchorGapVector.z]
  end = [end[0] + anchorGapVector.x, end[1] + anchorGapVector.y, end[2] + anchorGapVector.z]

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
  const { dimColor, hoverColor } = useCssColors()

  const onPointerDown = (e) => {
    if (!setDimension) return
    e.stopPropagation()
    dragging.current = true
    try { e.target.setPointerCapture(e.pointerId) } catch {}
    startX.current = e.nativeEvent?.clientX || e.clientX || 0  // Use screen coordinates
    startWidth.current = label
    totalMovement.current = 0  // Reset movement tracking
    if (controls) controls.enabled = false

    // Attach document-level listeners for drag-away behavior
    const handleGlobalMove = (moveEvent) => {
      if (!dragging.current || !setDimension) return
      const screenDx = moveEvent.clientX - startX.current
      totalMovement.current = Math.abs(screenDx)  // Track total movement
      const worldDx = screenDx * 0.01  // Scale screen pixels to world units
      const newWidth = startWidth.current + worldDx * 0.1
      // const snapped = Math.min(max, Math.max(min, Math.round(newWidth / step) * step))
    //   if (snapped !== label) setDimension(snapped)
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
    if (!setDimension) return
    e.stopPropagation()
    // Use screen coordinates for consistency with document listener
    const clientX = e.nativeEvent?.clientX || e.clientX || 0
    const screenDx = clientX - startX.current
    totalMovement.current = Math.abs(screenDx)  // Track total movement
    const worldDx = screenDx * 0.01  // Scale screen pixels to world units
    const newWidth = startWidth.current + worldDx * 0.1 //Adjust for dragging sensitivity
    const snapped = Math.min(max, Math.max(min, Math.round(newWidth / step) * step))
    if (snapped !== label) setDimension(snapped)
  }

  const onPointerUp = (e) => {
    if (!setDimension) return
    e.stopPropagation()
    dragging.current = false
    try { e.target.releasePointerCapture(e.pointerId) } catch {}
    if (controls) controls.enabled = true
  }

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
  }

  const applyInputValue = () => {
    if (!setDimension) return
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue)) {
      const clamped = Math.min(max, Math.max(min, numValue))
      const snapped = Math.round(clamped / step) * step
      setDimension(snapped)
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
      if (dx > 30 || dy > 30) {
        setIsEditing(false)
      }
    }
    document.addEventListener('mousemove', onEditMouseMove)
    return () => document.removeEventListener('mousemove', onEditMouseMove)
  }, [isEditing])

  return (
    <group>
      {/* DevPoints */}
      {/* <CrossMarker position={center_L} /> */}
      {/* <CrossMarker position={center_R} /> */}

      {/* The Main Dimension Line */}
      <Line points={[s, center_L]} color={hovered ? hoverColor : dimColor} lineWidth={1} dashed={false} />
      <Line points={[center_R, e]} color={hovered ? hoverColor : dimColor} lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [s.x, s.y, s.z], 
          [start[0], start[1], start[2]] // Small tick towards source points
        ]}
          color={hovered ? hoverColor : dimColor}
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [e.x, e.y, e.z], 
          [end[0], end[1], end[2]] // Small tick towards source points
        ]} 
          color={hovered ? hoverColor : dimColor} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
        <Billboard position={[center.x, center.y, center.z]} follow={true} lockX={false} lockY={false} lockZ={false}>
          <group>
            <mesh
              position={[0, 0, 0]}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
              onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
            >
              <planeGeometry args={[0.08, 0.03]} />
              <meshBasicMaterial color="#e7e7e7" transparent opacity={0} />
            </mesh>

            {isEditing ? (
              <Html position={[0,0,0]} scale={0.001} distanceFactor={1} center>
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
                    fontSize: (fontSize * 1.2 * 1000) + "px", // Scale up for HTML input
                    anchorX: "center",
                    anchorY: "middle",
                    width: fontSize * 1000 * 5 + "px", // Make input wider to accommodate numbers
                    height: fontSize * 1000 * 1.5 + "px",
                    padding: (fontSize * 1000 * 0.2) + "px" + " " + (fontSize * 1000 * 0.3) + "px",
                    borderRadius: '4px',
                    backgroundColor: '#e7e7e7bc',
                    color: hoverColor,
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </Html>
            ) : (
                <Text className="dimension-label"
                fontSize={fontSize}
                color={hovered ? hoverColor : dimColor}
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