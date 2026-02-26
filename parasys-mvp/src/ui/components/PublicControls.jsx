import { useMemo, useState } from 'react'

import { downloadScene, downloadNestedPdf, downloadNestedDxf } from '../../SceneDownloader'
import { useSceneStore } from '../../useSceneStore'
import { MATERIAL_OPTIONS } from '../constants/materialOptions'

export const PublicControls = ({ selectedMaterial, onMaterialChange, showDimensions, onToggleDimensions, showDevTools }) => {
  const scene = useSceneStore((state) => state.scene)
  const [openPanel, setOpenPanel] = useState(null)
  const visibleMaterialOptions = useMemo(
    () => MATERIAL_OPTIONS.filter((option) => showDevTools || !option.devtoolsOnly),
    [showDevTools],
  )
  const selectedMaterialOption = visibleMaterialOptions.find((option) => option.key === selectedMaterial) || visibleMaterialOptions[0]

  const handleMaterialSelect = (materialKey) => {
    onMaterialChange(materialKey)
    setOpenPanel(null)
  }

  const togglePanel = (panelKey) => {
    setOpenPanel((current) => (current === panelKey ? null : panelKey))
  }

  return (
    <div className="public-controls" role="region" aria-label="Viewer controls">
      {openPanel === 'material' ? (
        <div className="nested-panel material-carousel" role="listbox" aria-label="Material options">
          {visibleMaterialOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleMaterialSelect(option.key)}
              className={`material-chip ${selectedMaterial === option.key ? 'is-active' : ''}`}
              aria-selected={selectedMaterial === option.key}
            >
              <span className={`material-thumb ${option.thumbnailClass}`} aria-hidden="true" />
              <span className="material-label">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {openPanel === 'download' ? (
        <div className="nested-panel option-grid" role="group" aria-label="Download options">
          <button
            type="button"
            onClick={() => { downloadNestedPdf(scene, selectedMaterial, { pdfPageFormat: 'A4' }); setOpenPanel(null) }}
            className="public-button public-button--compact"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => { downloadNestedDxf(scene, selectedMaterial); setOpenPanel(null) }}
            className="public-button public-button--compact"
          >
            DXF
          </button>
          <button
            type="button"
            onClick={() => { downloadScene(scene); setOpenPanel(null) }}
            className="public-button public-button--compact"
          >
            3D
          </button>
        </div>
      ) : null}

      <div className="primary-actions" role="group" aria-label="Primary controls">
        <button
          type="button"
          className="action-bubble action-bubble--icon"
          aria-expanded={openPanel === 'download'}
          aria-label="Download options"
          onClick={() => togglePanel('download')}
        >
          <span className="material-symbols-outlined action-icon" aria-hidden="true">download</span>
        </button>

        <button
          type="button"
          className="action-bubble"
          aria-expanded={openPanel === 'material'}
          aria-label={`Material picker, current: ${selectedMaterialOption?.label || selectedMaterial}`}
          onClick={() => togglePanel('material')}
        >
          <span className={`material-thumb ${selectedMaterialOption?.thumbnailClass || 'material-thumb--painted'}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="action-bubble action-bubble--icon"
          aria-pressed={showDimensions}
          aria-label={showDimensions ? 'Hide dimensions' : 'Show dimensions'}
          onClick={() => {
            onToggleDimensions()
            setOpenPanel(null)
          }}
        >
          <span className="material-symbols-outlined action-icon" aria-hidden="true">
            {showDimensions ? 'visibility' : 'visibility_off'}
          </span>
        </button>
      </div>
    </div>
  )
}
