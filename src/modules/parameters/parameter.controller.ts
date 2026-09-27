import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { CATEGORY_SCHEMAS, isValidCategory } from "./parameter.categories";
import { getCategory, upsertCategory, getCategoryHistory } from "./parameter.service";
import { getHabitationOr404, assertCanEditHabitation } from "../habitations/habitation.service";

function assertCategory(category: string) {
  if (!isValidCategory(category)) {
    throw ApiError.badRequest(
      `Unknown parameter category "${category}"`,
      { allowed: Object.keys(CATEGORY_SCHEMAS) }
    );
  }
}

export const get = asyncHandler(async (req: Request, res: Response) => {
  const habitationId = req.params.id as string;
  const category = req.params.category as string;
  assertCategory(category);
  const data = await getCategory(habitationId, category as any);
  res.json({ success: true, data });
});

export const put = asyncHandler(async (req: Request, res: Response) => {
  const habitationId = req.params.id as string;
  const category = req.params.category as string;
  assertCategory(category);

  const habitation = await getHabitationOr404(habitationId);
  assertCanEditHabitation(habitation, req.user!.id, req.user!.role); // BR-01 / BR-02

  const schema = CATEGORY_SCHEMAS[category as keyof typeof CATEGORY_SCHEMAS];
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Request failed validation", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }

  const { row, changedFields } = await upsertCategory(habitationId, category as any, parsed.data, req.user!.id);
  res.json({ success: true, data: { habitationId, category, updatedAt: row.updated_at, fieldsChanged: changedFields, version: row.version } });
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  const habitationId = req.params.id as string;
  const category = req.params.category as string;
  assertCategory(category);
  const rows = await getCategoryHistory(habitationId, category as any);
  res.json({ success: true, data: rows });
});
