import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { HeightDimensionLine, WidthDimensionLine, DepthDimensionLine } from './SceneManager'

export function Experience() {
  
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()
  const Dimensions = useRef()
  const Bounding = useRef()
  const Top = useRef()
  const Bottom = useRef()
  const Left = useRef()
  const Right = useRef()
  const Divider = useRef()

  const mat_Dev = new THREE.MeshStandardMaterial( {map: null, color: '#ff0000', roughness: 1, transparent: true, opacity: 0.3})
  const mat_Chrome = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1})
  const mat_PaintedMetal = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.8, metalness: 0.1})

  const startDims = new THREE.Vector3(0.6, 0.3, 0.1);
  const maxDims = new THREE.Vector3(1, 0.5, 0.35);
  const materialThickness = 0.002; // ex. 2mm Stainless Steel Sheet
  const dividerCount = 1;

  const { width, height, depth, dividers, material, showProps, showDims, showDevTools } = useControls({
    width: { value: startDims.x, min: startDims.x, max: maxDims.x, step: 0.01},
    height: { value: startDims.y, min: startDims.y, max: maxDims.y, step: 0.01},
    depth: { value: startDims.z, min: startDims.z, max: maxDims.z, step: 0.01},
    dividers: { value: 1, min: 0, max: 100, step: 1 },
    material: { options: { Chrome: mat_Chrome, Painted: mat_PaintedMetal } },
    // showProps: false,
    showDims: true,
    showDevTools: false
  })

  useFrame(() => {
    if (Bounding.current) {
      Bounding.current.scale.x = THREE.MathUtils.lerp(Bounding.current.scale.x, width / startDims.x, 0.1)
      Bounding.current.scale.y = THREE.MathUtils.lerp(Bounding.current.scale.y, height / startDims.y, 0.1)
      Bounding.current.scale.z = THREE.MathUtils.lerp(Bounding.current.scale.z, depth / startDims.z, 0.1)
      
      Top.current.scale.set(width/startDims.x, depth/startDims.y, materialThickness / startDims.z);
      Top.current.rotation.set(Math.PI / 2, 0, 0);
      Top.current.position.set(0, (height / 2) - (materialThickness / 2), 0);

      Bottom.current.scale.set(width/startDims.x, depth/startDims.y, materialThickness / startDims.z);
      Bottom.current.rotation.set(-Math.PI / 2, 0, 0);
      Bottom.current.position.set(0, -(height / 2) + (materialThickness / 2), 0);

      Left.current.scale.set(depth/startDims.x, height/startDims.y, materialThickness / startDims.z);
      Left.current.rotation.set(0, Math.PI / 2, 0);
      Left.current.position.set(-(width / 2) + (materialThickness / 2), 0, 0);

      Right.current.scale.set(depth/startDims.x, height/startDims.y, materialThickness / startDims.z);
      Right.current.rotation.set(0, -Math.PI / 2, 0);
      Right.current.position.set((width / 2) - (materialThickness / 2), 0, 0);

    // Move the accessories on the left and right sides
    // const sideOffset = (width-startDims.x)/2
    // leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    // rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)
    }
  })

  return (
    <group dispose={null}>
    {/* PARAMETRIC LOGIC */}
      {/* THE BOUNDING BOX */}
      <mesh ref={Bounding} visible={showDevTools} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={mat_Dev} />

      {/* THE MAIN PIECE */}
      <mesh ref={Top} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />
      <mesh ref={Bottom} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />
      <mesh ref={Left} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />
      <mesh ref={Right} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />

      {/* DIVIDERS */}
      {Array.from({ length: (dividers + 1) }).map((_, i) => {
        const x = -(width / 2) + (width / Math.max(1, (dividers + 1))) * (i)
        return (
          <mesh
            key={`divider-${i}`}
            position={[x, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)}
            material={material}
            scale={[
              depth / startDims.x,
              (height - materialThickness * 2) / startDims.y,
              materialThickness / startDims.z
            ]}
          />
        )
      })}

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
        <WidthDimensionLine 
          start={[-width/2, height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={width.toFixed(2)}
          centerGap={0.05}
          dimensionMargin={0.05}
          anchorGap={0.01}
          fontSize={0.02}
        />

        {/* Height Label */}
        <HeightDimensionLine 
          start={[width/2, -height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={height.toFixed(2)}
          centerGap={0.05}
          dimensionMargin={0.05}
          anchorGap={0.01}
          fontSize={0.02}
        />

        {/* Depth Label */}
        <DepthDimensionLine 
          start={[width/2, -height / 2, depth / 2]} 
          end={[width/2, -height / 2, -depth / 2]} 
          label={depth.toFixed(2)}
          centerGap={0.05}
          dimensionMargin={0.05}
          anchorGap={0.01}
          fontSize={0.02}
        />
      </group>
    </group>
  )
}

//NOTES

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE