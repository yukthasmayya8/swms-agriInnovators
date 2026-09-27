require("dotenv").config();
const { Client } = require("pg");

async function verify() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const extension = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'");
        if (!extension.rowCount) throw new Error("PostGIS is not installed in the configured database");
        const version = await client.query("SELECT postgis_full_version() AS version");
        const geometry = await client.query("SELECT udt_name, udt_schema FROM information_schema.columns WHERE table_name = 'map_layers' AND column_name = 'geometry'");
        if (!geometry.rowCount || geometry.rows[0].udt_name !== "geometry") throw new Error("map_layers.geometry is not a PostGIS geometry column");
        const spatialRows = await client.query("SELECT count(*)::int AS count FROM map_layers WHERE geometry IS NOT NULL AND ST_SRID(geometry) = 4326");
        console.log(`PostGIS ${extension.rows[0].extversion}`);
        console.log(version.rows[0].version);
        console.log(`map_layers.geometry: ${geometry.rows[0].udt_schema}.${geometry.rows[0].udt_name}`);
        console.log(`SRID 4326 geometries: ${spatialRows.rows[0].count}`);
    } finally {
        await client.end();
    }
}

verify().catch((error) => {
    console.error(`PostGIS verification failed: ${error.message}`);
    process.exitCode = 1;
});
