# SWMS Demonstration Flow

## 1. Start services

- PostgreSQL with PostGIS
- Redis
- API: `npm run dev:api`
- Worker: `npm run dev:worker`
- Frontend: `npm run dev`

## 2. Seed development data

Run the migration and seed scripts from the README. The seed creates one demo municipality, five habitation records, seven parameter categories, vehicles and treatment/disposal facilities.

## 3. CSV validation

Use `demo-data/csv/demography-validation-demo.csv` through Data Upload. It intentionally contains invalid population and density values so the real worker produces row-level validation issues.

## 4. GIS

Upload the three GeoJSON files under `demo-data/gis/` to the selected habitation. Wait for the GIS worker to mark the layers `ready`. The map then renders the processed geometries.

## 5. Simulation

Select a ward, open Waste Simulation, and use the interactive controls or Run Simulation in Scenarios. The frontend calls `GET /api/habitations/:habitationId/simulation` and displays the server result.

Select a ward, open Waste Simulation, and use the interactive controls or Run Simulation in Scenarios. The frontend calls `GET /api/habitations/:habitationId/simulation` and displays the returned server result.

## 6. Resilience, sensitivity and budget

Run Flood, Road Blockage, Heavy Monsoon or Normal scenarios. Sensitivity and Budget pages call their server endpoints using the selected ward's stored parameters.

## 7. Chatbot

Ask a suggested or custom question in Ask SWMS. The question is sent to the selected habitation's server simulation endpoint.
