import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

import { GeneratePerlinNoiseTexture } from '../../NoiseGenerator'

const createUvDebugTexture = () => {
  if (typeof document === 'undefined') return null

  const canvasSize = 1024
  const tileSize = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize

  const context = canvas.getContext('2d')
  if (!context) return null

  for (let y = 0; y < canvasSize; y += tileSize) {
    for (let x = 0; x < canvasSize; x += tileSize) {
      const isDark = ((x / tileSize) + (y / tileSize)) % 2 === 0
      context.fillStyle = isDark ? '#111827' : '#f3f4f6'
      context.fillRect(x, y, tileSize, tileSize)
    }
  }

  context.strokeStyle = '#2563eb'
  context.lineWidth = 8
  context.beginPath()
  context.moveTo(0, 6)
  context.lineTo(canvasSize, 6)
  context.stroke()

  context.strokeStyle = '#0f766e'
  context.lineWidth = 8
  context.beginPath()
  context.moveTo(6, 0)
  context.lineTo(6, canvasSize)
  context.stroke()

  context.fillStyle = '#dc2626'
  context.beginPath()
  context.arc(20, 20, 10, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#111827'
  context.font = 'bold 28px sans-serif'
  context.fillText('U', canvasSize - 40, 40)
  context.fillText('V', 16, canvasSize - 16)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true

  return texture
}

export const useConfiguredActiveMaterial = ({ materials, controls, selectedMaterialKey, enhancedAssetsReady, gl }) => {
  const {
    mat_Placeholder,
    mat_Brushed,
    mat_Chrome,
    mat_PaintedMetal,
    mat_MATCAP,
    mat_Wireframe,
    mat_UVDebug,
  } = materials

  const uvDebugTexture = useMemo(() => createUvDebugTexture(), [])

  const createNoiseTexture = (noiseParams) => {
    if (!enhancedAssetsReady) return null

    const noiseResolution = 1024
    const noiseCanvas = GeneratePerlinNoiseTexture(
      noiseResolution,
      noiseResolution,
      noiseParams.x1,
      noiseParams.y1,
      noiseParams.x2,
      noiseParams.y2,
    )

    const texture = new THREE.CanvasTexture(noiseCanvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(noiseParams.scale, noiseParams.scale)
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    texture.needsUpdate = true
    return texture
  }

  const pbrNoiseTexture = useMemo(() => {
    return createNoiseTexture({
      x1: controls.pbr_noiseX1,
      y1: controls.pbr_noiseY1,
      x2: controls.pbr_noiseX2,
      y2: controls.pbr_noiseY2,
      scale: controls.pbr_noiseScale,
    })
  }, [enhancedAssetsReady, gl, controls.pbr_noiseX1, controls.pbr_noiseY1, controls.pbr_noiseX2, controls.pbr_noiseY2, controls.pbr_noiseScale])

  const chromeNoiseTexture = useMemo(() => {
    return createNoiseTexture({
      x1: controls.chrome_noiseX1,
      y1: controls.chrome_noiseY1,
      x2: controls.chrome_noiseX2,
      y2: controls.chrome_noiseY2,
      scale: controls.chrome_noiseScale,
    })
  }, [enhancedAssetsReady, gl, controls.chrome_noiseX1, controls.chrome_noiseY1, controls.chrome_noiseX2, controls.chrome_noiseY2, controls.chrome_noiseScale])

  const paintedNoiseTexture = useMemo(() => {
    return createNoiseTexture({
      x1: controls.painted_noiseX1,
      y1: controls.painted_noiseY1,
      x2: controls.painted_noiseX2,
      y2: controls.painted_noiseY2,
      scale: controls.painted_noiseScale,
    })
  }, [enhancedAssetsReady, gl, controls.painted_noiseX1, controls.painted_noiseY1, controls.painted_noiseX2, controls.painted_noiseY2, controls.painted_noiseScale])

  useEffect(() => {
    if (pbrNoiseTexture) {
      mat_Brushed.roughnessMap = pbrNoiseTexture
      mat_Brushed.bumpMap = pbrNoiseTexture
    }
    mat_Brushed.roughness = controls.pbr_roughness
    mat_Brushed.metalness = controls.pbr_metalness
    mat_Brushed.bumpScale = controls.pbr_bumpScale
    mat_Brushed.needsUpdate = true

    return () => {
      if (pbrNoiseTexture) pbrNoiseTexture.dispose()
    }
  }, [mat_Brushed, pbrNoiseTexture, controls.pbr_roughness, controls.pbr_metalness, controls.pbr_bumpScale])

  useEffect(() => {
    if (chromeNoiseTexture) {
      mat_Chrome.roughnessMap = chromeNoiseTexture
      mat_Chrome.bumpMap = chromeNoiseTexture
    }
    mat_Chrome.roughness = controls.chrome_roughness
    mat_Chrome.metalness = controls.chrome_metalness
    mat_Chrome.bumpScale = controls.chrome_bumpScale
    mat_Chrome.needsUpdate = true

    return () => {
      if (chromeNoiseTexture) chromeNoiseTexture.dispose()
    }
  }, [mat_Chrome, chromeNoiseTexture, controls.chrome_roughness, controls.chrome_metalness, controls.chrome_bumpScale])

  useEffect(() => {
    if (paintedNoiseTexture) {
      mat_PaintedMetal.roughnessMap = paintedNoiseTexture
      mat_PaintedMetal.bumpMap = paintedNoiseTexture
    }
    mat_PaintedMetal.roughness = controls.painted_roughness
    mat_PaintedMetal.metalness = controls.painted_metalness
    mat_PaintedMetal.bumpScale = controls.painted_bumpScale
    mat_PaintedMetal.color = new THREE.Color(controls.paintedMetal_Colour)
    mat_PaintedMetal.needsUpdate = true

    return () => {
      if (paintedNoiseTexture) paintedNoiseTexture.dispose()
    }
  }, [mat_PaintedMetal, paintedNoiseTexture, controls.painted_roughness, controls.painted_metalness, controls.painted_bumpScale, controls.paintedMetal_Colour])

  useEffect(() => {
    if (!mat_UVDebug) return
    mat_UVDebug.map = uvDebugTexture
    mat_UVDebug.needsUpdate = true
  }, [uvDebugTexture, mat_UVDebug])

  useEffect(() => {
    return () => {
      if (uvDebugTexture) uvDebugTexture.dispose()
    }
  }, [uvDebugTexture])

  const publicMaterialMap = useMemo(() => ({
    Brushed: mat_Brushed,
    PBR: mat_Brushed,
    Chrome: mat_Chrome,
    Painted: mat_PaintedMetal,
    MATCAP: mat_MATCAP,
    Wireframe: mat_Wireframe,
    UVDebug: mat_UVDebug,
  }), [mat_Brushed, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  const selectedSceneMaterial = selectedMaterialKey
    ? publicMaterialMap[selectedMaterialKey] || controls.material
    : controls.material

  const activeMaterial = selectedSceneMaterial || mat_Placeholder

  useEffect(() => {
    ;[mat_Brushed, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug].forEach((candidateMaterial) => {
      candidateMaterial.transparent = true
      candidateMaterial.depthWrite = false
      candidateMaterial.opacity = 0
      candidateMaterial.needsUpdate = true
    })
  }, [mat_Brushed, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  return { activeMaterial }
}
