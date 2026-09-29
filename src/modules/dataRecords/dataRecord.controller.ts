import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

const DATA_FILE = path.join(process.cwd(), "storage", "manual-data.json");

function ensureDataFile() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
    }
}

function readDataRecords() {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
}

function writeDataRecords(records: any[]) {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

function normalizeRecord(entry: any) {
    return {
        id: entry.id || crypto.randomUUID(),
        habitation: String(entry.habitation || "").trim(),
        location: String(entry.location || "").trim(),
        population: Number(entry.population ?? 0),
        growthRate: Number(entry.growthRate ?? entry.growth ?? 0),
        rainfallMm: Number(entry.rainfallMm ?? entry.rainfall ?? 0),
        wasteTonnesPerDay: Number(entry.wasteTonnesPerDay ?? entry.waste ?? 0),
        collectionEfficiency: Number(entry.collectionEfficiency ?? entry.collection ?? 0),
        treatmentEfficiency: Number(entry.treatmentEfficiency ?? entry.treatment ?? 0),
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
    const records = readDataRecords();
    res.json({ success: true, data: records });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const records = readDataRecords();
    const nextRecord = normalizeRecord({
        ...req.body,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    records.unshift(nextRecord);
    writeDataRecords(records);
    res.status(201).json({ success: true, data: nextRecord });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
    const records = readDataRecords();
    const record = records.find((item) => item.id === req.params.id);
    if (!record) throw ApiError.notFound("Data record does not exist");
    res.json({ success: true, data: record });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const records = readDataRecords();
    const index = records.findIndex((item) => item.id === req.params.id);
    if (index === -1) throw ApiError.notFound("Data record does not exist");

    const updated = normalizeRecord({
        ...records[index],
        ...req.body,
        updatedAt: new Date().toISOString()
    });

    records[index] = updated;
    writeDataRecords(records);
    res.json({ success: true, data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const records = readDataRecords();
    const filtered = records.filter((item) => item.id !== req.params.id);
    if (filtered.length === records.length) throw ApiError.notFound("Data record does not exist");
    writeDataRecords(filtered);
    res.status(204).send();
});
