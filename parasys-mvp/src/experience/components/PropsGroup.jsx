import { Suspense } from 'react'

export const PropsGroup = ({ visible, enhancedAssetsReady, LazyProps, width, height, materialThickness }) => {
  if (!enhancedAssetsReady) return null

  return (
    <Suspense fallback={null}>
      <group name="PropsGroup" visible={visible} position={[0, 0, 0]} scale={0.1}>
        <LazyProps
          vasePos={[(width * 10) / 2 - 1, (height * 10) / 2, 0]}
          cylinder004Pos={[-(width * 10) / 2 + 1, -(height * 10) / 2, 0]}
          cylinder003Pos={[-(width * 10) / 2 + 1, -(height * 10) / 2 + materialThickness, 0]}
        />
      </group>
    </Suspense>
  )
}
