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

  const habitation = await getHabitationOr404(parsed.data.habitationId);
  assertCanEditHabitation(habitation, req.user!.id, req.user!.role); // Admin or owning Planner only

  const batch = await service.createUploadBatch(parsed.data.habitationId, parsed.data.category, req.file, req.user!.id);
  const status = (batch as any).isExisting ? 200 : 202;
  res.status(status).json({ success: true, data: { id: batch.id, status: batch.status, originalFilename: batch.original_filename } });
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
  res.json({ success: true, data: rows.map((r: any) => ({ row: r.row_number, field: r.field_name, issueType: r.issue_type, message: r.message })) });
});
