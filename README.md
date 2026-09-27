# SWMS Frontend

A responsive React/Vite frontend prototype for a Smart Waste Management Simulator.

## Included screens

- Dashboard
- Habitations
- Seven Parameters
- GIS Map
- Data Upload
- Validation
- Waste Simulation
- 20-Year Forecast
- Scenario Simulation
- Sensitivity Testing
- Budget & Optimization
- Reports
- Ask SWMS

## Important implementation note

The frontend is API-ready but currently uses clearly labelled demo data for simulation/forecast/optimization areas that are not supplied by the current backend API. Population projection uses:

Population(t) = Population(0) * (1 + growth_rate)^t

The demo waste calculation uses a visible per-capita assumption so the chart is not presented as an unexplained/fake backend result.

Replace the demo services/state with the actual simulation APIs when those endpoints are available.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```
