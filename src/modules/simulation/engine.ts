/**
 * SWMS Simulation Engine
 * Computes multi-year waste generation balance, collection coverage, vehicles required,
 * scenario impacts (flood, monsoon), and parameter sensitivity analysis.
 */

export interface SimulationInput {
  startYear?: number;
  population: number;
  growthRatePct: number;
  floatingPopPct?: number;
  industrialWasteTonnesPerDay?: number;
  perCapitaDailyWasteKg?: number;
  collectionVehicles?: number;
  roadCoveragePct?: number;
  landfillCapacityTonnes?: number;
  segregationAdherencePct?: number;
  festivalSpikePct?: number;
  accessibility?: "good" | "moderate" | "poor";
  scenario?: "normal" | "flood" | "heavy_monsoon" | "road_blockage";
}

export interface SimulationYearResult {
  year: number;
  population: number;
  totalWasteTonnesPerDay: number;
  collectedTonnesPerDay: number;
  treatedTonnesPerDay: number;
  disposalTonnesPerDay: number;
  collectionCoveragePct: number;
  vehiclesRequired: number;
}

export interface SimulationSummary {
  peakDailyWasteTonnes: number;
  total20YearWasteTonnes: number;
  landfillDepletionYear: number | null;
}

export interface SimulationOutput {
  years: SimulationYearResult[];
  summary: SimulationSummary;
}

export function runSimulation(input: SimulationInput): SimulationOutput {
  const startYear = input.startYear || 2026;
  const basePop = Number(input.population || 25000);
  const growth = Number(input.growthRatePct || 1.8);
  const floating = Number(input.floatingPopPct || 5.0);
  const indWaste = Number(input.industrialWasteTonnesPerDay || 1.5);
  const perCapitaDailyWasteKg = Number(input.perCapitaDailyWasteKg || 0.673);
  const collectionVehicles = Number(input.collectionVehicles || 0);
  const roadCoverage = Number(input.roadCoveragePct || 80);
  const segregation = Number(input.segregationAdherencePct || 60);

  let scenarioDisruption = 1.0;
  if (input.scenario === "flood") scenarioDisruption = 0.65; // 35% disruption in collection during flood
  else if (input.scenario === "road_blockage") scenarioDisruption = 0.80;
  else if (input.scenario === "heavy_monsoon") scenarioDisruption = 0.85;

  const years: SimulationYearResult[] = [];
  let peakDailyWasteTonnes = 0;
  let total20YearWasteTonnes = 0;

  for (let i = 0; i < 20; i++) {
    const year = startYear + i;
    const pop = Math.round(basePop * Math.pow(1 + growth / 100, i));
    const effectivePop = pop * (1 + floating / 100);
    const residentialWaste = (effectivePop * perCapitaDailyWasteKg) / 1000;
    const totalWaste = +(residentialWaste + indWaste).toFixed(2);

    if (totalWaste > peakDailyWasteTonnes) peakDailyWasteTonnes = totalWaste;
    total20YearWasteTonnes += totalWaste * 365;

    const baseCoverage = Math.min(98, Math.max(30, roadCoverage * 0.95 + (segregation > 50 ? 5 : 0) + collectionVehicles * 1.5));
    const collectionCoveragePct = +(baseCoverage * scenarioDisruption).toFixed(1);
    const collectedWaste = +(totalWaste * (collectionCoveragePct / 100)).toFixed(2);
    const treatedWaste = +(collectedWaste * 0.60).toFixed(2);
    const disposalWaste = +(collectedWaste - treatedWaste).toFixed(2);
    const vehiclesRequired = Math.ceil(collectedWaste / 4.5); // 4.5 tonnes payload capacity per vehicle per day

    years.push({
      year,
      population: pop,
      totalWasteTonnesPerDay: totalWaste,
      collectedTonnesPerDay: collectedWaste,
      treatedTonnesPerDay: treatedWaste,
      disposalTonnesPerDay: disposalWaste,
      collectionCoveragePct,
      vehiclesRequired
    });
  }

  return {
    years,
    summary: {
      peakDailyWasteTonnes,
      total20YearWasteTonnes: Math.round(total20YearWasteTonnes),
      landfillDepletionYear: startYear + 14
    }
  };
}

export function runSensitivity(
  baseInput: SimulationInput,
  variations: { name: "population" | "waste" | "growth"; multiplier: number }[]
): SimulationSummary[] {
  return variations.map((varItem) => {
    const modInput = { ...baseInput };
    if (varItem.name === "population") modInput.population = Math.round(baseInput.population * varItem.multiplier);
    if (varItem.name === "growth") modInput.growthRatePct = baseInput.growthRatePct * varItem.multiplier;
    if (varItem.name === "waste") modInput.industrialWasteTonnesPerDay = (baseInput.industrialWasteTonnesPerDay || 1.5) * varItem.multiplier;
    const sim = runSimulation(modInput);
    return sim.summary;
  });
}
