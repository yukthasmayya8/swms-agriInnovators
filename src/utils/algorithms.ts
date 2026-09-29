/**
 * SWMS Core Waste Management Algorithms Suite
 * Production-grade implementations of VRP/TSP Route Optimization, 
 * Statistical Waste Generation Forecasting, Z-Score Anomaly Detection,
 * and Multi-Criteria Decision Analysis (MCDA) Ward Risk Scoring.
 */

export interface BinLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  fillLevelPct: number; // 0 to 100
  capacityKg: number;
}

export interface RouteOptimizationResult {
  orderedBins: BinLocation[];
  totalDistanceKm: number;
  estimatedTimeMins: number;
  capacityUtilizationPct: number;
  steps: { from: string; to: string; distanceKm: number }[];
}

export interface ForecastPoint {
  year: number;
  population: number;
  wasteTonnesPerDay: number;
  lowerBound: number;
  upperBound: number;
}

export interface AnomalyReport {
  habitationId: string;
  name: string;
  currentWasteTonnes: number;
  meanWasteTonnes: number;
  stdDev: number;
  zScore: number;
  iqr: number;
  isAnomaly: boolean;
  severity: "Normal" | "Warning" | "Critical";
  reason: string;
}

export interface WardRiskScore {
  habitationId: string;
  wardName: string;
  riskScore: number; // 0 (safest) to 100 (highest risk)
  category: "Low" | "Moderate" | "High" | "Critical";
  wastePressureComponent: number;
  segregationDeficitComponent: number;
  collectionDeficitComponent: number;
  floodRiskComponent: number;
}

/** Haversine formula for distance between 2 coordinates in kilometers */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(2);
}

/**
 * 1. Route Optimization Algorithm (Greedy Nearest-Neighbor TSP / VRP)
 * Prioritizes bins exceeding fill threshold (e.g. >= 60%) and minimizes collection route distance.
 */
export function optimizeWasteCollectionRoute(
  depot: BinLocation,
  bins: BinLocation[],
  vehicleCapacityKg = 5000,
  minFillThresholdPct = 50
): RouteOptimizationResult {
  const priorityBins = bins.filter((b) => b.fillLevelPct >= minFillThresholdPct);
  const targetBins = priorityBins.length > 0 ? priorityBins : bins;

  let current = depot;
  let remaining = [...targetBins];
  let currentLoad = 0;
  let totalDistanceKm = 0;

  const orderedBins: BinLocation[] = [depot];
  const steps: { from: string; to: string; distanceKm: number }[] = [];

  while (remaining.length > 0) {
    let nearestIndex = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistanceKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1) break;

    const nextBin = remaining[nearestIndex];
    const binWasteKg = (nextBin.fillLevelPct / 100) * nextBin.capacityKg;

    if (currentLoad + binWasteKg > vehicleCapacityKg && currentLoad > 0) {
      // Vehicle full, return to depot step
      const returnDist = haversineDistanceKm(current.lat, current.lng, depot.lat, depot.lng);
      totalDistanceKm += returnDist;
      steps.push({ from: current.name, to: `${depot.name} (Depot Unload)`, distanceKm: returnDist });
      current = depot;
      currentLoad = 0;
    }

    totalDistanceKm += nearestDist;
    steps.push({ from: current.name, to: nextBin.name, distanceKm: nearestDist });
    currentLoad += binWasteKg;
    orderedBins.push(nextBin);
    current = nextBin;
    remaining.splice(nearestIndex, 1);
  }

  // Return to depot at end
  const finalReturnDist = haversineDistanceKm(current.lat, current.lng, depot.lat, depot.lng);
  totalDistanceKm += finalReturnDist;
  steps.push({ from: current.name, to: `${depot.name} (Depot Final)`, distanceKm: finalReturnDist });

  const estimatedTimeMins = Math.round((totalDistanceKm / 25) * 60 + (orderedBins.length - 1) * 8); // 25 km/h avg speed + 8 mins collection per bin
  const capacityUtilizationPct = Math.min(100, Math.round((currentLoad / vehicleCapacityKg) * 100));

  return {
    orderedBins,
    totalDistanceKm: +totalDistanceKm.toFixed(2),
    estimatedTimeMins,
    capacityUtilizationPct,
    steps
  };
}

/**
 * 2. Waste Generation Forecasting Algorithm
 * Supports 20-Year Retrospective Reconstruction (2006-2025) and 20-Year Future Projection (2026-2046).
 */
export function forecastPastAndFutureWaste(
  baseYear = 2026,
  basePopulation = 28460,
  annualGrowthRatePct = 1.8,
  perCapitaDailyWasteKg = 0.673,
  pastYears = 20,
  futureYears = 20
): ForecastPoint[] {
  const result: ForecastPoint[] = [];

  // 1. Reconstruct Past 20 Years (e.g., 2006 to 2025)
  for (let k = pastYears; k >= 1; k--) {
    const year = baseYear - k;
    const pop = Math.round(basePopulation / Math.pow(1 + annualGrowthRatePct / 100, k));
    const waste = (pop * perCapitaDailyWasteKg) / 1000;
    const marginPct = 0.03 + 0.003 * k;
    result.push({
      year,
      population: pop,
      wasteTonnesPerDay: +waste.toFixed(2),
      lowerBound: +(waste * (1 - marginPct)).toFixed(2),
      upperBound: +(waste * (1 + marginPct)).toFixed(2),
      period: "Past (Historical)"
    } as any);
  }

  // 2. Base Year (2026) & Future 20 Years (2026 to 2046)
  for (let i = 0; i <= futureYears; i++) {
    const year = baseYear + i;
    const pop = Math.round(basePopulation * Math.pow(1 + annualGrowthRatePct / 100, i));
    const waste = (pop * perCapitaDailyWasteKg) / 1000;
    const marginPct = 0.04 + 0.005 * i;
    result.push({
      year,
      population: pop,
      wasteTonnesPerDay: +waste.toFixed(2),
      lowerBound: +(waste * (1 - marginPct)).toFixed(2),
      upperBound: +(waste * (1 + marginPct)).toFixed(2),
      period: i === 0 ? "Current Base Year" : "Future Projection"
    } as any);
  }

  return result;
}

export function forecastWasteGeneration(
  baseYear: number,
  basePopulation: number,
  annualGrowthRatePct: number,
  perCapitaDailyWasteKg = 0.673,
  projectionYears = 20,
  alpha = 0.3,
  beta = 0.1
): ForecastPoint[] {
  return forecastPastAndFutureWaste(baseYear, basePopulation, annualGrowthRatePct, perCapitaDailyWasteKg, 0, projectionYears);
}

/**
 * 3. Anomaly & Overflow Detection Algorithm (Z-Score + IQR Outlier Detection)
 */
export function detectWasteAnomalies(
  historicalDailyWaste: number[],
  currentValue: number,
  habitationId: string,
  habitationName: string
): AnomalyReport {
  if (historicalDailyWaste.length < 3) {
    return {
      habitationId,
      name: habitationName,
      currentWasteTonnes: currentValue,
      meanWasteTonnes: currentValue,
      stdDev: 0,
      zScore: 0,
      iqr: 0,
      isAnomaly: false,
      severity: "Normal",
      reason: "Insufficient historical observations for statistical anomaly detection."
    };
  }

  const n = historicalDailyWaste.length;
  const mean = historicalDailyWaste.reduce((a, b) => a + b, 0) / n;
  const variance = historicalDailyWaste.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance) || 0.001;

  const zScore = +((currentValue - mean) / stdDev).toFixed(2);

  // IQR calculation
  const sorted = [...historicalDailyWaste].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;

  let isAnomaly = false;
  let severity: "Normal" | "Warning" | "Critical" = "Normal";
  let reason = "Waste generation is within historical statistical limits.";

  if (zScore >= 3.0 || currentValue > upperFence * 1.3) {
    isAnomaly = true;
    severity = "Critical";
    reason = `Critical waste surge! Current value (${currentValue} t/day) is ${zScore} standard deviations above historical mean (${+mean.toFixed(2)} t/day).`;
  } else if (zScore >= 2.0 || currentValue > upperFence) {
    isAnomaly = true;
    severity = "Warning";
    reason = `Warning: Elevated waste generation (${currentValue} t/day) detected (Z-Score: ${zScore}).`;
  }

  return {
    habitationId,
    name: habitationName,
    currentWasteTonnes: currentValue,
    meanWasteTonnes: +mean.toFixed(2),
    stdDev: +stdDev.toFixed(2),
    zScore,
    iqr: +iqr.toFixed(2),
    isAnomaly,
    severity,
    reason
  };
}

/**
 * 4. Ward Risk & Efficiency Score (Weighted MCDA Algorithm)
 * Combines Waste Generation Pressure, Segregation Deficit, Collection Deficit, and Flood Vulnerability.
 */
export function calculateWardRiskScore(
  habitationId: string,
  wardName: string,
  wasteTonnesPerDay: number,
  population: number,
  segregationAdherencePct: number,
  collectionEfficiencyPct: number,
  isFloodProne: boolean
): WardRiskScore {
  // 1. Waste Intensity Pressure Score (0 - 100)
  const perCapitaKg = (wasteTonnesPerDay * 1000) / (population || 1);
  const wastePressureComponent = Math.min(100, Math.round((perCapitaKg / 1.0) * 100));

  // 2. Segregation Deficit Score (0 - 100)
  const segregationDeficitComponent = Math.round(100 - segregationAdherencePct);

  // 3. Collection Deficit Score (0 - 100)
  const collectionDeficitComponent = Math.round(100 - collectionEfficiencyPct);

  // 4. Flood Risk Component (0 or 100)
  const floodRiskComponent = isFloodProne ? 100 : 20;

  // Weighted Multi-Criteria Decision Analysis (MCDA) equation
  // Risk = 0.35*(Waste Pressure) + 0.25*(Segregation Deficit) + 0.25*(Collection Deficit) + 0.15*(Flood Vulnerability)
  const rawRiskScore =
    0.35 * wastePressureComponent +
    0.25 * segregationDeficitComponent +
    0.25 * collectionDeficitComponent +
    0.15 * floodRiskComponent;

  const riskScore = Math.min(100, Math.max(0, Math.round(rawRiskScore)));

  let category: "Low" | "Moderate" | "High" | "Critical" = "Low";
  if (riskScore >= 75) category = "Critical";
  else if (riskScore >= 55) category = "High";
  else if (riskScore >= 35) category = "Moderate";

  return {
    habitationId,
    wardName,
    riskScore,
    category,
    wastePressureComponent: +wastePressureComponent.toFixed(1),
    segregationDeficitComponent: +segregationDeficitComponent.toFixed(1),
    collectionDeficitComponent: +collectionDeficitComponent.toFixed(1),
    floodRiskComponent: +floodRiskComponent.toFixed(1)
  };
}
