import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { getHabitationOr404 } from "../habitations/habitation.service";
import { getCategory } from "../parameters/parameter.service";
import { runSimulation } from "./engine";
import { runSensitivity } from "./engine";

async function readCategory(habitationId: string, category: any) {
    try {
        return await getCategory(habitationId, category);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return {};
        throw error;
    }
}

async function readSimulationInput(req: Request) {
    const habitationId = req.params.id as string;
    const habitation = await getHabitationOr404(habitationId, req.user?.municipality);
    const [demography, infrastructure, industrial, cultural, terrain] = await Promise.all([
        readCategory(habitationId, "demography"), readCategory(habitationId, "infrastructure"),
        readCategory(habitationId, "industrial"), readCategory(habitationId, "cultural"), readCategory(habitationId, "terrain")
    ]);
    const input = {
        startYear: Number(req.query.startYear || 2026),
        population: Number(demography.population || 0),
        growthRatePct: Number(demography.growth_rate_pct || 0),
        floatingPopPct: Number(demography.floating_pop_pct || 0),
        industrialWasteTonnesPerDay: Number(industrial.industrial_waste_tonnes_per_day || 0),
        perCapitaDailyWasteKg: 0.673,
        collectionVehicles: Number(infrastructure.collection_vehicles || 0),
        roadCoveragePct: Number(infrastructure.road_coverage_pct || 0),
        landfillCapacityTonnes: Number(infrastructure.existing_landfill_capacity_tonnes || 0),
        segregationAdherencePct: Number(cultural.segregation_adherence_pct || 0),
        festivalSpikePct: Number(cultural.festival_spike_pct || 0),
        accessibility: terrain.accessibility || "moderate",
        scenario: "normal" as const
    };
    if (!input.population) throw ApiError.badRequest("Demography parameters must include population before analysis can run");
    return { habitation, input };
}

export const simulate = asyncHandler(async (req: Request, res: Response) => {
    const habitationId = req.params.id as string;
    const habitation = await getHabitationOr404(habitationId, req.user?.municipality);
    const [demography, infrastructure, industrial, cultural, terrain] = await Promise.all([
        readCategory(habitationId, "demography"),
        readCategory(habitationId, "infrastructure"),
        readCategory(habitationId, "industrial"),
        readCategory(habitationId, "cultural"),
        readCategory(habitationId, "terrain")
    ]);

    const startYear = Number(req.query.startYear || 2026);
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2200) {
        throw ApiError.badRequest("startYear must be an integer between 1900 and 2200");
    }
    const scenario = String(req.query.scenario || "normal");
    if (!["normal", "flood", "heavy_monsoon", "road_blockage"].includes(scenario)) {
        throw ApiError.badRequest("Unsupported simulation scenario");
    }

    const overrideNumber = (name: string, fallback: number, minimum: number, maximum: number) => {
        if (req.query[name] === undefined) return fallback;
        const value = Number(req.query[name]);
        if (!Number.isFinite(value) || value < minimum || value > maximum) {
            throw ApiError.badRequest(`${name} must be between ${minimum} and ${maximum}`);
        }
        return value;
    };

    const input = {
        startYear,
        population: overrideNumber("population", Number(demography.population || 0), 1, 100000000),
        growthRatePct: Number(demography.growth_rate_pct || 0),
        floatingPopPct: Number(demography.floating_pop_pct || 0),
        industrialWasteTonnesPerDay: Number(industrial.industrial_waste_tonnes_per_day || 0),
        perCapitaDailyWasteKg: overrideNumber("perCapitaKg", 0.673, 0.05, 5),
        collectionVehicles: overrideNumber("collectionVehicles", Number(infrastructure.collection_vehicles || 0), 0, 10000),
        roadCoveragePct: Number(infrastructure.road_coverage_pct || 0),
        landfillCapacityTonnes: Number(infrastructure.existing_landfill_capacity_tonnes || 0),
        segregationAdherencePct: Number(cultural.segregation_adherence_pct || 0),
        festivalSpikePct: Number(cultural.festival_spike_pct || 0),
        accessibility: terrain.accessibility || "moderate",
        scenario: scenario as "normal" | "flood" | "heavy_monsoon" | "road_blockage"
    };

    if (!input.population) throw ApiError.badRequest("Demography parameters must include population before simulation can run");
    const simulation = runSimulation(input);
    const past = [];
    for (let offset = 20; offset >= 1; offset -= 1) {
        const year = startYear - offset;
        const population = Math.round(input.population / Math.pow(1 + input.growthRatePct / 100, offset));
        const waste = +(((population * (1 + input.floatingPopPct / 100) * input.perCapitaDailyWasteKg) / 1000) + input.industrialWasteTonnesPerDay).toFixed(2);
        const margin = 0.03 + 0.003 * offset;
        past.push({ year, population, wasteTonnesPerDay: waste, lowerBound: +(waste * (1 - margin)).toFixed(2), upperBound: +(waste * (1 + margin)).toFixed(2), period: "Past (Historical)" });
    }
    const future = simulation.years.map((row, index) => ({
        ...row,
        wasteTonnesPerDay: row.totalWasteTonnesPerDay,
        lowerBound: +(row.totalWasteTonnesPerDay * (1 - (0.04 + 0.005 * index))).toFixed(2),
        upperBound: +(row.totalWasteTonnesPerDay * (1 + (0.04 + 0.005 * index))).toFixed(2),
        period: index === 0 ? "Current Base Year" : "Future Projection"
    }));

    res.json({ success: true, data: { habitationId, habitationName: habitation.name, scenario, input, years: simulation.years, summary: simulation.summary, forecast: [...past, ...future] } });
});

export const sensitivity = asyncHandler(async (req: Request, res: Response) => {
    const { habitation, input } = await readSimulationInput(req);
    const results = runSensitivity(input, [
        { name: "population", multiplier: 0.9 }, { name: "population", multiplier: 1.1 },
        { name: "growth", multiplier: 0.8 }, { name: "growth", multiplier: 1.2 },
        { name: "waste", multiplier: 0.9 }, { name: "waste", multiplier: 1.1 }
    ]);
    res.json({ success: true, data: { habitationId: habitation.id, base: runSimulation(input).summary, results } });
});

export const budget = asyncHandler(async (req: Request, res: Response) => {
    const { habitation, input } = await readSimulationInput(req);
    const simulation = runSimulation(input);
    const current = simulation.years[0];
    const vehicles = Math.max(current.vehiclesRequired, 1);
    const fleetCapexInr = vehicles * 1800000;
    const annualCollectionOpexInr = Math.round(current.collectedTonnesPerDay * 365 * 4200);
    const annualTreatmentOpexInr = Math.round(current.treatedTonnesPerDay * 365 * 2600);
    res.json({ success: true, data: { habitationId: habitation.id, currentYear: current.year, vehiclesRequired: vehicles, fleetCapexInr, annualCollectionOpexInr, annualTreatmentOpexInr, annualTotalOpexInr: annualCollectionOpexInr + annualTreatmentOpexInr } });
});

export const ask = asyncHandler(async (req: Request, res: Response) => {
    const { habitation, input } = await readSimulationInput(req);
    const simulation = runSimulation(input);
    const query = String(req.body?.question || "").toLowerCase();
    const peak = simulation.years.reduce((best, row) => row.totalWasteTonnesPerDay > best.totalWasteTonnesPerDay ? row : best, simulation.years[0]);
    const answer = query.includes("vehicle")
        ? `${habitation.name} requires ${simulation.years[0].vehiclesRequired} vehicles in ${simulation.years[0].year}.`
        : query.includes("peak")
            ? `Peak simulated waste is ${peak.totalWasteTonnesPerDay} tonnes/day in ${peak.year}.`
            : `The server simulation projects ${simulation.years[simulation.years.length - 1].totalWasteTonnesPerDay} tonnes/day by ${simulation.years[simulation.years.length - 1].year}.`;
    res.json({ success: true, data: { answer, habitationId: habitation.id, simulation: simulation.summary } });
});