import type { MaterialShaderSpec } from '../db/schema'

export { FACE_GROUPS } from '../db/schema'

export type {
  BlendMode,
  ConfiguratorLightingSettings,
  ConfiguratorSettingsRow,
  DimLimits,
  GhInputMode,
  MaterialShaderLayer,
  MaterialShaderSpec,
  NoiseType,
  OrderDimensionsSnapshot,
  ParamGraphEdge,
  ParamGraphNode,
  ParamGraphNodeType,
  ParamGraphSettings,
  ParamRange,
  FaceGroup,
  SceneLightSettings,
  SurfaceUvMapping,
  TemplateParametricPreset,
  TemplateParamLimits,
  UserRole,
} from '../db/schema'

export type PublicMat = {
  id: string
  name: string
  folder: string
  colorHex: string
  shader: MaterialShaderSpec | null
}
