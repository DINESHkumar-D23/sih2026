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

// Bailadila Deposit 14-A Geo-bounds for hardware telemetry projection
export const GEO_BOUNDS = {
  minLat: 18.602,
  maxLat: 18.61,
  minLng: 81.221,
  maxLng: 81.231,
};

export function projectGpsToCanvas(lat: number, lng: number): { x: number; y: number } {
  const normX = (lng - GEO_BOUNDS.minLng) / (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng);
  const normY = 1 - (lat - GEO_BOUNDS.minLat) / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat);
  return {
    x: Math.max(20, Math.min(780, 50 + normX * 700)),
    y: Math.max(20, Math.min(580, 50 + normY * 500)),
  };
}
