require("dotenv").config();
const { Client } = require("pg");

const client = new Client({ connectionString: process.env.DATABASE_URL });
const habitationFilter = `
  h.owner_id IN (SELECT id FROM users WHERE email LIKE '%@test.dev')
  OR h.name IN ('Shirva Village (Demo)', 'Smoke Test Ward')
`;

async function clean() {
    await client.connect();
    await client.query("BEGIN");
    try {
        await client.query(`
      DELETE FROM map_layers
      WHERE habitation_id IN (SELECT h.id FROM habitations h WHERE ${habitationFilter})
    `);
        const result = await client.query(`DELETE FROM habitations h WHERE ${habitationFilter}`);
        await client.query("DELETE FROM users WHERE email LIKE '%@test.dev'");
        await client.query("COMMIT");
        console.log(`Removed ${result.rowCount} test/demo habitations.`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

clean().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
