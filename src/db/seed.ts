import { pool, query } from "../config/db";
import { hashPassword } from "../utils/password";

const DEMO_PASSWORD = "Password123!";

async function upsertUser(name: string, email: string, role: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING id, email, role`,
    [name, email, passwordHash, role]
  );
  return result.rows[0];
}

async function seed() {
  const admin = await upsertUser("A. Municipal Admin", "admin@swms.dev", "admin");
  const planner = await upsertUser("P. Shetty (Planner)", "planner@swms.dev", "planner");
  await upsertUser("R. Kumar (Researcher)", "researcher@swms.dev", "researcher");

  const existing = await query(`SELECT id FROM habitations WHERE name = $1`, ["Shirva Village (Demo)"]);
  let habitationId = existing.rows[0]?.id;

  if (!habitationId) {
    const hab = await query(
      `INSERT INTO habitations (name, type, latitude, longitude, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ["Shirva Village (Demo)", "village", 13.2145, 74.7398, planner.id]
    );
    habitationId = hab.rows[0].id;

    await query(
      `INSERT INTO demography_parameters (habitation_id, population, population_density_per_sq_km, growth_rate_pct, floating_pop_pct, household_size, literacy_pct, updated_by)
       VALUES ($1, 4300, 950, 2.1, 8, 4.6, 78, $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO infrastructure_parameters (habitation_id, road_coverage_pct, roads_alleys_count, residential_zone_pct, industrial_zone_pct, schools_count, clinics_count, collection_vehicles, collection_point_density_pct, existing_landfill_capacity_tonnes, updated_by)
       VALUES ($1, 62, 40, 55, 4, 2, 1, 3, 55, 25000, $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO industrial_parameters (habitation_id, has_organized_industry, has_unorganized_industry, industrial_activity_intensity, industrial_waste_tonnes_per_day, hazardous_share_pct, updated_by)
       VALUES ($1, false, true, 'low', 0.4, 3, $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO natural_resource_parameters (habitation_id, annual_rainfall_mm, water_bodies_count, forest_cover_pct, sensitive_area_nearby, updated_by)
       VALUES ($1, 3200, 2, 35, true, $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO terrain_parameters (habitation_id, slope, soil_type, wind_condition, accessibility, flood_prone, updated_by)
       VALUES ($1, 'moderate', 'impermeable', 'moderate', 'moderate', true, $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO economic_parameters (habitation_id, per_capita_income_annual, annual_budget_inr, willingness_to_pay_pct, cost_constraint_level, updated_by)
       VALUES ($1, 118000, 3655000, 46, 'medium', $2)`,
      [habitationId, planner.id]
    );
    await query(
      `INSERT INTO cultural_parameters (habitation_id, diet_type, segregation_adherence_pct, festival_spike_pct, local_practice_notes, updated_by)
       VALUES ($1, 'mixed', 34, 22, 'Seasonal fish-market waste and temple-festival organic surges are common.', $2)`,
      [habitationId, planner.id]
    );
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  // eslint-disable-next-line no-console
  console.log("Demo accounts (password for all: 'Password123!'):");
  // eslint-disable-next-line no-console
  console.log("  admin@swms.dev / planner@swms.dev / researcher@swms.dev");
  // eslint-disable-next-line no-console
  console.log(`Demo habitation id: ${habitationId}`);

  await pool.end();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
