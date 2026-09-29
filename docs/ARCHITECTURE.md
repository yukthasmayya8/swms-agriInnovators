# SWMS Architecture

Frontend (React/Vite)
→ Express API
→ JWT authentication + RBAC + municipality isolation
→ PostgreSQL/PostGIS
→ Redis/BullMQ for asynchronous validation/GIS jobs
→ validation/GIS workers
→ simulation engine
→ visualization and conversational query APIs

The central domain flow is:

Data → Validation → GIS/Data Integration → Waste Generation → 20-Year Simulation → Collection → Treatment → Disposal → Scenario/Resilience → Sensitivity → Budget → Visualization → Conversational Decision Support.
