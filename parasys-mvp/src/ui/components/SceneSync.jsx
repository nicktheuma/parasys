import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

import { useSceneStore } from '../../useSceneStore'

export const SceneSync = () => {
  const { scene, camera, gl } = useThree()
  const setScene = useSceneStore((state) => state.setScene)
  const setRenderContext = useSceneStore((state) => state.setRenderContext)

  useEffect(() => {
    setScene(scene)
    setRenderContext({ camera, renderer: gl })
  }, [scene, camera, gl, setScene, setRenderContext])

  return null
}
