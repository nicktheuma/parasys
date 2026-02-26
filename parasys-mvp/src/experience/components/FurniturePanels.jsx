export const FurniturePanels = ({ groupRef, panelMeshes, panelMeshRefs, panelMeshTargetsRef, toVector3, panelIdSeed, activeMaterial }) => (
  <group name="FurnitureGroup" ref={groupRef}>
    {panelMeshes.map(({ panelSpec, geometry, vectorLoops }) => (
      <mesh
        key={panelSpec.id}
        ref={(node) => {
          if (node) {
            panelMeshRefs.current.set(panelSpec.id, node)
            panelMeshTargetsRef.current.set(panelSpec.id, {
              targetPosition: toVector3(panelSpec.center),
              seed: panelIdSeed(panelSpec.id),
              kind: panelSpec.kind,
            })
          } else {
            panelMeshRefs.current.delete(panelSpec.id)
            panelMeshTargetsRef.current.delete(panelSpec.id)
          }
        }}
        name={`Panel_${panelSpec.id}`}
        castShadow={true}
        receiveShadow={true}
        position={panelSpec.center}
        rotation={panelSpec.rotation}
        geometry={geometry}
        material={activeMaterial}
        userData={{
          panelId: panelSpec.id,
          panelKind: panelSpec.kind,
          panelPlane: panelSpec.plane,
          panelWidth: panelSpec.width,
          panelHeight: panelSpec.height,
          panelThickness: panelSpec.thickness,
          vectorLoops,
        }}
      />
    ))}
  </group>
)
