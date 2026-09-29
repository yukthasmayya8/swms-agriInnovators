# SWMS Requirement Traceability

| Official requirement | Implementation | Test/evidence | Status |
|---|---|---|---|
| Human habitation data | `habitations` + parameter tables | API tests / seed | Implemented |
| GIS/map representation | PostGIS `map_layers`, GIS worker, frontend geometry renderer | GIS upload/overlay integration tests | Implemented |
| Seven parameter categories | Seven parameter tables + templates | parameter tests | Implemented |
| Validation/integration | CSV/XLSX worker, row-level issues, correction notes, templates, parameter upserts | upload integration tests | Implemented |
| Waste simulation | `simulation/engine.ts` | simulation unit check | Implemented |
| 20-year forecast | 20-year server-side year array | simulation result | Implemented |
| Collection planning | collection coverage + vehicle requirement | simulation output | Implemented |
| Treatment planning | treatment capacity + recovery | simulation output | Implemented |
| Disposal planning | residual/disposal + landfill projection | simulation output | Implemented |
| Extreme conditions | scenario engine | scenario endpoint/UI | Implemented |
| Natural calamity/unexpected events | flood, blockage, disruption, surge, landslide, calamity | scenario endpoint/UI | Implemented |
| Sensitivity | reruns with parameter perturbations | sensitivity endpoint/UI | Implemented |
| Visual reporting | dashboard, charts, tables | frontend build/parser | Implemented |
| Budgeting | CAPEX/OPEX model | simulation result | Implemented |
| Conversational interface | `/api/habitations/:id/simulation/ask` | frontend Ask SWMS | Implemented |
| Chatbot-simulator integration | chatbot reads same server simulation engine | API flow | Implemented |
| Municipality isolation | municipality predicates + role checks | auth and habitation API tests | Implemented |
| Admin access management | `/api/users/*`, roles, municipality assignment, password reset | auth integration tests | Implemented |
| Redis/background jobs | BullMQ validation/GIS queues + API worker startup | upload and GIS integration tests | Implemented |
