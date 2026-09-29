# Research and Technical Sources

These sources informed the implementation decisions; they are not presented as local municipal measurements unless the application explicitly stores them as source data.

1. World Bank, *What a Waste 2.0: A Global Snapshot of Solid Waste Management to 2050* — integrated solid waste management, collection, treatment, disposal and cost context.
   https://documents1.worldbank.org/curated/en/697271544470229584/pdf/What-a-Waste-2-0-A-Global-Snapshot-of-Solid-Waste-Management-to-2050.pdf
2. PostGIS documentation — `ST_GeomFromGeoJSON` for converting GeoJSON geometry into PostGIS geometry and `ST_AsGeoJSON` for serving geometry back to web clients.
   https://postgis.net/docs/ST_GeomFromGeoJSON.html
   https://postgis.net/docs/manual-dev/en/ST_AsGeoJSON.html
3. PostGIS spatial-index documentation — GiST spatial indexes and index-aware spatial predicates for scalable spatial queries.
   https://postgis.net/documentation/faq/spatial-indexes/
4. BullMQ documentation — queues, Redis connections, workers and retry/backoff behaviour.
   https://docs.bullmq.io/guide/queues/
   https://docs.bullmq.io/guide/workers/
   https://docs.bullmq.io/guide/jobs/retrying-failing-jobs
5. OpenStreetMap tile usage policy — relevant if a production basemap is added; attribution, caching and usage limits must be respected.
   https://operations.osmfoundation.org/policies/tiles/

Implementation principle: advanced ML is not forced into the system. The baseline simulator is deterministic and configurable; ML/time-series models can be added when sufficient historical data is available and validated.
