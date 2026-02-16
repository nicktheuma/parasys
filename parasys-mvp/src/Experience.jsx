import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { HeightDimensionLine, WidthDimensionLine, DepthDimensionLine } from './SceneManager'
import { GenerateSimpleNoiseTexture, GeneratePerlinNoiseTexture } from './NoiseGenerator'

export function Experience() {
  
  const leftGroupRef = useRef()
  const rightGroupRef = useRef()
  const Dimensions = useRef()
  const Bounding = useRef()
  const Top = useRef()
  const Bottom = useRef()
  const Back = useRef()

  const mat_Dev = new THREE.MeshStandardMaterial( {map: null, color: '#ff0000', roughness: 1, transparent: true, opacity: 0.3})
  const mat_MATCAP = new THREE.MeshMatcapMaterial( {map: null, color: '#ffffff'})
  const mat_PBR = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1})
  const mat_Chrome = new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1})
  const mat_PaintedMetal = new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.5, metalness: 0.5})

  const startDims = new THREE.Vector3(0.3, 0.1, 0.05);
  const maxDims = new THREE.Vector3(1.2, 0.3, 0.2);
  const materialThickness = 0.002; // ex. 2mm Stainless Steel Sheet
  
  const { width, height, depth, dividers, edgeOffset, slotOffset, material, showProps, showDims, showDevTools, x1, x2, y1, y2 } = useControls({
    width: { value: startDims.x, min: startDims.x, max: maxDims.x, step: 0.01},
    height: { value: startDims.y, min: startDims.y, max: maxDims.y, step: 0.01},
    depth: { value: startDims.z, min: startDims.z, max: maxDims.z, step: 0.01},
    dividers: { value: 1, min: 0, max: 4, step: 1 },
    edgeOffset: { value: 0.05, min: 0, max: 0.2, step: 0.01 },
    slotOffset: { value: 0.01, min: 0.015, max: 0.15, step: 0.001 },
    material: { options: { Chrome: mat_Chrome, Painted: mat_PaintedMetal, PBR: mat_PBR, MATCAP: mat_MATCAP } },
    showDims: true,
    showDevTools: false,
    x1: { value: 0.00, min: 0.001, max: 10, step: 0.001 },
    y1: { value: 0.95, min: 0.001, max: 10, step: 0.001 },
    x2: { value: 0.52, min: 0.1, max: 10, step: 0.01 },
    y2: { value: 0.1, min: 0.1, max: 10, step: 0.01 }
  })

  const noiseCanvas = useMemo(() => GeneratePerlinNoiseTexture(512, 512, x1, y1, x2, y2))
  const noiseTexture = new THREE.CanvasTexture(noiseCanvas)
  noiseTexture.magFilter = THREE.LinearFilter
  noiseTexture.minFilter = THREE.LinearMipmapLinearFilter
  // mat_PBR.map = noiseTexture;
  mat_PBR.roughnessMap = noiseTexture;
  // mat_PBR.normalMap = noiseTexture;
  // mat_PBR.displacementMap = noiseTexture;
  // mat_PBR.displacementScale = 0.1;

  useFrame(() => {
    {/* PARAMETRIC LOGIC */}
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

      Back.current.scale.set(width/startDims.x, height/startDims.y, materialThickness / startDims.z);
      Back.current.rotation.set(0, 0, Math.PI);
      Back.current.position.set(0, 0, -(depth / 2) + (materialThickness / 2));
    }
  })

  return (
    <group dispose={null}>
      <group name="DevToolGroup">
        {/* THE BOUNDING BOX */}
        <mesh  ref={Bounding} visible={showDevTools} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={mat_Dev} />
      </group>
    
      <group name="FurnitureGroup">
        {/* PARAMETRIC LOGIC */}

        {/* THE MAIN PIECE */}
        <mesh ref={Top} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />
        <mesh ref={Bottom} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />
        <mesh ref={Back} geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)} material={material} />

        {/* DIVIDERS */}
        {Array.from({ length: (dividers + 2) }).map((_, i) => {
          const widthAdjusted = width - materialThickness - (edgeOffset * 2);
          const x = -(widthAdjusted / 2) + (widthAdjusted / Math.max(1, (dividers + 1))) * (i)
          return (
            <mesh
              key={`divider-${i}`}
              position={[x, 0, -(slotOffset/2)]}
              rotation={[0, -Math.PI / 2, 0]}
              geometry={new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z)}
              material={material}
              scale={[
                ((depth - slotOffset) / startDims.x),
                (height + (slotOffset * 2) - (materialThickness * 2)) / startDims.y,
                materialThickness / startDims.z
              ]}
            />
          )
        })}

      </group>

      <group name="DimensionsGroup" ref={Dimensions} visible={showDims}>
        {/* Width Label - OVERALL*/}
        <WidthDimensionLine 
          start={[-width/2, height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={width.toFixed(2)}
          centerGap={0.05}
          dimensionMargin={0.05}
          anchorGap={0.01}
          fontSize={0.02}
        />

        {/* Height Label - OVERALL*/}
        <HeightDimensionLine 
          start={[width/2, -height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={height.toFixed(2)}
          centerGap={0.05}
          dimensionMargin={0.05}
          anchorGap={0.01}
          fontSize={0.02}
        />

        {/* Depth Label - OVERALL*/}
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

    // Move the accessories on the left and right sides
    // const sideOffset = (width-startDims.x)/2
    // leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    // rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)

      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      // <group ref={leftGroupRef}>
      // </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      // <group ref={rightGroupRef}>
      // </group>

      {/* CENTER PIECES (Stay in the middle) */}
      // <group visible={showProps}>
      // </group>