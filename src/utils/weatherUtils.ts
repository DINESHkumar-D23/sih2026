// NMDC Bailadila Sector 14-A Mining Environmental & Meteorological Calculations

export function degToCompass(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

export function decodeWeatherCode(code: number): { text: string; category: 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' } {
  switch (code) {
    case 0:
      return { text: 'Clear Sky / High Solar Radiation', category: 'clear' };
    case 1:
      return { text: 'Mainly Clear / Low Cloud', category: 'clear' };
    case 2:
      return { text: 'Partly Cloudy / Scatted Cumulus', category: 'cloudy' };
    case 3:
      return { text: 'Overcast / High Density Stratum', category: 'cloudy' };
    case 45:
    case 48:
      return { text: 'Dense Ridge Fog & Low Inversion', category: 'fog' };
    case 51:
    case 53:
    case 55:
      return { text: 'Monsoon Mist & Light Drizzle', category: 'rain' };
    case 61:
      return { text: 'Slight Monsoon Rain', category: 'rain' };
    case 63:
      return { text: 'Moderate Monsoon Downpour', category: 'rain' };
    case 65:
      return { text: 'Heavy Torrential Monsoon Rain', category: 'rain' };
    case 80:
    case 81:
    case 82:
      return { text: 'Violent Incline Cloudburst Showers', category: 'rain' };
    case 95:
      return { text: 'Severe Thunderstorm & Lightning Activity', category: 'storm' };
    case 96:
    case 99:
      return { text: 'Severe Electrical Storm with Hail', category: 'storm' };
    default:
      return { text: 'Monsoon Overcast & High Humidity', category: 'cloudy' };
  }
}

export function calculateFrictionCoeff(isWet: boolean, rainMmHr: number): number {
  if (!isWet) return 0.45; // Dry compacted hematite/banded iron formation
  if (rainMmHr > 12) return 0.19; // Heavy slurry layer on 11% grade
  if (rainMmHr > 4) return 0.22; // Wet red mud / laterite wash
  return 0.26; // Damp surface
}

export function calculateSumpInflow(rainMmHr: number): number {
  // Sector 14-A Pit catchment area: ~180 hectares
  const baseSeepageM3Hr = 110;
  return Math.round(baseSeepageM3Hr + rainMmHr * 62);
}

export function calculateLightningRisk(
  weatherCode: number,
  rainMmHr: number,
  cloudCover: number
): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (weatherCode >= 95) return 'CRITICAL';
  if (weatherCode >= 80 && rainMmHr > 6) return 'HIGH';
  if (rainMmHr > 2 && cloudCover > 85) return 'MODERATE';
  return 'LOW';
}

export function calculateDgmsAdvisory(
  isWet: boolean,
  visibilityMeters: number,
  windGustsKmh: number,
  lightningRisk: string
): string {
  if (lightningRisk === 'CRITICAL') {
    return 'DGMS CODE RED: IMMEDIATE BLAST SHELTER PROTOCOL. GROUND ALL SHOVEL BOOMS & SUSPEND FUEL TRANSFER.';
  }
  if (visibilityMeters < 50) {
    return 'DGMS CIRCULAR 07: MANDATORY FOG BEACONS & HAZARD HAZERS. SPEED CLAMP 10 KM/H ON ALL INCLINE RAMPS.';
  }
  if (isWet) {
    return 'DGMS CIRCULAR 04: MANDATORY HYDRAULIC RETARDER ACTIVE. MINIMUM 50M FOLLOWING DISTANCE ON 11% GRADE.';
  }
  if (windGustsKmh > 40) {
    return 'HIGH WIND ADVISORY: CREST GUSTS EXCEED 40 KM/H. VERIFY HIGH-MAST LIGHT TOWER ANCHORS.';
  }
  return 'DGMS SAFETY PROTOCOL NORMAL: ALL HAUL ROADS PASSING GRADE INSPECTION.';
}
