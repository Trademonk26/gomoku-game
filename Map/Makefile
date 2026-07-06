PY := .venv/bin/python

.PHONY: all boundaries osm cdd dataset test web-data web-build

all: boundaries osm cdd dataset test web-data

boundaries:
	$(PY) pipeline/sources/fetch_boundaries.py

osm:
	$(PY) pipeline/sources/fetch_osm_power.py

cdd:
	$(PY) pipeline/sources/fetch_cdd.py

dataset:
	$(PY) pipeline/indicators/build_dataset.py

test:
	$(PY) -m pytest pipeline/tests -q
	cd web && npx vitest run

web-data:
	mkdir -p web/public/data
	cp outputs/web/regions.geojson outputs/web/sido.geojson outputs/web/dataset.json web/public/data/
	cp outputs/fixtures/scoring_fixture.json web/src/lib/scoring.fixture.json

web-build: web-data
	cd web && npm run build
