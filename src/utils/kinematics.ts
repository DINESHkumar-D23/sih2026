// Kinematics, Catmull-Rom Spline Track & Dynamic Stopping Distance for NMDC Sector 14-A

export interface Point {
  x: number;
  y: number;
  elevationRL: number; // Reduced Level in meters (Bailadila mine datum)
}

// Key Waypoints representing the 11% grade haulage incline from Pit Floor to Crusher Hopper:
// 1. Pit Floor (Bench 09, RL 1,040m)
// 2. Bench 07 Haul Ramp (RL 1,120m)
// 3. Hairpin 3 Switchback (RL 1,180m, critical blind curve)
// 4. Bench 04 Incline (RL 1,220m)
// 5. Surface Rim Crusher Hopper (RL 1,280m)
export const INCLINE_KNOTS: Point[] = [
  { x: 120, y: 520, elevationRL: 1040 }, // Pit Floor Bench 09 Shovel 01
  { x: 220, y: 460, elevationRL: 1100 }, // Bench 08 Ramp
  { x: 340, y: 390, elevationRL: 1140 }, // Hairpin 3 Approach
  { x: 440, y: 280, elevationRL: 1180 }, // Hairpin 3 Apex Switchback
  { x: 380, y: 200, elevationRL: 1210 }, // Bench 05 Ramp Incline
  { x: 480, y: 120, elevationRL: 1250 }, // Surface Rim Approach
  { x: 580, y: 50, elevationRL: 1280 },  // Primary Crusher 1 Hopper Deck
];

// Passing bay locations (t parameter in [0, 1])
export const PASSING_BAY_ALPHA = { x: 450, y: 285, name: 'BAY 07-B (HAIRPIN 3)', t: 0.5 };
export const PASSING_BAY_BETA = { x: 240, y: 470, name: 'BAY 04-A (BENCH 07)', t: 0.22 };

// Defined Haul Incline Checkpoints for vehicle crossing and passage tracing
export const HAUL_CHECKPOINTS = [
  {
    id: 'CP-01',
    code: 'CP-1',
    name: 'Pit Floor Sump Gate',
    shortName: 'Pit Sump',
    progress: 0.08,
    elevationRL: 1050,
    speedLimitKmh: 20,
    description: 'Exit from Shovel 01 loading floor to main ramp',
  },
  {
    id: 'CP-02',
    code: 'CP-2',
    name: 'Bench 08 Ramp Exit',
    shortName: 'Bench 08',
    progress: 0.25,
    elevationRL: 1110,
    speedLimitKmh: 18,
    description: 'Transition from Bench 08 to mid-elevation ramp',
  },
  {
    id: 'CP-03',
    code: 'CP-3',
    name: 'Passing Bay Beta (04-A)',
    shortName: 'Bay Beta',
    progress: 0.42,
    elevationRL: 1150,
    speedLimitKmh: 15,
    description: 'Mid-incline passing bay entry gate',
  },
  {
    id: 'CP-04',
    code: 'CP-4',
    name: 'Hairpin 3 Blind Apex',
    shortName: 'Hairpin 3',
    progress: 0.58,
    elevationRL: 1180,
    speedLimitKmh: 12,
    description: 'Critical 11% gradient switchback blind apex',
  },
  {
    id: 'CP-05',
    code: 'CP-5',
    name: 'Passing Bay Alpha (07-B)',
    shortName: 'Bay Alpha',
    progress: 0.75,
    elevationRL: 1225,
    speedLimitKmh: 15,
    description: 'Upper incline collision interlock refuge bay',
  },
  {
    id: 'CP-06',
    code: 'CP-6',
    name: 'Crusher 1 Hopper Gate',
    shortName: 'Crusher Rim',
    progress: 0.92,
    elevationRL: 1270,
    speedLimitKmh: 10,
    description: 'Primary Crusher Hopper entry gate',
  },
];

// Calculate sampled arc length table for smooth constant-velocity Catmull-Rom spline interpolation
export function computeSplineSamples(knots: Point[], samplesPerSeg = 30) {
  const points: { x: number; y: number; elevationRL: number; s: number }[] = [];
  let totalLength = 0;

  for (let i = 0; i < knots.length - 1; i++) {
    const p0 = knots[Math.max(0, i - 1)];
    const p1 = knots[i];
    const p2 = knots[i + 1];
    const p3 = knots[Math.min(knots.length - 1, i + 2)];

    for (let j = 0; j < samplesPerSeg; j++) {
      const u = j / samplesPerSeg;
      const u2 = u * u;
      const u3 = u2 * u;

      const f1 = -0.5 * u3 + u2 - 0.5 * u;
      const f2 = 1.5 * u3 - 2.5 * u2 + 1.0;
      const f3 = -1.5 * u3 + 2.0 * u2 + 0.5 * u;
      const f4 = 0.5 * u3 - 0.5 * u2;

      const x = p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4;
      const y = p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4;
      const elevationRL = p1.elevationRL + (p2.elevationRL - p1.elevationRL) * u;

      if (points.length > 0) {
        const last = points[points.length - 1];
        const dist = Math.hypot(x - last.x, y - last.y);
        totalLength += dist;
      }

      points.push({ x, y, elevationRL, s: totalLength });
    }
  }

  const lastKnot = knots[knots.length - 1];
  const lastP = points[points.length - 1];
  totalLength += Math.hypot(lastKnot.x - lastP.x, lastKnot.y - lastP.y);
  points.push({ x: lastKnot.x, y: lastKnot.y, elevationRL: lastKnot.elevationRL, s: totalLength });

  return { points, totalLength };
}

export const INCLINE_TRACK = computeSplineSamples(INCLINE_KNOTS);

export function getPositionAtProgress(t: number) {
  const clampedT = Math.max(0, Math.min(1, t));
  const targetS = clampedT * INCLINE_TRACK.totalLength;
  const pts = INCLINE_TRACK.points;

  let low = 0;
  let high = pts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (pts[mid].s < targetS) low = mid + 1;
    else high = mid - 1;
  }

  const idx = Math.min(pts.length - 1, Math.max(1, low));
  const pA = pts[idx - 1];
  const pB = pts[idx];
  const segSpan = pB.s - pA.s || 0.0001;
  const ratio = (targetS - pA.s) / segSpan;

  const x = pA.x + (pB.x - pA.x) * ratio;
  const y = pA.y + (pB.y - pA.y) * ratio;
  const elevationRL = pA.elevationRL + (pB.elevationRL - pA.elevationRL) * ratio;

  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  let headingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (headingDeg < 0) headingDeg += 360;

  return { x, y, elevationRL, headingDeg };
}

export function samplePointAtDistance(distM: number) {
  const t = INCLINE_TRACK.totalLength > 0 ? distM / INCLINE_TRACK.totalLength : 0;
  return getPositionAtProgress(t);
}


/**
 * Dynamic Stopping Distance Formula:
 * v_ms = v_kmh / 3.6
 * d_stop = (v_ms^2) / (2 * g * (mu +/- theta)) + d_reaction
 * For climbing uphill (+ theta), for descending downhill (- theta)
 */
export function calculateStoppingDistance(
  speedKmh: number,
  direction: 1 | -1,
  frictionMu: number,
  gradeTheta = 0.11,
  dReaction = 10
): number {
  if (speedKmh <= 0.5) return dReaction;
  const vMs = (speedKmh * 1000) / 3600;
  const g = 9.81;
  const effMu =
    direction === -1
      ? Math.max(0.08, frictionMu - gradeTheta)
      : frictionMu + gradeTheta;
  const dStop = (vMs * vMs) / (2 * g * effMu) + dReaction;
  return parseFloat(dStop.toFixed(1));
}

// NMDC Mines Geo-bounds for hardware telemetry and satellite projection
export interface MineSiteInfo {
  id: string;
  name: string;
  subName: string;
  location: string;
  state: string;
  center: [number, number]; // [lat, lng]
  zoom: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  elevationRange: string;
  grade: string;
}

export const NMDC_MINES: Record<string, MineSiteInfo> = {
  '14A': {
    id: '14A',
    name: 'Sector 14-A Incline Pit',
    subName: 'Bailadila Iron Ore Mine, NMDC Ltd',
    location: 'Kirandul',
    state: 'Chhattisgarh',
    center: [18.606, 81.226],
    zoom: 15,
    bounds: {
      minLat: 18.602,
      maxLat: 18.610,
      minLng: 81.221,
      maxLng: 81.231,
    },
    elevationRange: 'RL 1,040M - 1,280M',
    grade: '11% Continuous',
  },
  '14C': {
    id: '14C',
    name: 'Bailadila 14C Main Plant',
    subName: 'Dep 5 Sub-Station & Processing Pit',
    location: 'Kirandul',
    state: 'Chhattisgarh',
    center: [18.625, 81.234],
    zoom: 15,
    bounds: {
      minLat: 18.618,
      maxLat: 18.632,
      minLng: 81.226,
      maxLng: 81.242,
    },
    elevationRange: 'RL 980M - 1,240M',
    grade: '9.5% Spiral',
  },
  'DEP5': {
    id: 'DEP5',
    name: 'Deposit-5 Bacheli Complex',
    subName: 'Screening Plant, NMDC BIOM Complex',
    location: 'Bacheli',
    state: 'Chhattisgarh',
    center: [18.687, 81.272],
    zoom: 15,
    bounds: {
      minLat: 18.680,
      maxLat: 18.695,
      minLng: 81.264,
      maxLng: 81.280,
    },
    elevationRange: 'RL 840M - 1,190M',
    grade: '8.2% Terraced',
  },
  'DONI': {
    id: 'DONI',
    name: 'Donimalai Iron Ore Complex',
    subName: 'NMDC Karnataka Open-Cast Project',
    location: 'Donimalai / Sandur',
    state: 'Karnataka',
    center: [15.064, 76.618],
    zoom: 14,
    bounds: {
      minLat: 15.050,
      maxLat: 15.078,
      minLng: 76.602,
      maxLng: 76.634,
    },
    elevationRange: 'RL 720M - 1,010M',
    grade: '7.8% Bench',
  },
};

// Default Bailadila Deposit 14-A Geo-bounds for hardware telemetry projection
export const GEO_BOUNDS = NMDC_MINES['14A'].bounds;

export function projectGpsToCanvas(lat: number, lng: number, mineId: string = '14A'): { x: number; y: number } {
  const bounds = NMDC_MINES[mineId]?.bounds || GEO_BOUNDS;
  const normX = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
  const normY = 1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  return {
    x: Math.max(20, Math.min(780, 50 + normX * 700)),
    y: Math.max(20, Math.min(580, 50 + normY * 500)),
  };
}

export function projectCanvasToGps(x: number, y: number, mineId: string = '14A'): { lat: number; lng: number } {
  const bounds = NMDC_MINES[mineId]?.bounds || GEO_BOUNDS;
  const normX = (x - 50) / 700;
  const normY = (y - 50) / 500;
  const lng = bounds.minLng + normX * (bounds.maxLng - bounds.minLng);
  const lat = bounds.maxLat - normY * (bounds.maxLat - bounds.minLat);
  return { lat, lng };
}


