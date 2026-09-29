# Algorithm Traceability

| Problem | Algorithm/model | Input | Output | Code |
|---|---|---|---|---|
| Population forecast | Deterministic compound growth | population, growth rate | yearly population | `src/modules/simulation/engine.ts` |
| Waste generation | Population × per-capita baseline + configurable context factors | demographic/industrial/cultural inputs | daily waste | `src/modules/simulation/engine.ts` |
| Route construction | Greedy nearest-neighbor TSP/VRP heuristic | collection points, coordinates, vehicle capacity | feasible depot route with distance/time/utilization | `src/utils/algorithms.ts` |
| Treatment | Capacity-constrained allocation baseline | collected waste, treatment capacity | treated/recovered waste | `src/modules/simulation/engine.ts` |
| Disposal | Residual balance + landfill accounting | collected, recovered, landfill capacity | disposal and remaining capacity | `src/modules/simulation/engine.ts` |
| Scenario simulation | Explicit rule-based perturbation | scenario + base inputs | scenario result | `src/modules/simulation/engine.ts` |
| Sensitivity analysis | Parameter perturbation + full rerun | selected changes | comparative metrics | `src/modules/simulation/engine.ts` |
