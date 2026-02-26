import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

const GLB_PATH = import.meta.env.BASE_URL + 'Props_1-transformed.glb'

const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2))
}

function AnimatedPropMesh({ geometry, material, position, baseScale, baseRotation = [0, 0, 0], delay = 0, castShadow = true, receiveShadow = false }) {
  const meshRef = useRef()
  const mountedAtRef = useRef(null)
  const startY = useMemo(() => position[1] + 0.09, [position])

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    if (mountedAtRef.current === null) {
      mountedAtRef.current = clock.elapsedTime
    }

    const localElapsed = clock.elapsedTime - mountedAtRef.current
    const timeSinceDelay = Math.max(0, localElapsed - delay)
    const duration = 0.58
    const progress = THREE.MathUtils.clamp(timeSinceDelay / duration, 0, 1)
    const bounceScale = THREE.MathUtils.clamp(easeOutBack(progress), 0, 1.12)
    const settle = 1 - ((1 - progress) ** 2)
    const wobble = ((1 - progress) ** 1.5) * Math.sin(timeSinceDelay * 18)

    meshRef.current.scale.setScalar(Math.max(0.0001, baseScale * bounceScale))
    meshRef.current.position.set(
      position[0],
      THREE.MathUtils.lerp(startY, position[1], settle),
      position[2],
    )
    meshRef.current.rotation.set(
      baseRotation[0] + (wobble * 0.04),
      baseRotation[1] + (wobble * 0.08),
      baseRotation[2] + (wobble * 0.03),
    )
  })

  return (
    <mesh
      ref={meshRef}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      geometry={geometry}
      material={material}
      position={[position[0], startY, position[2]]}
      rotation={baseRotation}
      scale={0.0001}
    />
  )
}

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

  const propItems = useMemo(() => ([
    {
      key: 'vase_7001',
      geometry: nodes.vase_7001.geometry,
      material: materials['ceremic.001'],
      position: vasePos,
      baseScale: 2,
      baseRotation: [0, 0, 0],
      receiveShadow: true,
    },
    {
      key: 'Cylinder004',
      geometry: nodes.Cylinder004.geometry,
      material: materials['Clay Orange'],
      position: cylinder004Pos,
      baseScale: 2.5,
      baseRotation: [0, -0.857, 0],
    },
  ]), [nodes, materials, vasePos, cylinder004Pos])

  return (
    <group dispose={null}>
      {propItems.map((item, index) => (
        <AnimatedPropMesh
          key={item.key}
          geometry={item.geometry}
          material={item.material}
          position={item.position}
          baseScale={item.baseScale}
          baseRotation={item.baseRotation}
          delay={index * 0.14}
          castShadow={true}
          receiveShadow={item.receiveShadow || false}
        />
      ))}
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
