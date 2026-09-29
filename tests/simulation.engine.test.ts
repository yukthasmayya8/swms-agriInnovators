import { runSensitivity, runSimulation } from "../src/modules/simulation/engine";

describe("SWMS simulation engine", () => {
  const input = {
    startYear: 2026,
    population: 28460,
    growthRatePct: 1.84,
    floatingPopPct: 6.8,
    industrialWasteTonnesPerDay: 1.8,
    roadCoveragePct: 82,
    landfillCapacityTonnes: 18400,
    segregationAdherencePct: 61,
    festivalSpikePct: 28,
    accessibility: "good" as const
  };

  it("generates exactly 20 year-by-year results", () => {
    const result = runSimulation(input);
    expect(result.years).toHaveLength(20);
    expect(result.years[0].year).toBe(2026);
    expect(result.years[19].year).toBe(2045);
    expect(result.summary.peakDailyWasteTonnes).toBeGreaterThan(result.years[0].totalWasteTonnesPerDay);
  });

  it("keeps waste balance and vehicle capacity logic explainable", () => {
    const result = runSimulation(input);
    for (const year of result.years) {
      expect(year.collectedTonnesPerDay).toBeLessThanOrEqual(year.totalWasteTonnesPerDay + 1e-9);
      expect(year.disposalTonnesPerDay).toBeGreaterThanOrEqual(0);
      expect(year.vehiclesRequired * 5).toBeGreaterThanOrEqual(year.collectedTonnesPerDay);
    }
  });

  it("changes outputs for flood scenario and supports sensitivity analysis", () => {
    const normal = runSimulation(input);
    const flood = runSimulation({ ...input, scenario: "flood" });
    expect(flood.years[0].collectionCoveragePct).toBeLessThan(normal.years[0].collectionCoveragePct);
    const sensitivity = runSensitivity(input, [
      { name: "population", multiplier: 1.2 },
      { name: "waste", multiplier: 1.1 }
    ]);
    expect(sensitivity).toHaveLength(2);
    expect(sensitivity[0].peakDailyWasteTonnes).toBeGreaterThan(normal.summary.peakDailyWasteTonnes);
  });
});
