import * as THREE from 'three'
import { OrbitControls, ContactShadows } from '@react-three/drei'

export const SceneGroup = ({ orbitRef, lightRef, lightPos, lightTarget, intensity, mapSize, near, far, contactShadowPos }) => (
  <group name="SceneGroup">
    <OrbitControls ref={orbitRef} makeDefault minDistance={0.01} />

    <spotLight
      castShadow={true}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-near={near}
      shadow-camera-far={far}
      shadow-radius={60}
      shadow-bias={-0.0005}
      shadow-normalBias={0.0005}
      ref={lightRef}
      position={lightPos}
      target-position={lightTarget}
      intensity={intensity * 100}
      angle={Math.PI / 8}
      penumbra={1}
      decay={2}
      distance={2}
      color={'#fee7c2'}
    />

    <ContactShadows
      position={new THREE.Vector3(contactShadowPos[0], contactShadowPos[1], contactShadowPos[2])}
      opacity={0.2}
      scale={1}
      blur={3}
      far={10}
    />
  </group>
)
