/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  /** Set via vite.config from ALLOW_FREE_DESIGN_PACKAGE in .env */
  readonly VITE_ALLOW_FREE_DESIGN_PACKAGE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
