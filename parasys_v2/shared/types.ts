import type { MaterialShaderSpec } from '../db/schema'

export type {
  BlendMode,
  ConfiguratorSettingsRow,
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
