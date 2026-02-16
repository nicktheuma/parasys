import * as THREE from 'three'
import { Line, Text, Billboard } from '@react-three/drei'

export function DimensionLine({ start, end, label, centerGap = 0.1, anchorGap = 0.02, dimensionGap=0.05,fontSize = 0.05 }) {
  // Calculate the center point for the label
  const s = new THREE.Vector3(start[0], start[1] + dimensionGap, start[2]);
  const e = new THREE.Vector3(end[0], end[1] + dimensionGap, end[2]);  
  
  const center = [
    (s.x + e.x) / 2,
    (s.y + e.y) / 2,
    (s.z + e.z) / 2,
  ]
  const center_L = [center[0] - centerGap, center[1], center[2]]
  const center_R = [center[0] + centerGap, center[1], center[2]]

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[s, center_L]} color='#b0b0b0' lineWidth={1} dashed={false} />
      <Line points={[center_R, e]} color='#b0b0b0' lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [s.x, s.y, s.z], 
          [s.x, s.y -  (dimensionGap - anchorGap), s.z] // Small tick downwards
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [e.x, e.y, e.z], 
          [e.x, e.y - (dimensionGap - anchorGap), e.z] 
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[0, s.y, s.z]}>
          <Text
            fontSize={fontSize
            }
            color='#6b6b6b'
            anchorX="center"
            anchorY="middle"
          >
            {(label * 1).toFixed(2)}m
          </Text>
      </Billboard>
    </group>
  )
}
