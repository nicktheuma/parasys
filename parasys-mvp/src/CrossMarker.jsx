export function CrossMarker({ position }) {
  return (
    <group position={position}>
      {/* Horizontal bar */}
      <mesh scale={[0.01, 0.0005, 0.0005]}>
        <boxGeometry />
        <meshBasicMaterial color="red" />
      </mesh>
      {/* Vertical bar */}
      <mesh scale={[0.0005, 0.01, 0.0005]}>
        <boxGeometry />
        <meshBasicMaterial color="red" />
      </mesh>
      {/* Other Horizontal bar */}
      <mesh scale={[0.0005, 0.0005, 0.01]}>
        <boxGeometry />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  );
}
