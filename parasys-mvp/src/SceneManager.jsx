import { Line, Text, Billboard } from '@react-three/drei'

export function DimensionLine({ start, end, label, centerGap = 0.1, fontSize = 0.05 }) {
  // Calculate the center point for the label
  const center = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  const center_L = [center[0] - centerGap, center[1], center[2]]
  const center_R = [center[0] + centerGap, center[1], center[2]]

  return (
    <group>
      {/* The Main Dimension Line */}
      <Line points={[start, center_L]} color='#b0b0b0' lineWidth={1} dashed={false} />
      <Line points={[center_R, end]} color='#b0b0b0' lineWidth={1} dashed={false} />

      {/* Left Extension (Witness) Line */}
      <Line 
        points={[
          [start[0], start[1], start[2]], 
          [start[0], start[1] - centerGap, start[2]] // Small tick downwards
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* Right Extension (Witness) Line */}
      <Line 
        points={[
          [end[0], end[1], end[2]], 
          [end[0], end[1] - centerGap, end[2]] 
        ]} 
        color={'#b0b0b0'} 
        lineWidth={1} 
      />
      
      {/* The Label - Using Billboard so it always faces us */}
      <Billboard position={[0, start[1], start[2]]}>
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
