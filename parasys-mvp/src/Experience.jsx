import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { PlaneDimensionLine } from './DimensionManager'
import { GeneratePerlinNoiseTexture } from './NoiseGenerator'
import { Props_1 } from './Props_1'

export function Experience() {
  
  // const leftGroupRef = useRef()
  // const rightGroupRef = useRef()
  const Dimensions = useRef()
  const Bounding = useRef()
  const Back = useRef()
  const FurnitureGroup = useRef()

  const startDims = new THREE.Vector3(0.3, 0.1, 0.05);
  const maxDims = new THREE.Vector3(1.2, 0.3, 0.2);
  const materialThickness = 0.002;
  // const MinMax_span = new THREE.Vector2(0.15, 0.6); // Minimum & maximum distance between dividers/shelves to avoid unbuildable scenarios
  // let desired_Dividers = 0;

  // Memoize materials to avoid recreating them every render
  const materials = useMemo(() => ({
    mat_Dev: new THREE.MeshStandardMaterial( {map: null, color: '#ff0000', roughness: 1, transparent: true, opacity: 0.3}),
    mat_Dev_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#ff0000', wireframe: true, wireframeLinewidth: 0.1}),
    mat_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#000000', wireframe: true, wireframeLinewidth: 0.1}),
    mat_MATCAP: new THREE.MeshMatcapMaterial( {map: null, color: '#ffffff'}),
    mat_PBR: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1}),
    mat_Chrome: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1}),
    mat_PaintedMetal: new THREE.MeshStandardMaterial( {map: null, color: '#646a39', roughness: 0.5, metalness: 0.5})
  }), [])

  const { mat_Dev, mat_Dev_Wireframe, mat_Wireframe, mat_MATCAP, mat_PBR, mat_Chrome, mat_PaintedMetal } = materials
  
  const [controls, setControls] = useControls(() => ({
    width: { value: startDims.x, min: startDims.x, max: maxDims.x, step: 0.01},
    height: { value: startDims.y, min: startDims.y, max: maxDims.y, step: 0.01},
    depth: { value: startDims.z, min: startDims.z, max: maxDims.z, step: 0.01},
    shelves: { value: 1, min: 0, max: 4, step: 1 },
    dividers: { value: 1, min: 0, max: 4, step: 1 },  // ((get) => get('width')
    edgeOffset: { value: 0.05, min: 0, max: 0.2, step: 0.01 },
    slotOffset: { value: 0.01, min: 0.015, max: 0.15, step: 0.001 },
    material: { options: { PBR: mat_PBR, Chrome: mat_Chrome, Painted: mat_PaintedMetal, MATCAP: mat_MATCAP, Wireframe: mat_Wireframe } },
    showDims: true,
    showProps: false,
    showDevTools: false,
    x1: { value: 0.00, min: 0.001, max: 10, step: 0.1, render: get => get('showDevTools') },
    y1: { value: 0.95, min: 0.001, max: 10, step: 0.1, render: get => get('showDevTools')  },
    x2: { value: 0.52, min: 0.1, max: 10, step: 0.1, render: get => get('showDevTools')  },
    y2: { value: 0.1, min: 0.1, max: 10, step: 0.1, render: get => get('showDevTools')  },
  }))

  const { width, height, depth, dividers, shelves, edgeOffset, slotOffset, material, showProps, showDims, showDevTools, x1, x2, y1, y2 } = controls

  // Memo-ise noise texture with proper dependency array (reduced resolution for perf)
  const noiseTexture = useMemo(() => {
    const noiseCanvas = GeneratePerlinNoiseTexture(256, 256, x1, y1, x2, y2)
    const tex = new THREE.CanvasTexture(noiseCanvas)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    return tex
  }, [x1, y1, x2, y2])

  // Update mat_PBR roughness map when texture changes
  useMemo(() => {
    if (mat_PBR) mat_PBR.roughnessMap = noiseTexture
  }, [noiseTexture, mat_PBR])

  // Memo-ise geometries to avoid recreating them every render
  const geometries = useMemo(() => ({
    boxMain: new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z),
  }), [])

  const { boxMain } = geometries

  useFrame(() => {
    {/* PARAMETRIC LOGIC */}
    if (Bounding.current && showDevTools===true) {
      Bounding.current.scale.x = THREE.MathUtils.lerp(Bounding.current.scale.x, width / startDims.x, 0.1)
      Bounding.current.scale.y = THREE.MathUtils.lerp(Bounding.current.scale.y, height / startDims.y, 0.1)
      Bounding.current.scale.z = THREE.MathUtils.lerp(Bounding.current.scale.z, depth / startDims.z, 0.1)
    }
    
    if (Back.current) {
      Back.current.scale.set(width/startDims.x, height/startDims.y, materialThickness / startDims.z);
      Back.current.rotation.set(-Math.PI, 0, 0);
      Back.current.position.set(0, 0, -(depth / 2) + (materialThickness / 2));
    }
  })

  return (
    <group dispose={null}>
      <group name="DevToolGroup">
        {/* THE BOUNDING BOX */}
        <mesh  ref={Bounding} visible={showDevTools} geometry={boxMain} material={mat_Dev_Wireframe} />
      </group>
    
      <group name="FurnitureGroup" ref={FurnitureGroup}>
        {/* PARAMETRIC LOGIC */}

        {/* THE MAIN PIECE */}
        {/* <mesh ref={Top} geometry={boxMain} material={material} /> */}
        {/* <mesh ref={Bottom} geometry={boxMain} material={material} /> */}
        <mesh ref={Back} geometry={boxMain} material={material} />

        {/* VERTICAL SHEETS YZ */}
        {Array.from({ length: (dividers + 2) }).map((_, i) => {
          const widthAdjusted = width - materialThickness - (edgeOffset * 2);
          const x = -(widthAdjusted / 2) + (widthAdjusted / Math.max(1, (dividers + 1))) * (i)
          return (
            <mesh
              key={`xy-sheet-${i}`}
              position={[x, 0, -(slotOffset/2)]}
              rotation={[0, -Math.PI / 2, 0]}
              geometry={boxMain}
              material={material}
              scale={[
                ((depth - slotOffset) / startDims.x),
                (height + (slotOffset * 2) - (materialThickness * 2)) / startDims.y,
                materialThickness / startDims.z
              ]}
            />
          )
        })}

        {/* HORIZONTAL SHEETS XY */}
        {Array.from({ length: (shelves + 2) }).map((_, i) => {
          const AdjustedHeight = height - materialThickness;
          const x = (AdjustedHeight / Math.max(1, (shelves + 1))) * (i)
          return (
            <mesh
              key={`yz-sheet-${i}`}
              position={[0, (AdjustedHeight / 2) - x, 0]}
              rotation={[0, 0, 0]}
              geometry={boxMain}
              material={material}
              scale={[
                width / startDims.x,
                materialThickness / startDims.y,
                depth / startDims.z
              ]}
            />
          )
        })}

      </group>

      <group name="DimensionsGroup" ref={Dimensions} visible={showDims}>
        {/* Width Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[-width/2, height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={width}
          setDimension={(v) => setControls({ width: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />

        {/* Height Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[width/2, -height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={height}
          setDimension={(v) => setControls({ height: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />

        {/* Depth Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[width/2, -height / 2, depth / 2]} 
          end={[width/2, -height / 2, -depth / 2]} 
          label={depth}
          setDimension={(v) => setControls({ depth: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />
      </group>

      {/* Props Instance */}
      <group name="PropsGroup" visible={showProps} position={[0, 0, 0]} scale={0.1}>
        <Props_1 
          vasePos={[(width*10)/2 - 1, (height*10)/2, 0]}
          cylinder004Pos={[-(width*10)/2 + 1, -(height*10)/2, 0]}
          cylinder003Pos={[-(width*10)/2 + 2, -(height*10)/2, 0]}
          cylinder001Pos={[(width*10)/2 + 3, (height*10)/2, 0]}
          cube008Pos={[(width*10)/2 + 1.5, (height*10)/2, 0]}
          cube004Pos={[-(width*10)/2 + 3, -(height*10)/2, 0]}
          cube004_1Pos={[-(width*10)/2 + 2, -(height*10)/2, 0]}
          cube003Pos={[-(width*10)/2 + 2.5, (height*10)/2, 0]}
          cube003_1Pos={[-(width*10)/2 + 1, (height*10)/2, 0]}
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