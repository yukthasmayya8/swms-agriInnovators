import { query, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { Role } from "../../utils/jwt";

export interface HabitationRow {
  id: string;
  name: string;
  type: string;
  municipality: string;
  latitude: number;
  longitude: number;
  owner_id: string;
  is_deleted?: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export async function listHabitations(userMunicipality?: string): Promise<HabitationRow[]> {
  if (!userMunicipality || userMunicipality === "All") {
    const result = await query(`SELECT h.*, d.population, d.growth_rate_pct FROM habitations h LEFT JOIN demography_parameters d ON d.habitation_id = h.id WHERE h.is_deleted = false ORDER BY h.created_at DESC`);
    return result.rows;
  }
  const result = await query(
    `SELECT h.*, d.population, d.growth_rate_pct FROM habitations h LEFT JOIN demography_parameters d ON d.habitation_id = h.id WHERE h.is_deleted = false AND h.municipality = $1 ORDER BY h.created_at DESC`,
    [userMunicipality]
  );
  return result.rows;
}

export async function compareWards(targetMunicipality: string) {
  const sql = `
    SELECT 
      h.id, h.name, h.type, h.municipality, h.latitude, h.longitude,
      COALESCE(d.population, 12000) as population,
      COALESCE(d.growth_rate_pct, 1.2) as growth_rate_pct,
      COALESCE(d.floating_pop_pct, 5.0) as floating_pop_pct,
      COALESCE(i.collection_vehicles, 5) as collection_vehicles,
      COALESCE(i.road_coverage_pct, 70.0) as road_coverage_pct,
      COALESCE(ind.industrial_waste_tonnes_per_day, 1.5) as industrial_waste_tonnes,
      COALESCE(ind.hazardous_share_pct, 2.5) as hazardous_share_pct,
      COALESCE(c.segregation_adherence_pct, 60.0) as segregation_adherence_pct
    FROM habitations h
    LEFT JOIN demography_parameters d ON h.id = d.habitation_id
    LEFT JOIN infrastructure_parameters i ON h.id = i.habitation_id
    LEFT JOIN industrial_parameters ind ON h.id = ind.habitation_id
    LEFT JOIN cultural_parameters c ON h.id = c.habitation_id
    WHERE h.is_deleted = false
      ${targetMunicipality && targetMunicipality !== "All" ? `AND h.municipality = $1` : ""}
    ORDER BY h.name ASC
  `;
  const params = targetMunicipality && targetMunicipality !== "All" ? [targetMunicipality] : [];
  const result = await query(sql, params);

  return result.rows.map((row) => {
    const pop = Number(row.population);
    const perCapitaKg = 0.673; // standard benchmark
    const residentialWasteTonnes = (pop * perCapitaKg) / 1000;
    const industrialWasteTonnes = Number(row.industrial_waste_tonnes);
    const totalWasteTonnes = +(residentialWasteTonnes + industrialWasteTonnes).toFixed(2);
    const hazardousShare = Number(row.hazardous_share_pct) / 100;
    const segregationAdherence = Number(row.segregation_adherence_pct) / 100;
    const wetWasteTonnes = +(totalWasteTonnes * (0.55 * (1 + 0.1 * (1 - segregationAdherence)))).toFixed(2);
    const dryWasteTonnes = +(totalWasteTonnes * (0.38 * segregationAdherence + 0.30)).toFixed(2);
    const hazardousWasteTonnes = +(totalWasteTonnes * hazardousShare).toFixed(2);
    const collectionEfficiencyPct = Math.min(98, Math.round(55 + Number(row.road_coverage_pct) * 0.35 + Number(row.collection_vehicles) * 1.5));
    const collectedWasteTonnes = +(totalWasteTonnes * (collectionEfficiencyPct / 100)).toFixed(2);
    const perCapitaDailyKg = +((totalWasteTonnes * 1000) / pop).toFixed(3);

    return {
      habitationId: row.id,
      wardName: row.name,
      municipality: row.municipality,
      population: pop,
      growthRatePct: Number(row.growth_rate_pct),
      floatingPopPct: Number(row.floating_pop_pct),
      totalWasteTonnesPerDay: totalWasteTonnes,
      wetWasteTonnesPerDay: wetWasteTonnes,
      dryWasteTonnesPerDay: dryWasteTonnes,
      hazardousWasteTonnesPerDay: hazardousWasteTonnes,
      collectedWasteTonnesPerDay: collectedWasteTonnes,
      collectionEfficiencyPct,
      perCapitaDailyKg,
      collectionVehicles: Number(row.collection_vehicles),
      segregationAdherencePct: Number(row.segregation_adherence_pct)
    };
  });
}

export async function getHabitationOr404(id: string, userMunicipality?: string): Promise<HabitationRow> {
  const scoped = userMunicipality && userMunicipality !== "All";
  const result = await query(
    `SELECT * FROM habitations WHERE id = $1 AND is_deleted = false${scoped ? " AND municipality = $2" : ""}`,
    scoped ? [id, userMunicipality] : [id]
  );
  if (!result.rows[0]) throw ApiError.notFound("Habitation does not exist");
  return result.rows[0];
}

export async function createHabitation(
  input: { name: string; type: string; municipality?: string; latitude: number; longitude: number },
  ownerId: string
): Promise<HabitationRow> {
  const municipality = input.municipality || "Udupi Municipality";
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO habitations (name, type, municipality, latitude, longitude, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.name, input.type, municipality, input.latitude, input.longitude, ownerId]
    );
    const habitationId = result.rows[0].id;
    await client.query(`INSERT INTO demography_parameters (habitation_id, population, population_density_per_sq_km, growth_rate_pct, floating_pop_pct, updated_by) VALUES ($1, 1, 1, 0, 0, $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO infrastructure_parameters (habitation_id, road_coverage_pct, roads_alleys_count, residential_zone_pct, industrial_zone_pct, schools_count, clinics_count, collection_vehicles, collection_point_density_pct, existing_landfill_capacity_tonnes, updated_by) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO industrial_parameters (habitation_id, has_organized_industry, has_unorganized_industry, industrial_activity_intensity, industrial_waste_tonnes_per_day, hazardous_share_pct, updated_by) VALUES ($1, false, false, 'low', 0, 0, $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO natural_resource_parameters (habitation_id, annual_rainfall_mm, water_bodies_count, forest_cover_pct, sensitive_area_nearby, updated_by) VALUES ($1, 0, 0, 0, false, $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO terrain_parameters (habitation_id, slope, soil_type, wind_condition, accessibility, flood_prone, updated_by) VALUES ($1, 'flat', 'permeable', 'moderate', 'moderate', false, $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO economic_parameters (habitation_id, per_capita_income_annual, annual_budget_inr, willingness_to_pay_pct, cost_constraint_level, updated_by) VALUES ($1, 0, 0, 0, 'low', $2)`, [habitationId, ownerId]);
    await client.query(`INSERT INTO cultural_parameters (habitation_id, diet_type, segregation_adherence_pct, festival_spike_pct, local_practice_notes, updated_by) VALUES ($1, 'mixed', 0, 0, '', $2)`, [habitationId, ownerId]);
    return result.rows[0];
  });
}

/** BR-02: Admin may edit any habitation; a Planner may only edit habitations they own. */
export function assertCanEditHabitation(habitation: HabitationRow, userId: string, role: Role) {
  if (role === "admin") return;
  if (role === "planner" && habitation.owner_id === userId) return;
  throw ApiError.forbidden("You can only edit habitations you own");
}

export async function updateHabitation(
  id: string,
  patch: Partial<{ name: string; type: string; municipality: string; latitude: number; longitude: number }>
): Promise<HabitationRow> {
  const fields = Object.keys(patch);
  if (fields.length === 0) return getHabitationOr404(id);

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
  const values = fields.map((f) => (patch as any)[f]);
  const result = await query(
    `UPDATE habitations SET ${setClauses}, updated_at = now() WHERE id = $1 AND is_deleted = false RETURNING *`,
    [id, ...values]
  );
  if (!result.rows[0]) throw ApiError.notFound("Habitation does not exist");
  return result.rows[0];
}

/** BR-09 & T-14: Admin soft-deletes a habitation. Blocked (409) if any upload batch is status = 'validating'. */
export async function deleteHabitation(id: string): Promise<void> {
  const hab = await getHabitationOr404(id);

  const activeBatches = await query(
    `SELECT id FROM upload_batches WHERE habitation_id = $1 AND status = 'validating' AND is_deleted = false`,
    [hab.id]
  );
  if (activeBatches.rows.length > 0) {
    throw ApiError.conflict("Cannot delete habitation with an in-flight validating batch");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE habitations SET is_deleted = true, deleted_at = now() WHERE id = $1`,
      [hab.id]
    );
    await client.query(
      `UPDATE map_layers SET is_deleted = true, deleted_at = now() WHERE habitation_id = $1`,
      [hab.id]
    );
    await client.query(
      `UPDATE upload_batches SET is_deleted = true, deleted_at = now() WHERE habitation_id = $1 AND status != 'validating'`,
      [hab.id]
    );
  });
}
