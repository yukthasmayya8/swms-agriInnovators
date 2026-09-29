# Smart Waste Management Simulator (SWMS)

SWMS is a React/Vite and Express/PostgreSQL/PostGIS application for municipal solid-waste planning. It stores habitation data and seven parameter categories, validates CSV/XLSX imports, processes GIS layers, runs server-side forecasts and stress scenarios, and exposes planning, reporting, and assistant workflows through one authenticated API.

## Features

- Municipality-scoped habitation and ward management.
- Seven editable parameter categories with database-backed forms and baseline rows created for every new habitation:
	demography, infrastructure, industrial activity, natural resources, terrain, economic conditions, and cultural significance.
- CSV/XLSX templates with schema-compatible headers, authenticated download, asynchronous validation, detailed row-level issues, correction notes, and insertion/upsert of valid parameter rows.
- PostGIS GIS layer upload and processing with stored layer status and map overlays.
- Twenty-year server simulation plus twenty historical reconstruction rows, a current base year, and twenty future projection rows.
- Flood, heavy-monsoon, and road-blockage stress scenarios.
- Server-backed sensitivity analysis and budget estimates.
- Simulation-aware Ask SWMS assistant with selectable questions.
- CSV simulation report download.
- Password reset tokens, admin activation, password reset, and live account-status refresh.
- Municipality isolation enforced in the API, not only in the browser.

## Requirements

- Node.js 20 or newer
- PostgreSQL with PostGIS
- Redis

Create a `.env` file with at least:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/swms
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-a-long-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-secret
PORT=4000
```

## Install and initialize

```bash
npm install
npm run migrate
npm run seed
```

The seed command creates deterministic development users, municipalities, wards, parameter records, and GIS/upload examples. Seed passwords are intended only for local development.

## Run locally

Run each process in its own terminal:

```bash
npm run dev:api
npm run dev:worker
npm run dev
```

The API runs on `http://localhost:4000`; Vite prints the frontend URL, normally `http://localhost:5173`.

The API starts validation and GIS workers when launched through `src/server.ts`. Running `dev:worker` separately is still supported for local development and queue isolation.

## Production checks

```bash
npm run build:api
npm run build
npm test -- --runInBand
```

The integration tests use `TEST_DATABASE_URL` when provided; otherwise they use a `swms_test` database derived from `DATABASE_URL`. Apply `npm run migrate` to the database used by the tests before running them.

## Main API flows

All protected routes require `Authorization: Bearer <access-token>`.

| Flow | Endpoint |
|---|---|
| Login / refresh | `POST /api/auth/login`, `POST /api/auth/refresh` |
| Password reset | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Current account | `GET /api/auth/me` |
| Habitations | `GET/POST /api/habitations`, `GET/PATCH/DELETE /api/habitations/:id` |
| Parameters | `GET/PUT /api/habitations/:id/parameters/:category` |
| Simulation | `GET /api/habitations/:id/simulation` |
| Stress scenarios | `?scenario=normal`, `flood`, `heavy_monsoon`, or `road_blockage` |
| Sensitivity | `GET /api/habitations/:id/simulation/sensitivity` |
| Budget | `GET /api/habitations/:id/simulation/budget` |
| Assistant | `POST /api/habitations/:id/simulation/ask` |
| Uploads | `GET /api/uploads`, `POST /api/uploads`, `GET /api/uploads/:id/issues` |
| Validation correction | `PATCH /api/uploads/:batchId/issues/:issueId` |
| GIS layers | `POST/GET /api/habitations/:id/map-layers` |
| Admin users | `GET/POST /api/users`, `PATCH /api/users/:id` |

## CSV import workflow

1. Select a ward and category in Data Upload.
2. Download the authenticated category template.
3. Keep the `habitation_id` column and replace `PASTE-WARD-UUID-HERE` with the selected ward UUID.
4. Edit the remaining fields using the exact headers in the template.
5. Upload the CSV/XLSX file.
6. The validation worker records every issue and upserts valid rows into the matching parameter table.
7. Open Validation to inspect row details and record correction notes.

Rows in one upload must use the selected ward's UUID. This prevents an edited file from changing another ward accidentally.

## Algorithms and computer-science concepts

### Population projection

For year $t$, the engine uses compound growth:

$$P(t) = P(0)(1 + r)^t$$

where `r` is stored as a percentage and converted to a decimal in the engine. Historical population is reconstructed by applying the inverse growth factor.

### Waste generation

Residential waste is calculated from effective population, floating population, and a transparent per-capita benchmark. Industrial waste is added from the stored industrial parameter. The UI can send validated population, per-capita, and collection-vehicle overrides to the same server simulation endpoint.

### Scenario analysis

Stress scenarios apply explicit collection-disruption multipliers to the baseline coverage. The resulting year-by-year waste, collected, treated, disposal, and vehicle values are generated by the same deterministic simulation engine.

### Sensitivity analysis

The server reruns the simulation for controlled perturbations of population, growth, and industrial waste. It compares peak daily waste, total twenty-year waste, and landfill projection against the stored baseline.

### Route optimization

The reusable route utility uses a greedy nearest-neighbor TSP/VRP heuristic with Haversine distance, vehicle capacity checks, depot returns, distance, time, and utilization calculations. It is a practical heuristic rather than an exact optimal solver.

### Validation and asynchronous processing

CSV/XLSX rows are parsed, coerced into typed values, validated with Zod schemas, and processed through BullMQ/Redis workers. Database updates use transactions and PostgreSQL `ON CONFLICT` upserts so a valid import is repeatable without creating duplicate parameter rows.

### GIS

Uploaded GeoJSON/Shapefile geometries are converted to GeoJSON and stored in PostGIS with SRID 4326. The frontend renders stored geometry and layer status with Leaflet.

### Security and synchronization

JWT authentication, role-based access control, optimistic parameter versions, PostgreSQL transactions, municipality predicates, one-time expiring password-reset hashes, and live `/api/auth/me` refresh keep browser state and server state aligned.

## Data and production note

