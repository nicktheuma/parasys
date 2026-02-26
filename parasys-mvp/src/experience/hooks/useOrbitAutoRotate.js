import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const useOrbitAutoRotate = ({ orbitRef, idleDelaySeconds, idleRotateSpeed, idleRampSeconds }) => {
  const lastInteractionAtRef = useRef(Date.now())
  const isUserInteractingRef = useRef(false)
  const currentAutoRotateSpeedRef = useRef(0)

  useEffect(() => {
    if (!orbitRef.current) return

    const orbit = orbitRef.current

    const handleStart = () => {
      isUserInteractingRef.current = true
      lastInteractionAtRef.current = Date.now()
    }

    const handleEnd = () => {
      isUserInteractingRef.current = false
      lastInteractionAtRef.current = Date.now()
    }

    const handleChange = () => {
      if (isUserInteractingRef.current) {
        lastInteractionAtRef.current = Date.now()
      }
    }

    orbit.addEventListener('start', handleStart)
    orbit.addEventListener('end', handleEnd)
    orbit.addEventListener('change', handleChange)

    return () => {
      orbit.removeEventListener('start', handleStart)
      orbit.removeEventListener('end', handleEnd)
      orbit.removeEventListener('change', handleChange)
    }
  }, [orbitRef])

  const animateOrbit = (delta) => {
    if (!orbitRef.current) return

    const idleForMs = Date.now() - lastInteractionAtRef.current
    const shouldAutoRotate = !isUserInteractingRef.current && idleForMs >= idleDelaySeconds * 1000
    const targetSpeed = shouldAutoRotate ? idleRotateSpeed : 0
    const rampSeconds = Math.max(0.2, idleRampSeconds)
    const smoothingLambda = 4.6 / rampSeconds
    const easingFactor = 1 - Math.exp(-delta * smoothingLambda)

    currentAutoRotateSpeedRef.current = THREE.MathUtils.lerp(
      currentAutoRotateSpeedRef.current,
      targetSpeed,
      easingFactor,
    )

    const hasIdleSpin = currentAutoRotateSpeedRef.current > 0.005
    orbitRef.current.autoRotate = hasIdleSpin
    orbitRef.current.autoRotateSpeed = currentAutoRotateSpeedRef.current
  }

  return { animateOrbit }
}
