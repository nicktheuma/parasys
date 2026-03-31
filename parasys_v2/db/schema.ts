import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Grasshopper-style input modes for Params / sliders */
export type GhInputMode = 'number' | 'integer' | 'angle' | 'boolean'

/** Legacy + Grasshopper-style component types (numeric graph; mesh ops are scalar placeholders) */
export type ParamGraphNodeType =
  | 'dimension'
  | 'constant'
  | 'binary'
  | 'output'
  | 'ghSlider'
  | 'ghPanel'
  | 'ghPoint'
  | 'ghVector'
  | 'ghMove'
  | 'ghLine'
  | 'ghCrv'
  | 'ghExtrude'
  | 'ghCap'
  | 'ghChamfer'
  | 'ghBevel'
  | 'ghFillet'

/** React Flow graph — evaluated in `paramGraphEval.ts` (scalar + multi-port) */
export type ParamGraphNode = {
  id: string
  type: ParamGraphNodeType
  position: { x: number; y: number }
  data: {
    label?: string
    dimension?: 'width' | 'depth' | 'height'
    value?: number
    op?: 'add' | 'mul' | 'min' | 'max'
    /** When set, the evaluated output value replaces this axis for the 3D mesh (mm, clamped). Sliders still feed dimension nodes. */
    applyTo?: 'width' | 'depth' | 'height' | null
    /** Params: Number Slider / Panel */
    inputMode?: GhInputMode
    /** Construct Point / Vector / panel defaults (mm or deg for angle mode) */
    x?: number
    y?: number
    z?: number
    /** Extrude: default height (mm) */
    height?: number
    /** Fillet / chamfer / bevel default radius (mm) */
    radius?: number
    /** Cap: treat as closed solid (0/1) */
    cap?: boolean
  }
}

export type ParamGraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type ParamGraphSettings = {
  nodes: ParamGraphNode[]
  edges: ParamGraphEdge[]
}

export type TemplateParametricPreset = {
  dividers?: number
  shelves?: number
  edgeOffset?: number
  slotOffsetFactor?: number
  interlockEnabled?: boolean
  interlockClearanceFactor?: number
  interlockLengthFactor?: number
  panelThickness?: number
}

export type ParamRange = { min?: number; max?: number }

export type TemplateParamLimits = {
  dividers?: ParamRange
  shelves?: ParamRange
  edgeOffset?: ParamRange
  slotOffsetFactor?: ParamRange
  interlockClearanceFactor?: ParamRange
  interlockLengthFactor?: ParamRange
  panelThickness?: ParamRange
}

export type FaceGroup = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

export const FACE_GROUPS: FaceGroup[] = ['front', 'back', 'right', 'left', 'top', 'bottom']

export type SurfaceUvMapping = {
  scaleX?: number
  scaleY?: number
  scaleZ?: number
  offsetX?: number
  offsetY?: number
  rotation?: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
}

export type DimLimits = {
  widthMm?: ParamRange
  depthMm?: ParamRange
  heightMm?: ParamRange
}

/** Stored as JSON; normalized in handlers via `normalizeSettings` */
/** One adjustable light; position is world-space for canvas directionals, unit multipliers × bbox radius for stage spot/point */
export type SceneLightSettings = {
  position: [number, number, number]
  intensity: number
  color: string
  /** Spot penumbra (0–1); ignored for directional / point / ambient */
  softness?: number
}

/** Optional overrides; merged with app defaults at runtime */
export type ConfiguratorLightingSettings = {
  ambientIntensity?: number
  directional0?: Partial<SceneLightSettings>
  directional1?: Partial<SceneLightSettings>
  directional2?: Partial<SceneLightSettings>
  keySpot?: Partial<SceneLightSettings>
  fillPoint?: Partial<SceneLightSettings>
  environmentBlur?: number
  /** IBL strength on `scene.environment` (Three.js; typical 0–2) */
  environmentIntensity?: number
}

export type ConfiguratorSettingsRow = {
  defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
  /** Optional static image URL for admin lists (same-origin path like `/configurator-thumbnails/x.svg` or https URL) */
  thumbnailSrc?: string | null
  /** Public configurator opens with this material selected when valid and in the material list */
  defaultMaterialId?: string | null
  dimLimits?: DimLimits | null
  paramGraph?: ParamGraphSettings | null
  templateParams?: Record<string, TemplateParametricPreset> | null
  paramLimits?: Record<string, TemplateParamLimits> | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
  lighting?: ConfiguratorLightingSettings | null
  /** Decorative objects (books, plants, etc.) — panel templates use shelf anchors */
  props?: ConfiguratorPropsSettings | null
}

export type PropHorizontalAlign = 'center' | 'left' | 'right'
export type PropDepthAlign = 'center' | 'front' | 'back'

/** One instance of a library prop placed on an anchor (e.g. shelf:2) */
export type ConfiguratorPropPlacement = {
  id: string
  propLibraryId: string
  anchorId: string
  /** Extra multiplier on auto-fit scale (clamped in app) */
  scaleBias?: number
  materialSpec?: MaterialShaderSpec | null
  /** Horizontal placement along shelf width (X); default center */
  alignX?: PropHorizontalAlign
  /** Depth placement along shelf (Z, +Z = front) */
  alignZ?: PropDepthAlign
}

export type ConfiguratorPropsSettings = {
  placements: ConfiguratorPropPlacement[]
  /** 0 = only manual placements; 1 = fill all shelf slots (9 per shelf: 3×3 alignments) */
  density?: number
  /** Prop library ids used for auto-fill (round-robin); if empty, all enabled props are considered */
  palettePropIds?: string[]
}

export type PropKind = 'placeholder_cube' | 'glb'

export type NoiseType = 'fbm' | 'voronoi' | 'simplex' | 'ridged' | 'turbulence' | 'marble'
export type BlendMode = 'normal' | 'multiply' | 'overlay'

/** Layered procedural surface (max 3 layers enforced in shader) */
export type MaterialShaderLayer = {
  id: string
  mix: number
  blendMode: BlendMode
  noiseType: NoiseType
  noiseScale: number
  noiseScaleY?: number
  noiseScaleZ?: number
  noiseStrength: number
  roughness: number
  metalness: number
  colorHex: string
  displacementStrength?: number
  normalStrength?: number
  /** World-space offset of noise domain (meters) */
  noiseOffsetX?: number
  noiseOffsetY?: number
  noiseOffsetZ?: number
  /** Euler rotation of noise sampling (radians, X then Y then Z) */
  noiseRotationX?: number
  noiseRotationY?: number
  noiseRotationZ?: number
}

export type MaterialShaderSpec = {
  version: 1
  baseColorHex: string
  globalRoughness: number
  globalMetalness: number
  ambientOcclusion: number
  layers: MaterialShaderLayer[]
}

/** Snapshot at checkout time; merged with configurator defaults when building the ZIP */
export type OrderDimensionsSnapshot = {
  widthMm?: number
  depthMm?: number
  heightMm?: number
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>().notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: jsonb('details').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const configurators = pgTable('configurators', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  templateKey: text('template_key').notNull(),
  clientLabel: text('client_label'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  settings: jsonb('settings').$type<ConfiguratorSettingsRow | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  configuratorId: uuid('configurator_id')
    .references(() => configurators.id, { onDelete: 'cascade' })
    .notNull(),
  stripeSessionId: text('stripe_session_id').unique(),
  status: text('status').notNull(),
  customerEmail: text('customer_email'),
  amountCents: integer('amount_cents'),
  currency: text('currency').default('usd').notNull(),
  dimensionsSnapshot: jsonb('dimensions_snapshot').$type<OrderDimensionsSnapshot | null>(),
  /** Opaque token for email download links (64 hex chars) */
  downloadToken: text('download_token').unique(),
  purchaseEmailSentAt: timestamp('purchase_email_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const materials = pgTable('materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  configuratorId: uuid('configurator_id')
    .references(() => configurators.id, { onDelete: 'cascade' })
    .notNull(),
  folder: text('folder').notNull().default(''),
  name: text('name').notNull(),
  colorHex: text('color_hex').notNull().default('#888888'),
  shader: jsonb('shader').$type<MaterialShaderSpec | null>(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const materialAssignments = pgTable('material_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  materialId: uuid('material_id')
    .references(() => materials.id, { onDelete: 'cascade' })
    .notNull(),
  configuratorId: uuid('configurator_id')
    .references(() => configurators.id, { onDelete: 'cascade' })
    .notNull(),
})

/** Global catalog of decorative props (GLB or placeholder geometry) */
export const propLibrary = pgTable('prop_library', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  kind: text('kind').$type<PropKind>().notNull().default('placeholder_cube'),
  glbUrl: text('glb_url'),
  /** Placeholder box dimensions in mm (local X, Y, Z before fit scaling) */
  placeholderDimsMm: jsonb('placeholder_dims_mm').$type<[number, number, number]>().notNull(),
  defaultShader: jsonb('default_shader').$type<MaterialShaderSpec | null>(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
