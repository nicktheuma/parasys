import { useControls } from 'leva'
import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

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

  const mat_Mirror = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0, metalness: 1})
  const mat_Solid = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.8, metalness: 0.1})

  const { width, material, showProps } = useControls({
    width: { value: startDims.x, min: startDims.x, max: 0.3, step: 0.01},
    material: { options: { Default: materials['chair'], Mirror: mat_Mirror, Solid: mat_Solid } },
    showProps: true // Toggle for props
  })

  useFrame(() => {
    // const box = new THREE.Box3().setFromObject(C_BackRef)
    // const size = new THREE.Vector3()
    // box.getSize(size)
    // console.log(size.x)

    // 1. Scale the main console body
    const Seat_width_factor = (width-0.014) / Seat_startDims.x;
    const Back_width_factor = (width-0.022) / Back_startDims.x;
    const Ornament1_width_factor = (width-0.125) / Ornament1_startDims.x;
    const Ornament2_width_factor = (width-0.13) / Ornament2_startDims.x;

    C_OrnamentRef1.current.scale.x = THREE.MathUtils.lerp(C_OrnamentRef1.current.scale.x, Ornament1_width_factor, 0.1)
    C_OrnamentRef2.current.scale.x = THREE.MathUtils.lerp(C_OrnamentRef2.current.scale.x, Ornament2_width_factor, 0.1)
    C_SeatRef.current.scale.x = THREE.MathUtils.lerp(C_SeatRef.current.scale.x, Seat_width_factor, 0.1)
    C_BackRef.current.scale.x = THREE.MathUtils.lerp(C_BackRef.current.scale.x, Back_width_factor, 0.1)
    // console.log(C_BackRef.current.scale.x, Back_width_factor)
    
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
      <group ref={leftGroupRef} visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={material}  />
        <mesh geometry={nodes.LOrnament_Medieval_chair.geometry} material={material} />
        <mesh geometry={nodes.LOrnament_Medieval_chair_001.geometry} material={material} />
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef} visible={showProps}>
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={material}  />
        <mesh geometry={nodes.ROrnament_Medieval_chair.geometry} material={material} />
        <mesh geometry={nodes.ROrnament_Medieval_chair_001.geometry} material={material} />
      </group>

      {/* CENTER PIECES (Stay in the middle) */}
      {/* <group visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={materials['chair']}  />
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={materials['chair']}  />
      </group> */}
    </group>
  )
}

//NOTES

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE