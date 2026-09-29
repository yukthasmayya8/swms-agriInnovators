import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./habitation.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const municipalityQuery = (req.query.municipality as string) || req.user?.municipality;
  const habitations = await service.listHabitations(municipalityQuery);
  res.json({ success: true, data: habitations });
});

export const compare = asyncHandler(async (req: Request, res: Response) => {
  const requestedMunicipality = req.query.municipality as string;
  const municipality = req.user?.municipality && req.user.municipality !== "All"
    ? req.user.municipality
    : requestedMunicipality || "All";
  const comparison = await service.compareWards(municipality);
  res.json({ success: true, data: comparison });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const municipality = req.user?.municipality && req.user.municipality !== "All"
    ? req.user.municipality
    : req.body.municipality;
  const habitation = await service.createHabitation(
    { ...req.body, municipality: municipality || "Udupi Municipality" },
    req.user!.id
  );
  res.status(201).json({ success: true, data: habitation });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const habitation = await service.getHabitationOr404((req.params.id as string), req.user?.municipality);
  res.json({ success: true, data: habitation });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const habitation = await service.getHabitationOr404((req.params.id as string), req.user?.municipality);
  service.assertCanEditHabitation(habitation, req.user!.id, req.user!.role);
  const updated = await service.updateHabitation((req.params.id as string), req.body);
  res.json({ success: true, data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.getHabitationOr404((req.params.id as string), req.user?.municipality); // 404 before 204, so the client sees a clear signal either way
  await service.deleteHabitation((req.params.id as string));
  res.status(204).send();
});
