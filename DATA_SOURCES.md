# Seed Data Sources

The database also stores the five references below in `data_sources`. This
keeps source metadata in PostgreSQL instead of leaving it only in README text.

The seeded profiles represent real places in Udupi district, Karnataka. They are intended as a realistic development baseline, not as a substitute for a government survey.

## Official reference sources

- Census of India 2011 tables: https://censusindia.gov.in/census.website/data/census-tables
- Census A-01 area, households and population table: https://censusindia.gov.in/nada/index.php/catalog/42526/download/46152/A-1_NO_OF_VILLAGES_TOWNS_HOUSEHOLDS_POPULATION_AND_AREA.xlsx
- Census A-04 Class III towns table: https://censusindia.gov.in/nada/index.php/catalog/42878/download/46544/CLASS_III.xlsx
- Central Pollution Control Board solid-waste-management resources: https://cpcb.gov.in/solid-waste-management/
- Karnataka Revenue Maps and survey-boundary guidance: https://landrecords.karnataka.gov.in/service3/Guidelines.html
- eMarg road map: https://emarg.gov.in/public/roadviewonmap.htm
- PIB HCES 2023-24: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2088390&reg=48&lang=2

## How the current seed should be interpreted

- Locality names and coordinates identify real Udupi-region locations.
- The only row-level value directly confirmed from the supplied pages is the
	Shirva Census 2011 record: population 13,396, 3,183 households, area
	3,216.13 hectares, and density 417/km2. The current five-profile seed is a
	planning baseline and must not be described as a direct Census extract.
- Population, density, literacy, and household values are baseline estimates informed by the Census tables, but are not imported row-for-row from an official table.
- Rainfall, terrain, flood exposure, and forest-cover values are regional planning estimates and should be replaced with IMD, Karnataka government, or GIS measurements for production use.
- Collection vehicles, collection-point coverage, landfill capacity, waste tonnage, budgets, and segregation rates are modeled planning inputs. They are not claims about current municipal performance.

For a production dataset, import the official source files into a staging table, retain the source URL and publication year with every record, and map each source geography to a habitation before publishing it through the API.
