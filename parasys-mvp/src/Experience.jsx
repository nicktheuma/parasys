import { useControls } from 'leva'
import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, Line, Text, Billboard } from '@react-three/drei'

export function Experience() {
  // Ensure this matches your actual filename in /public
  const { nodes, materials } = useGLTF('/furniture_6.glb') 
  const startDims = new THREE.Vector3(0.162,2,2);
  const Seat_startDims = new THREE.Vector3(0.148,2,2);
  const Back_startDims = new THREE.Vector3(0.14,2,2);
  const Ornament1_startDims = new THREE.Vector3(0.036,2,2);
  const Ornament2_startDims = new THREE.Vector3(0.0294,2,2);

  const consoleRef = useRef()
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()
  const C_BackRef = useRef()
  const C_OrnamentRef1 = useRef()
  const C_OrnamentRef2 = useRef()
  const C_SeatRef = useRef()
  const Dimensions = useRef()

  const mat_Mirror = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1})
  const mat_Solid = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.8, metalness: 0.1})

  const { width, material, showProps, showDims } = useControls({
    width: { value: startDims.x, min: startDims.x, max: 0.3, step: 0.01},
    material: { options: { Default: materials['chair'], Mirror: mat_Mirror, Solid: mat_Solid } },
    showProps: true,
    showDims: true
  })

  // Calculate coordinates based on scale
  const w = width / 2

  useFrame(() => {
    // 1. Scale the main console body
    const Seat_width_factor = (width-0.014) / Seat_startDims.x;
    const Back_width_factor = (width-0.022) / Back_startDims.x;
    const Ornament1_width_factor = (width-0.125) / Ornament1_startDims.x;
    const Ornament2_width_factor = (width-0.13) / Ornament2_startDims.x;

    C_OrnamentRef1.current.scale.x = THREE.MathUtils.lerp(C_OrnamentRef1.current.scale.x, Ornament1_width_factor, 0.1)
    C_OrnamentRef2.current.scale.x = THREE.MathUtils.lerp(C_OrnamentRef2.current.scale.x, Ornament2_width_factor, 0.1)
    C_SeatRef.current.scale.x = THREE.MathUtils.lerp(C_SeatRef.current.scale.x, Seat_width_factor, 0.1)
    C_BackRef.current.scale.x = THREE.MathUtils.lerp(C_BackRef.current.scale.x, Back_width_factor, 0.1)
    
    // 2. Move the accessories on the left and right sides
    const sideOffset = (width-startDims.x)/2
    leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
  })

  return (
    <group dispose={null}>
      {/* THE MAIN PIECE */}
      <mesh ref={C_OrnamentRef1} geometry={nodes.COrnament_Medieval_chair.geometry} material={material} />
      <mesh ref={C_OrnamentRef2} geometry={nodes.COrnament_Medieval_chair_001.geometry} material={material} />
      <mesh ref={C_SeatRef} geometry={nodes.CSeat_Medieval_chair.geometry} material={material} />
      <mesh ref={C_BackRef} geometry={nodes.CBack_Medieval_chair.geometry} material={material} />

      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      <group ref={leftGroupRef}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={material}  />
        <mesh geometry={nodes.LOrnament_Medieval_chair.geometry} material={material} />
        <mesh geometry={nodes.LOrnament_Medieval_chair_001.geometry} material={material} />
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef}>
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={material}  />
        <mesh geometry={nodes.ROrnament_Medieval_chair.geometry} material={material} />
        <mesh geometry={nodes.ROrnament_Medieval_chair_001.geometry} material={material} />
      </group>

      {/* DIMENSIONS */}
      <group ref={Dimensions} visible={showDims}>
        {/* Width Label (Bottom Front) */}
        <DimensionLine 
          start={[-w, 0.12, -0.03]} 
          end={[w, 0.12, -0.03]} 
          label={width.toFixed(2)} 
        />
      </group>

      {/* CENTER PIECES (Stay in the middle) */}
      {/* <group visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={materials['chair']}  />
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={materials['chair']}  />
      </group> */}
    </group>
  )
}

function DimensionLine({ start, end, label, offset = 0.01 }) {
  // Calculate the center point for the label
  const center = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  const center_L = [center[0] - offset, center[1], center[2]]
  const center_R = [center[0] + offset, center[1], center[2]]

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[start, center_L]} color='#b0b0b0' lineWidth={1} dashed={false} />
      <Line points={[center_R, end]} color='#b0b0b0' lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [start[0], start[1], start[2]], 
          [start[0], start[1] - 0.005, start[2]] // Small tick downwards
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [end[0], end[1], end[2]], 
          [end[0], end[1] - 0.005, end[2]] 
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[0, 0.12, -0.03]}>
          <Text
            fontSize={0.005}
            color='#6b6b6b'
            anchorX="center"
            anchorY="middle"
          >
            {(label * 10).toFixed(2)}m
          </Text>
      </Billboard>
    </group>
  )
}

//NOTES

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE