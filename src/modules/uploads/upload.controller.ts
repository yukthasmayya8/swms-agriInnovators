import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { createUploadSchema, issuesQuerySchema } from "./upload.schema";
import * as service from "./upload.service";
import { getHabitationOr404, assertCanEditHabitation } from "../habitations/habitation.service";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createUploadSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("habitationId and category are required");
  if (!req.file) throw ApiError.badRequest("No file was uploaded (expected field name \"file\")");

  const habitation = await getHabitationOr404(parsed.data.habitationId, req.user?.municipality);
  assertCanEditHabitation(habitation, req.user!.id, req.user!.role); // Admin or owning Planner only

  const batch = await service.createUploadBatch(parsed.data.habitationId, parsed.data.category, req.file, req.user!.id);
  const status = (batch as any).isExisting ? 200 : 202;
  res.status(status).json({ success: true, data: { id: batch.id, status: batch.status, originalFilename: batch.original_filename } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const batches = await service.listUploadBatches(req.user?.municipality, req.query.habitationId as string | undefined);
  const data = await Promise.all(batches.map(async (batch) => ({
    ...batch,
    issues: await service.getValidationIssues(batch.id)
  })));
  res.json({ success: true, data });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const batch = await service.getUploadBatchOr404((req.params.id as string));
  res.json({
    success: true,
    data: {
      id: batch.id, habitationId: batch.habitation_id, category: batch.category, status: batch.status,
      rowCount: batch.row_count, validRowCount: batch.valid_row_count, uploadedAt: batch.uploaded_at
    }
  });
});

export const issues = asyncHandler(async (req: Request, res: Response) => {
  await service.getUploadBatchOr404((req.params.id as string));
  const parsed = issuesQuerySchema.safeParse(req.query);
  const rows = await service.getValidationIssues((req.params.id as string), parsed.success ? parsed.data.issueType : undefined);
  res.json({ success: true, data: rows.map((r: any) => ({ id: r.id, row: r.row_number, field: r.field_name, issueType: r.issue_type, message: r.message, resolvedAt: r.resolved_at, resolution: r.resolution })) });
});

export const resolveIssue = asyncHandler(async (req: Request, res: Response) => {
  const resolution = String(req.body?.resolution || "").trim();
  if (!resolution) throw ApiError.badRequest("A correction note is required");
  await service.getUploadBatchOr404(req.params.id as string);
  const issue = await service.resolveValidationIssue(req.params.issueId as string, req.params.id as string, resolution, req.user!.id);
  res.json({ success: true, data: issue });
});

export const downloadTemplate = asyncHandler(async (req: Request, res: Response) => {
  const category = (req.params.category as string) || "demography";
  const template = service.generateCsvTemplate(category);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${template.filename}"`);
  res.send(template.content);
});
