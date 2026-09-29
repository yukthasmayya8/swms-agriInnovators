# How the SWMS System Works — Simple Explanation

## CSV upload

1. User chooses a category.
2. User can download the matching template.
3. User uploads CSV/XLSX.
4. Backend stores the file and checksum.
5. A BullMQ job is added to Redis.
6. Validation worker reads the file.
7. Headers are checked against the selected category schema and values are coerced to numbers/booleans where possible.
8. Row-level issues are stored in `validation_issues` and displayed in the Validation page.
9. Valid rows are transactionally upserted into the matching parameter table; invalid rows remain visible with correction notes.
10. Batch becomes `validated`, `partially_validated` or `failed`.

## GIS upload

1. User selects a layer type.
2. GeoJSON/compatible GIS data is uploaded.
3. A GIS job is queued.
4. Worker parses geometry and stores it as PostGIS geometry using EPSG:4326.
5. API returns processed GeoJSON.
6. Frontend renders actual stored geometry.

## Simulation

The simulator loads the selected habitation's seven parameter categories from PostgreSQL.

It then runs one year at a time for 20 years.

Population uses the configured growth rate. Waste uses a transparent per-capita baseline plus floating population, industrial waste, and scenario context. Collection coverage uses roads, segregation, and stored or overridden collection vehicles. Treatment and disposal are calculated in the deterministic engine, and the API returns the full year-by-year result plus summary.

## Routing

The reusable route utility uses a greedy nearest-neighbor TSP/VRP heuristic with Haversine distance. It respects vehicle capacity and depot returns, then reports route demand, distance, time, and utilization.

## Scenarios

A scenario is not a random frontend value. Flood, heavy monsoon, and road blockage apply named collection-disruption multipliers in the server engine. The Scenarios page has an explicit Run simulation action and displays the returned summary.

## Chatbot

The conversational endpoint calls the same simulation engine and reads the selected habitation's database inputs. Suggested questions are sent to the server; answers are not hardcoded demo numbers.

## Municipality security

Normal users are scoped to the municipality stored on their server-side user record. Frontend-supplied municipality IDs are not treated as authorization. Super administrators can operate across municipalities; ordinary users cannot.
