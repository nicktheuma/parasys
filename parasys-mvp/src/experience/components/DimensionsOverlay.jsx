import { BillboardStepButton, PlaneDimensionLine } from '../../DimensionManager'

export const DimensionsOverlay = ({
  visible,
  dividerControlAnchors,
  shelfControlAnchors,
  furnitureUiScale,
  uiScaleClampButtons,
  uiScaleClampDims,
  dividers,
  shelves,
  dividerMin,
  dividerMax,
  shelfMin,
  shelfMax,
  width,
  height,
  depth,
  setControls,
}) => (
  <group name="DimensionsGroup" visible={visible}>
    <BillboardStepButton
      position={dividerControlAnchors.decrement}
      symbol="−"
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampButtons.min}
      uiScaleMax={uiScaleClampButtons.max}
      disabled={dividers <= dividerMin}
      onClick={() => setControls({ dividers: Math.max(dividerMin, dividers - 1) })}
    />
    <BillboardStepButton
      position={dividerControlAnchors.increment}
      symbol="+"
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampButtons.min}
      uiScaleMax={uiScaleClampButtons.max}
      disabled={dividers >= dividerMax}
      onClick={() => setControls({ dividers: Math.min(dividerMax, dividers + 1) })}
    />
    <BillboardStepButton
      position={shelfControlAnchors.decrement}
      symbol="−"
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampButtons.min}
      uiScaleMax={uiScaleClampButtons.max}
      disabled={shelves <= shelfMin}
      onClick={() => setControls({ shelves: Math.max(shelfMin, shelves - 1) })}
    />
    <BillboardStepButton
      position={shelfControlAnchors.increment}
      symbol="+"
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampButtons.min}
      uiScaleMax={uiScaleClampButtons.max}
      disabled={shelves >= shelfMax}
      onClick={() => setControls({ shelves: Math.min(shelfMax, shelves + 1) })}
    />

    <PlaneDimensionLine
      start={[-width / 2, height / 2, -depth / 2]}
      end={[width / 2, height / 2, -depth / 2]}
      label={width}
      setDimension={(v) => setControls({ width: v })}
      dimensionGap={0.025}
      anchorGap={0.005}
      fontSize={0.01}
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampDims.min}
      uiScaleMax={uiScaleClampDims.max}
    />
    <PlaneDimensionLine
      start={[width / 2, -height / 2, -depth / 2]}
      end={[width / 2, height / 2, -depth / 2]}
      label={height}
      setDimension={(v) => setControls({ height: v })}
      dimensionGap={0.025}
      anchorGap={0.005}
      fontSize={0.01}
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampDims.min}
      uiScaleMax={uiScaleClampDims.max}
    />
    <PlaneDimensionLine
      start={[width / 2, -height / 2, depth / 2]}
      end={[width / 2, -height / 2, -depth / 2]}
      label={depth}
      setDimension={(v) => setControls({ depth: v })}
      dimensionGap={0.025}
      anchorGap={0.005}
      fontSize={0.01}
      uiScale={furnitureUiScale}
      uiScaleMin={uiScaleClampDims.min}
      uiScaleMax={uiScaleClampDims.max}
    />
  </group>
)
