import { useEffect } from 'react'

export const useSceneLightSetup = ({ lightRef, lightPos, lightTarget, intensity }) => {
  useEffect(() => {
    if (!lightRef.current) return

    lightRef.current.position.set(lightPos[0], lightPos[1], lightPos[2])
    lightRef.current.target.position.set(lightTarget[0], lightTarget[1], lightTarget[2])
    lightRef.current.intensity = intensity * 100
    lightRef.current.updateMatrixWorld()
    lightRef.current.target.updateMatrixWorld()
  }, [lightRef, lightPos, lightTarget, intensity])
}
