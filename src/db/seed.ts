import { pool } from "../config/db";
import { hashPassword } from "../utils/password";

const PASSWORD = "Password123!";

const sources = [
    ["70000000-0000-4000-8000-000000000001", "Shirva Census 2011 village record", "Census of India / Karnataka Village Codes", "https://karnataka.villagecodes.in/udupi/udupi-56905523/shirva-05523608825/", 2011, "dataset", "Population 13,396, 3,183 households, 3,216.13 hectares and density 417/km2 are source facts for Shirva; the directory is secondary and points to Census/DCHB data."],
    ["70000000-0000-4000-8000-000000000002", "Karnataka Udupi open-data catalog", "Government of Karnataka", "https://karnataka.data.gov.in/search?title=udupi", 2011, "dataset", "Catalog of Udupi village/town amenities and Census-linked datasets. Use the downloadable resource/API for row-level imports."],
    ["70000000-0000-4000-8000-000000000003", "Karnataka revenue maps and survey boundaries", "Government of Karnataka Land Records", "https://landrecords.karnataka.gov.in/service3/Guidelines.html", null, "map", "Use the official KMZ downloads for village boundaries and survey features; do not invent coordinates from a place name."],
    ["70000000-0000-4000-8000-000000000004", "Know Your Road map", "eMarg / National Informatics Centre", "https://emarg.gov.in/public/roadviewonmap.htm", null, "map", "Use road registrations and inspection layers to populate road GIS layers; the public page is not a tabular Udupi waste dataset."],
    ["70000000-0000-4000-8000-000000000005", "Solid waste and household expenditure references", "CPCB, NITI Aayog and MoSPI", "https://cpcb.gov.in/uploads/MSW/MSW_AnnualReport_2021-22.pdf", 2022, "policy", "CPCB/NITI provide national policy and waste-management context; PIB HCES provides national MPCE benchmarks. Do not label them as Udupi municipal measurements."]
] as const;

const users = [
    ["10000000-0000-4000-8000-000000000001", "Asha Rao", "admin@swms.dev", "admin"],
    ["10000000-0000-4000-8000-000000000002", "Prakash Shetty", "planner@swms.dev", "planner"],
    ["10000000-0000-4000-8000-000000000003", "Meera Pai", "researcher@swms.dev", "researcher"],
    ["10000000-0000-4000-8000-000000000004", "Ravi Bhandari", "operations@swms.dev", "planner"],
    ["10000000-0000-4000-8000-000000000005", "Nisha Hegde", "analyst@swms.dev", "researcher"]
] as const;

const profiles = [
    { id: "20000000-0000-4000-8000-000000000001", name: "Udupi Central Ward", type: "ward", lat: 13.3409, lon: 74.7421, population: 28460, density: 5180, growth: 1.84, floating: 6.8, household: 3.7, literacy: 91.6, roads: [82, 146, 68, 3, 18, 11, 12, 88, 18400], industry: [false, true, "low", 1.8, 1.2], nature: [3940, 5, 12, true], terrain: ["flat", "impermeable", "moderate", "good", true], economy: [214000, 18200000, 68, "low"], culture: ["mixed", 61, 28, "Dense commercial-residential ward with daily market waste and monsoon drainage pressure."] },
    { id: "20000000-0000-4000-8000-000000000002", name: "Manipal University Area", type: "town", lat: 13.3526, lon: 74.7928, population: 22180, density: 3460, growth: 2.72, floating: 24.5, household: 2.9, literacy: 96.3, roads: [76, 118, 54, 6, 9, 17, 10, 73, 12600], industry: [true, true, "medium", 4.6, 8.5], nature: [3810, 3, 21, true], terrain: ["moderate", "permeable", "moderate", "good", false], economy: [286000, 14600000, 74, "low"], culture: ["mixed", 69, 19, "Student and hospital population creates high seasonal turnover and biomedical waste."] },
    { id: "20000000-0000-4000-8000-000000000003", name: "Kundapura Town", type: "town", lat: 13.6325, lon: 74.6904, population: 24690, density: 2840, growth: 1.31, floating: 9.7, household: 4.1, literacy: 84.8, roads: [64, 132, 59, 9, 14, 7, 8, 57, 22100], industry: [true, true, "medium", 6.3, 4.1], nature: [3650, 9, 29, true], terrain: ["flat", "permeable", "high", "moderate", true], economy: [176000, 11900000, 49, "medium"], culture: ["nonveg", 43, 34, "Coastal town with fish-market waste, tidal lowlands and seasonal monsoon flooding."] },
    { id: "20000000-0000-4000-8000-000000000004", name: "Karkala Town", type: "town", lat: 13.2143, lon: 74.9983, population: 23810, density: 1980, growth: 1.08, floating: 5.4, household: 4.3, literacy: 88.9, roads: [69, 124, 52, 7, 12, 6, 7, 64, 19700], industry: [false, true, "low", 2.7, 2.2], nature: [3490, 12, 38, true], terrain: ["hilly", "permeable", "moderate", "moderate", false], economy: [168000, 9800000, 52, "medium"], culture: ["mixed", 48, 31, "Hill-town settlements with arecanut trade, dispersed households and festival surges."] },
    { id: "20000000-0000-4000-8000-000000000005", name: "Brahmavar Town", type: "town", lat: 13.4386, lon: 74.7461, population: 17640, density: 2240, growth: 1.56, floating: 7.2, household: 4.0, literacy: 86.7, roads: [61, 98, 57, 5, 10, 5, 6, 59, 14300], industry: [false, true, "low", 2.1, 1.7], nature: [3890, 11, 26, true], terrain: ["flat", "impermeable", "high", "good", true], economy: [159000, 7600000, 47, "medium"], culture: ["mixed", 46, 27, "River-adjacent town with market waste, paddy-growing households and flood-sensitive lowlands."] }
] as const;

async function seed() {
    const passwordHash = await hashPassword(PASSWORD);
    const plannerId = users[1][0];
    await pool.query("BEGIN");
    try {
        await pool.query("TRUNCATE data_sources, validation_issues, upload_batches, map_layers, parameter_change_log, cultural_parameters, economic_parameters, terrain_parameters, natural_resource_parameters, industrial_parameters, infrastructure_parameters, demography_parameters, habitations, users CASCADE");
        for (const source of sources) {
            await pool.query("INSERT INTO data_sources (id,title,publisher,source_url,publication_year,source_type,usage_notes) VALUES ($1,$2,$3,$4,$5,$6,$7)", [...source]);
        }
        for (const [id, name, email, role] of users) {
            await pool.query("INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)", [id, name, email, passwordHash, role]);
        }
        for (const [index, p] of profiles.entries()) {
            const ordinal = String(index + 1).padStart(3, "0");
            const auditId = `30000000-0000-4000-8000-000000000${ordinal}`;
            const layerId = `40000000-0000-4000-8000-000000000${ordinal}`;
            const batchId = `50000000-0000-4000-8000-000000000${ordinal}`;
            const issueId = `60000000-0000-4000-8000-000000000${ordinal}`;
            await pool.query("INSERT INTO habitations (id, name, type, latitude, longitude, owner_id) VALUES ($1,$2,$3,$4,$5,$6)", [p.id, p.name, p.type, p.lat, p.lon, plannerId]);
            await pool.query("INSERT INTO demography_parameters (habitation_id,population,population_density_per_sq_km,growth_rate_pct,floating_pop_pct,household_size,literacy_pct,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [p.id, p.population, p.density, p.growth, p.floating, p.household, p.literacy, plannerId]);
            await pool.query("INSERT INTO infrastructure_parameters (habitation_id,road_coverage_pct,roads_alleys_count,residential_zone_pct,industrial_zone_pct,schools_count,clinics_count,collection_vehicles,collection_point_density_pct,existing_landfill_capacity_tonnes,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [p.id, ...p.roads, plannerId]);
            await pool.query("INSERT INTO industrial_parameters (habitation_id,has_organized_industry,has_unorganized_industry,industrial_activity_intensity,industrial_waste_tonnes_per_day,hazardous_share_pct,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [p.id, ...p.industry, plannerId]);
            await pool.query("INSERT INTO natural_resource_parameters (habitation_id,annual_rainfall_mm,water_bodies_count,forest_cover_pct,sensitive_area_nearby,updated_by) VALUES ($1,$2,$3,$4,$5,$6)", [p.id, ...p.nature, plannerId]);
            await pool.query("INSERT INTO terrain_parameters (habitation_id,slope,soil_type,wind_condition,accessibility,flood_prone,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [p.id, ...p.terrain, plannerId]);
            await pool.query("INSERT INTO economic_parameters (habitation_id,per_capita_income_annual,annual_budget_inr,willingness_to_pay_pct,cost_constraint_level,updated_by) VALUES ($1,$2,$3,$4,$5,$6)", [p.id, ...p.economy, plannerId]);
            await pool.query("INSERT INTO cultural_parameters (habitation_id,diet_type,segregation_adherence_pct,festival_spike_pct,local_practice_notes,updated_by) VALUES ($1,$2,$3,$4,$5,$6)", [p.id, ...p.culture, plannerId]);
            await pool.query("INSERT INTO parameter_change_log (id,habitation_id,category,field_name,old_value,new_value,changed_by) VALUES ($1,$2,'demography','population',NULL,$3,$4)", [auditId, p.id, String(p.population), plannerId]);
            await pool.query("INSERT INTO map_layers (id,habitation_id,layer_type,geometry,source_file_url,status,uploaded_by) VALUES ($1,$2,'settlement',ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,'ready',$5)", [layerId, p.id, JSON.stringify({ type: "Point", coordinates: [p.lon, p.lat] }), `local://seed/map-layers/${p.id}.geojson`, plannerId]);
            await pool.query("INSERT INTO upload_batches (id,habitation_id,category,original_filename,source_file_url,file_checksum,status,row_count,valid_row_count,uploaded_by) VALUES ($1,$2,'demography',$3,$4,$5,'validated',1,1,$6)", [batchId, p.id, `${p.name.toLowerCase().replace(/ /g, "-")}.csv`, `local://seed/uploads/${p.id}.csv`, `seed-checksum-${ordinal}`, plannerId]);
            await pool.query("INSERT INTO validation_issues (id,batch_id,row_number,field_name,issue_type,message) VALUES ($1,$2,1,'population','invalid_range',$3)", [issueId, batchId, `Seed validation example for ${p.name}; replace with source-import validation results.`]);
        }
        await pool.query("COMMIT");
        console.log("Seed complete: 5 deterministic records in every domain table.");
        console.log("Demo password for all five users: Password123!");
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
    } finally {
        await pool.end();
    }
}

seed().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
