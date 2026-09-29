# SWMS Algorithms and Models

## Waste generation

Baseline model: effective population × configurable per-capita waste generation, with floating population and industrial waste. Scenario multipliers change collection coverage rather than pretending to be a trained prediction model.

This is a transparent baseline. It is not presented as a trained ML model.

## Population projection

Year-to-year deterministic growth: `P(t) = P(0) × (1 + growth_rate)^t`. Historical values use the inverse growth factor.

## Route optimization

The reusable route utility uses a greedy nearest-neighbor TSP/VRP heuristic with Haversine distance, vehicle capacity checks, depot returns, route distance, estimated time, and utilization. This is a feasible heuristic, not a claim of global optimality.

## Scenario model

Rule-based scenario engine. Normal, flood, heavy-monsoon, and road-blockage scenarios apply explicit collection-disruption multipliers. The selected scenario is sent to the server and returned with the simulation result.

## Sensitivity

Population, growth, and industrial waste are perturbed and the complete simulation is rerun. Outputs are compared for peak waste, twenty-year waste, and landfill projection. Budget estimates use simulated current collection/treatment demand.

## Other concepts

- Zod schema validation and typed coercion for imported records.
- BullMQ/Redis queues for asynchronous validation and GIS processing.
- PostgreSQL transactions and `ON CONFLICT` upserts for repeatable imports.
- Optimistic locking through parameter `version` values.
- Haversine distance for geographic distance between coordinates.
