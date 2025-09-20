import { useState, useEffect, useCallback } from 'react';
import { Color } from '../../utils/three-exports';

// Predefined color palettes for different time intervals
const COLOR_PALETTES = [
  // Palette 1: Warm sunset tones
  {
    primary: '#FF6B6B',    // Warm red
    emissive: '#FF3333',
    sky: '#FFA07A',        // Light salmon
    planet: '#FFD700',     // Gold
    ring: '#FF6347'        // Tomato
  },
  // Palette 2: Cool ocean tones
  {
    primary: '#4ECDC4',    // Teal
    emissive: '#26A69A',
    sky: '#87CEEB',        // Sky blue
    planet: '#00CED1',     // Dark turquoise
    ring: '#40E0D0'        // Turquoise
  },
  // Palette 3: Mystic purple tones
  {
    primary: '#9B59B6',    // Purple
    emissive: '#8E44AD',
    sky: '#DDA0DD',        // Plum
    planet: '#9370DB',     // Medium purple
    ring: '#BA55D3'        // Medium orchid
  },
  // Palette 4: Electric blue tones
  {
    primary: '#3498DB',    // Blue
    emissive: '#2980B9',
    sky: '#87CEEB',        // Sky blue
    planet: '#00BFFF',     // Deep sky blue
    ring: '#1E90FF'        // Dodger blue
  },
  // Palette 5: Forest green tones
  {
    primary: '#27AE60',    // Green
    emissive: '#229954',
    sky: '#98FB98',        // Pale green
    planet: '#32CD32',     // Lime green
    ring: '#00FF7F'        // Spring green
  },
  // Palette 6: Golden sunset tones
  {
    primary: '#F39C12',    // Orange
    emissive: '#E67E22',
    sky: '#FFD700',        // Gold
    planet: '#FFA500',     // Orange
    ring: '#FF8C00'        // Dark orange
  }
];

/**
 * Hook that provides cycling colors based on time
 * Updates every minute to change color palettes smoothly
 */
export const useColorCycle = () => {
  const [currentPaletteIndex, setCurrentPaletteIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Get current palette
  const currentPalette = COLOR_PALETTES[currentPaletteIndex];

  // Get next palette for smooth transitions
  const nextPaletteIndex = (currentPaletteIndex + 1) % COLOR_PALETTES.length;
  const nextPalette = COLOR_PALETTES[nextPaletteIndex];

  // Update palette every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);

      // Brief transition period
      setTimeout(() => {
        setCurrentPaletteIndex(prev => (prev + 1) % COLOR_PALETTES.length);
        setIsTransitioning(false);
      }, 500); // 0.5 second transition

    }, 60000); // Change every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Get interpolated color between current and next palette
  const getInterpolatedColor = useCallback((currentHex: string, nextHex: string, t: number) => {
    const currentColor = new Color(currentHex);
    const nextColor = new Color(nextHex);

    return currentColor.clone().lerp(nextColor, t);
  }, []);

  // Return color functions that components can use
  const getPrimaryColors = useCallback(() => {
    if (isTransitioning) {
      // During transition, blend colors
      const interpolatedColor = getInterpolatedColor(currentPalette.primary, nextPalette.primary, 0.5);
      const interpolatedEmissive = getInterpolatedColor(currentPalette.emissive, nextPalette.emissive, 0.5);

      return {
        color: `#${interpolatedColor.getHexString()}`,
        emissive: `#${interpolatedEmissive.getHexString()}`
      };
    }
    return {
      color: currentPalette.primary,
      emissive: currentPalette.emissive
    };
  }, [currentPalette, nextPalette, isTransitioning, getInterpolatedColor]);

  const getSkyColors = useCallback(() => {
    if (isTransitioning) {
      const interpolatedTop = getInterpolatedColor(currentPalette.sky, nextPalette.sky, 0.5);
      const interpolatedMiddle = getInterpolatedColor(currentPalette.primary, nextPalette.primary, 0.5);
      const bottomColor = new Color('#87CEEB');

      return {
        topColor: `#${interpolatedTop.getHexString()}`,
        middleColor: `#${interpolatedMiddle.getHexString()}`,
        bottomColor: `#${bottomColor.getHexString()}`
      };
    }
    return {
      topColor: currentPalette.sky,
      middleColor: currentPalette.primary,
      bottomColor: '#87CEEB'
    };
  }, [currentPalette, nextPalette, isTransitioning, getInterpolatedColor]);

  const getPlanetColors = useCallback(() => {
    if (isTransitioning) {
      const interpolatedPlanet = getInterpolatedColor(currentPalette.planet, nextPalette.planet, 0.5);
      const interpolatedRing = getInterpolatedColor(currentPalette.ring, nextPalette.ring, 0.5);
      const interpolatedGlow = getInterpolatedColor(currentPalette.primary, nextPalette.primary, 0.5);

      return {
        planet: `#${interpolatedPlanet.getHexString()}`,
        ring: `#${interpolatedRing.getHexString()}`,
        glow: `#${interpolatedGlow.getHexString()}`
      };
    }
    return {
      planet: currentPalette.planet,
      ring: currentPalette.ring,
      glow: currentPalette.primary
    };
  }, [currentPalette, nextPalette, isTransitioning, getInterpolatedColor]);

  return {
    getPrimaryColors,
    getSkyColors,
    getPlanetColors,
    isTransitioning,
    currentPaletteIndex
  };
};
