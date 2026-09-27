require("dotenv").config();
const { Client } = require("pg");

const tables = [
    "data_sources", "users", "habitations", "demography_parameters", "infrastructure_parameters",
    "industrial_parameters", "natural_resource_parameters", "terrain_parameters",
    "economic_parameters", "cultural_parameters", "parameter_change_log",
    "map_layers", "upload_batches", "validation_issues"
];

async function verify() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        for (const table of tables) {
            const result = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
            const count = result.rows[0].count;
            console.log(`${table}: ${count}`);
            if (count !== 5) throw new Error(`${table} has ${count} records; expected 5`);
        }
        const invalidIds = await client.query(`
      SELECT id FROM users
      WHERE id NOT IN (
        '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
        '10000000-0000-4000-8000-000000000005'
      )
    `);
        if (invalidIds.rowCount) throw new Error("Found non-deterministic user IDs");
        console.log("Seed verification passed: every domain table has exactly five deterministic records.");
    } finally {
        await client.end();
    }
}

verify().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
