# SWMS Backend — Habitat Cycle

The Evaluation-1 backend for the Smart Waste Management Simulator: identity &
role-based access, habitation profiles across 7 parameter categories (with
full edit history), GIS map-layer storage/serving, and dataset
validation/normalization. Implements exactly the architecture in
`SWMS_Backend_Design_Document.docx` — same tables, same endpoints, same
business rules (BR-01..BR-08).

This is real, running code — not a mock. It was built, compiled, migrated
against a live PostgreSQL+PostGIS database, exercised through 20 manual
end-to-end smoke tests, and covered by an 11-test automated Jest/Supertest
suite, all of which pass.

## Stack

- **Runtime:** Node.js 20+, TypeScript, Express
- **Database:** PostgreSQL 15+ with the PostGIS extension
- **Queue:** Redis + BullMQ (background workers for GIS normalization and dataset validation)
- **Auth:** JWT (access + refresh), bcrypt password hashing
- **File storage:** local disk by default, behind a `StorageAdapter` interface — swap in S3 by implementing the same interface and setting `STORAGE_DRIVER=s3`
- **Tests:** Jest + Supertest, against a real database (no mocking of the DB layer)

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 15+ with PostGIS available (`CREATE EXTENSION postgis;`)
- Redis 6+

On Ubuntu/Debian, the fastest path:
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis redis-server
sudo service postgresql start
sudo service redis-server start
```

## 2. Setup

```bash
cd swms-backend
npm install

# Create the database and enable PostGIS
sudo -u postgres createdb swms
sudo -u postgres psql -d swms -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Configure environment
cp .env.example .env
# edit .env if your Postgres/Redis aren't on the defaults (localhost, postgres/postgres)

# Apply the schema
npm run migrate

# Load demo accounts + a fully-parameterized demo habitation
npm run seed
```

The seed script prints three demo logins (all use password `Password123!`):
```
admin@swms.dev       (Municipal Admin)
planner@swms.dev     (Planner — owns the demo habitation)
researcher@swms.dev  (Researcher — read-only)
```

## 3. Run

Two processes run independently, matching the architecture diagram (Section 2
of the design doc) — the API never blocks on GIS/dataset processing:

```bash
# Terminal 1 — the API server
npm run dev            # ts-node-dev, auto-reload
# or: npm run build && npm start

# Terminal 2 — the background worker (GIS normalization + dataset validation)
npm run dev:worker
# or: npm run build && npm run start:worker
```

The API listens on `http://localhost:4000` (`PORT` in `.env`). Check it's up:
```bash
curl http://localhost:4000/health
```

## 4. Try it

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"planner@swms.dev","password":"Password123!"}'
# -> copy the accessToken from the response

# List habitations
curl http://localhost:4000/api/habitations -H "Authorization: Bearer <accessToken>"

# Set a parameter category (writes a change-log entry automatically)
curl -X PUT http://localhost:4000/api/habitations/<habitationId>/parameters/demography \
  -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"population":5000,"populationDensityPerSqKm":1200,"growthRatePct":2.1}'

# Upload a GIS layer (processed asynchronously by the worker)
curl -X POST http://localhost:4000/api/habitations/<habitationId>/map-layers \
  -H "Authorization: Bearer <accessToken>" \
  -F "layerType=road" -F "file=@roads.geojson"
```

`smoke_test.sh` in this folder runs 20 such calls end-to-end (login, RBAC
rejections, parameter history, GIS upload → ready, CSV upload with planted
errors → partially_validated, duplicate detection, refresh tokens). Run it
against a running server with `bash smoke_test.sh`.

## 5. Automated tests

```bash
# One-time: create a separate database so tests never touch your dev data
sudo -u postgres createdb swms_test
sudo -u postgres psql -d swms_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/swms_test" npm run build && \
  DATABASE_URL="postgres://postgres:postgres@localhost:5432/swms_test" node dist/db/migrate.js

npm test
```

The suite (`tests/*.test.ts`) covers T-01 through T-10 from the design
document's Testing Strategy — auth, RBAC, parameter validation and
ownership, real GIS worker processing (success and failure paths), and real
dataset validation (partial-validation and duplicate detection) — by
actually starting the background workers inside the test run and polling
for completion, not by mocking the queue.

## 6. Project structure

```
src/
  app.ts, server.ts, worker.ts   Express app, API entry point, worker entry point
  config/                         env, PostgreSQL pool, Redis connection
  middleware/                     auth (JWT), rbac, validate (zod), errorHandler, rateLimit, upload (multer)
  utils/                          ApiError, jwt, password, storage adapter, asyncHandler
  db/
    schema.sql                    Full schema — matches Section 4 of the design doc exactly
    migrate.ts, seed.ts
  modules/
    auth/                         register, login, refresh (Workflow 1)
    habitations/                  CRUD + ownership rules (BR-01, BR-02)
    parameters/                   7-category config-driven CRUD + change log (Workflow 2, BR-03)
    mapLayers/                    GIS upload, list/overlay, delete (Workflow 3, BR-04)
    uploads/                      dataset upload, status, issues (Workflow 4, BR-05/06/07)
  workers/
    queues.ts                     BullMQ queue definitions
    gis.worker.ts                 GIS normalization (BG-02)
    validation.worker.ts          Dataset validation (BG-01) — reuses the parameter zod schemas
tests/                            Jest + Supertest, one file per module
smoke_test.sh                     20-step manual end-to-end script
```

## 7. Known scope limits (stated honestly, not hidden)

- **Local disk storage by default.** The `StorageAdapter` interface (`src/utils/storage.ts`)
  is what a real S3 adapter would implement; only the local-disk implementation
  is included here, to keep the reference build runnable with zero cloud
  credentials.
- **Shapefile support is real but basic.** `.shp`/`.zip` uploads are parsed with
  the pure-JS `shapefile` package (no GDAL). It handles standard shapefiles;
  exotic projections or malformed files fall back to a "failed" layer status
  with a message, same as any other parse failure.
- **Refresh-token revocation is stateless.** Tokens are rotated on every
  refresh, but there's no deny-list for a token revoked before its natural
  expiry — the design doc's AD-04 names this trade-off explicitly; a
  production deployment would back it with the same Redis instance already
  used for the job queue.
- **Rate limiting is in-memory**, not Redis-backed — correct for a single
  instance, and documented in `src/middleware/rateLimit.ts` as the first
  thing to change for a multi-instance deployment.
