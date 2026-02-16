import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export function GenerateSimpleNoiseTexture(width = 256, height = 256, x1 = 0.01, y1 = 0.01, x2 = 0.5, y2 = 0.5) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  
  // Simple Perlin-like noise using sine waves
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    
    const noise = Math.sin(x * x1) * Math.sin(y * y1) * x2 + y2
    
    data[i] = noise * 255     // R
    data[i + 1] = noise * 255 // G
    data[i + 2] = noise * 255 // B
    data[i + 3] = 255         // A
  }
    
  ctx.putImageData(imageData, 0, 0)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}

export function GeneratePerlinNoiseTexture(width = 512, height = 512, x1 = 0.01, y1 = 0.01, x2 = 0.5, y2 = 0.5) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  const noise2D = createNoise2D();    
  const value = noise2D(width, height);
  
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    
    const noise = (noise2D(x * x1, y * y1) + x2) / y2
    
    data[i] = noise * 255
    data[i + 1] = noise * 255
    data[i + 2] = noise * 255
    data[i + 3] = 255
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}