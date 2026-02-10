import { useControls } from 'leva'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

export function Experience() {
  // Ensure this matches your actual filename in /public
  const { nodes, materials } = useGLTF('/furniture_4.glb') 
  const startDims = new THREE.Vector3(0.151748,2,2);
  
  const consoleRef = useRef()
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()

  const { width, material, showProps } = useControls({
    width: { value: 1.8, min: startDims.x, max: 1, step: 0.01},
    material: { options: { Default: '#999999', Wood: '#5d4037', Modern: '#222222', Alabaster: '#f5f5f5' } },
    showProps: true // Toggle for the books/goblets
  })

  useFrame(() => {
    // 1. Scale the main console body
    const width_factor = width / startDims.x;
    consoleRef.current.scale.x = THREE.MathUtils.lerp(consoleRef.current.scale.x, width_factor, 0.1)

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE
    
    // 2. Move the accessories on the left and right sides
    const sideOffset = (width-startDims.x)/2
    leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
  })

  return (
    <group dispose={null}>
      {/* THE MAIN PIECE */}
      {/* <mesh ref={consoleRef} geometry={nodes.CONSOLE001.geometry} material={materials['WOOD MATERIAL']} envMapIntensity={2.5} roughness={0.4} metalness={0.1} color={'#ffffff'} /> */}
      {/* <mesh ref={consoleRef} geometry={nodes.C_Medieval_chair}>
        <meshStandardMaterial color={material} roughness={0.4} />
      </mesh> */}
      <mesh ref={consoleRef} geometry={nodes.C_Medieval_chair.geometry} material={materials['chair']} />
      
      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      <group ref={leftGroupRef} visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={materials['chair']}  />
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef} visible={showProps}>
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={materials['chair']}  />
      </group>

      {/* CENTER PIECES (Stay in the middle) */}
      {/* <group visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={materials['chair']}  />
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={materials['chair']}  />
      </group> */}
    </group>
  )
}