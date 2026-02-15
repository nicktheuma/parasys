import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { DimensionLine } from './SceneManager'

export function Experience() {
  
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()
  const Dimensions = useRef()
  const Sheet = useRef()

  const mat_Chrome = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1})
  const mat_PaintedMetal = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.8, metalness: 0.1})

  const startDims = new THREE.Vector3(1, 1, 1);
  const maxDims = new THREE.Vector3(2,2,2);

  const dimensionMargin = 0.1;

  const { width, material, showProps, showDims } = useControls({
    width: { value: startDims.x, min: startDims.x, max: maxDims.x, step: 0.01},
    material: { options: { Chrome: mat_Chrome, Painted: mat_PaintedMetal } },
    // showProps: true,
    showDims: true
  })

  useFrame(() => {
    if (Sheet.current) {
      Sheet.current.scale.x = THREE.MathUtils.lerp(Sheet.current.scale.x, width / startDims.x, 0.1)
    }
    // Move the accessories on the left and right sides
    // const sideOffset = (width-startDims.x)/2
    // leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    // rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
  })

  return (
    <group dispose={null}>
      {/* PARAMETRIC LOGIC */}
      {/* THE MAIN PIECE */}
      <mesh ref={Sheet} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />

      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      <group ref={leftGroupRef}>
      </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      <group ref={rightGroupRef}>
      </group>

      {/* CENTER PIECES (Stay in the middle) */}
      <group visible={showProps}>
      </group>

      {/* DIMENSIONS */}
      <group ref={Dimensions} visible={showDims}>
        {/* Width Label */}
        <DimensionLine 
          start={[-width/2, startDims.y / 2 + dimensionMargin, startDims.z / 2]} 
          end={[width/2, startDims.y / 2 + dimensionMargin, startDims.z / 2]} 
          label={width.toFixed(2)} 
        />
      </group>
    </group>
  )
}

//NOTES

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE