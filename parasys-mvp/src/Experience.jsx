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

  const mat_Mirror = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0, metalness: 1})
  const mat_Solid = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.8, metalness: 0.1})

  const { width, material, showProps } = useControls({
    width: { value: startDims.x, min: startDims.x, max: 0.3, step: 0.01},
    material: { options: { Default: materials['chair'], Mirror: mat_Mirror, Solid: mat_Solid } },
    showProps: true // Toggle for props
  })

  useFrame(() => {
    // 1. Scale the main console body
    const width_factor = width / startDims.x;
    consoleRef.current.scale.x = THREE.MathUtils.lerp(consoleRef.current.scale.x, width_factor, 0.1)
    
    // 2. Move the accessories on the left and right sides
    const sideOffset = (width-startDims.x)/2
    leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
  })

  return (
    <group dispose={null}>
      {/* THE MAIN PIECE */}
      <mesh ref={consoleRef} geometry={nodes.C_Medieval_chair.geometry} material={material}/>
      
      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      <group ref={leftGroupRef} visible={showProps}>
        <mesh geometry={nodes.L_Medieval_chair.geometry} material={material}  />
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef} visible={showProps}>
        <mesh geometry={nodes.R_Medieval_chair.geometry} material={material}  />
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