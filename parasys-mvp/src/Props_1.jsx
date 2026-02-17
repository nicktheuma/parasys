import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

const GLB_PATH = import.meta.env.BASE_URL + 'Props_1-transformed.glb'

export function Props_1(props) {
  const { nodes, materials } = useGLTF(GLB_PATH)
  const {
    vasePos = [0, 0, 0],
    cylinder004Pos = [0, 0, 0],
    cylinder003Pos = [0, 0, 0],
    cylinder001Pos = [0, 0, 0],
    cube008Pos = [0, 0, 0],
    cube004Pos = [0, 0, 0],
    cube004_1Pos = [0, 0, 0],
    cube003Pos = [0, 0, 0],
    cube003_1Pos = [0, 0, 0],
  } = props

  return (
    <group dispose={null}>
      <mesh receiveShadow={true} castShadow={true} position={vasePos} geometry={nodes.vase_7001.geometry} scale={2} material={materials['ceremic.001']} />
      <mesh castShadow={true} position={cylinder004Pos} geometry={nodes.Cylinder004.geometry} scale={2.5} material={materials['Clay Orange']} rotation={[0, -0.857, 0]} />
      {/* <mesh position={cylinder003Pos} geometry={nodes.Cylinder003.geometry} scale={4} material={materials['White Clay Procedural']} />
      <mesh position={cylinder001Pos} geometry={nodes.Cylinder001.geometry} scale={4} material={materials.Porcelain} />
      <mesh position={cube008Pos} geometry={nodes.Cube008.geometry} scale={3.5} material={materials['Material.006']} />
      <mesh position={cube004Pos} geometry={nodes.Cube004.geometry} scale={4} material={materials['Material.003']} />
      <mesh position={cube004_1Pos} geometry={nodes.Cube004_1.geometry} scale={3.5} material={materials['Material.007']} />
      <mesh position={cube003Pos} geometry={nodes.Cube003.geometry} scale={4} material={materials['Material.004']} />
      <mesh position={cube003_1Pos} geometry={nodes.Cube003_1.geometry} scale={3.5} material={materials['Material.005']} /> */}
    </group>
  )
}

useGLTF.preload(GLB_PATH)
