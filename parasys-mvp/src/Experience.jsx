import { useControls } from 'leva'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

export function Experience() {
  const { width, material, showProps } = useControls({
    width: { value: 1.5, min: 1, max: 2.5, step: 0.01 },
    material: { options: { Default: '#999999', Wood: '#5d4037', Modern: '#222222', Alabaster: '#f5f5f5' } },
    showProps: true,
    showGrid: false,
  })

  // Ensure this matches your actual filename in /public
  const { nodes, materials } = useGLTF('/console_2.glb') 
  
  const consoleRef = useRef()
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()

  useFrame(() => {
    // 1. Scale the main console body
    consoleRef.current.scale.x = THREE.MathUtils.lerp(consoleRef.current.scale.x, width, 0.1)
    
    // 2. Move the accessories on the left and right sides
    const sideOffset = width / 2
    leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
  })

  return (
    <group dispose={null}>
      {/* <gridHelper args={[100, 100]} visible={showGrid}/> */}
      {/* THE MAIN PIECE */}
      {/* <mesh ref={consoleRef} geometry={nodes.CONSOLE001.geometry} material={materials['WOOD MATERIAL']} envMapIntensity={2.5} roughness={0.4} metalness={0.1} color={'#ffffff'} /> */}
      <mesh ref={consoleRef} geometry={nodes.Plane011.geometry}>
        <meshStandardMaterial color={material} roughness={0.4} />
      </mesh>
      
      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      <group ref={leftGroupRef} visible={showProps}>
        <mesh geometry={nodes.BOOKS003.geometry} material={materials['PAPER MATERIAL']} />
        <mesh geometry={nodes.BOOKS004.geometry} material={materials['BOOK COVER MATERIAL.002']}  />
        <mesh geometry={nodes.Circle003_2.geometry}><meshStandardMaterial color={'#ffffff'} roughness={0} emissive={'#ff0000'} emissiveIntensity={1.5} /></mesh>
        <mesh geometry={nodes.Circle003_3.geometry} material={materials['WHITE PANEL.001']}  />
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef} visible={showProps}>
        {/* <mesh geometry={nodes.LAMP005.geometry} material={materials['FABRIC MATERIAL']} />  */}
        <mesh geometry={nodes.BOOKS009.geometry} material={materials['BOOK COVER MATERIAL.004']} />
        <mesh geometry={nodes.GOBLETS.geometry} material={materials['METAL MATERIAL.001']}  />
        {/* <mesh geometry={nodes.DOOR_HANDLES.geometry} material={materials['METAL MATERIAL.002']}  /> */}
      </group>

      {/* CENTER PIECES (Stay in the middle) */}
      <group visible={showProps}>
        <mesh geometry={nodes.BOWL.geometry} material={materials['MARBLE MATERIAL.02']}  />
        <mesh geometry={nodes.HOLDER.geometry} material={materials['WOOD MATERIAL.001']}  />
        {/* <mesh geometry={nodes.PAINTING004.geometry} material={materials['PANITING MATERIAL']} /> */}
        <mesh geometry={nodes.BOOKS003.geometry} material={materials['BOOK COVER MATERIAL.005']}  />
      </group>
    </group>
  )
}


// NOTES

        {/* <mesh geometry={nodes.LAMP005.geometry}>
            <meshStandardMaterial 
                {...materials['FABRIC MATERIAL']} // This spreads all the maps (map, normal, etc.)
                roughness={0.6}   // Fine-tune the "Blender look" here
                metalness={0.1}
                envMapIntensity={1.5} // Boosts the "Luxury" reflections
            />
        </mesh> */}

        {/* <mesh geometry={nodes.LAMP003.geometry} material={materials['GLASS MATERIAL']}/> */}
            {/* <meshStandardMaterial {...materials['GLASS MATERIAL']} roughness={0.4} />   
        </mesh> */}