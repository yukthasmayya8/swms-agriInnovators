#!/bin/bash
set -e
BASE="http://localhost:4000"
PASS="Password123!"

echo "== 1. Health check =="
curl -s $BASE/health; echo

echo ""
echo "== 2. Login as planner =="
PLANNER_LOGIN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"planner@swms.dev\",\"password\":\"$PASS\"}")
echo "$PLANNER_LOGIN"
PLANNER_TOKEN=$(echo "$PLANNER_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo ""
echo "== 3. Login as researcher =="
RESEARCHER_LOGIN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"researcher@swms.dev\",\"password\":\"$PASS\"}")
echo "$RESEARCHER_LOGIN"
RESEARCHER_TOKEN=$(echo "$RESEARCHER_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo ""
echo "== 4. Wrong password -> expect 401 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"planner@swms.dev\",\"password\":\"wrong\"}"

echo ""
echo "== 5. Planner creates a new habitation =="
CREATE_HAB=$(curl -s -X POST $BASE/api/habitations -H "Content-Type: application/json" -H "Authorization: Bearer $PLANNER_TOKEN" \
  -d '{"name":"Smoke Test Ward","type":"ward","latitude":13.35,"longitude":74.79}')
echo "$CREATE_HAB"
HAB_ID=$(echo "$CREATE_HAB" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Habitation ID: $HAB_ID"

echo ""
echo "== 6. Researcher tries to create a habitation -> expect 403 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST $BASE/api/habitations -H "Content-Type: application/json" -H "Authorization: Bearer $RESEARCHER_TOKEN" \
  -d '{"name":"Should Fail","type":"village","latitude":10,"longitude":76}'

echo ""
echo "== 7. Planner sets demography parameters =="
SET_DEMO=$(curl -s -X PUT $BASE/api/habitations/$HAB_ID/parameters/demography -H "Content-Type: application/json" -H "Authorization: Bearer $PLANNER_TOKEN" \
  -d '{"population":5000,"populationDensityPerSqKm":1200,"growthRatePct":2.5,"floatingPopPct":10,"householdSize":4.2,"literacyPct":81}')
echo "$SET_DEMO"

echo ""
echo "== 8. Update demography (change population) -> expect fieldsChanged =="
UPDATE_DEMO=$(curl -s -X PUT $BASE/api/habitations/$HAB_ID/parameters/demography -H "Content-Type: application/json" -H "Authorization: Bearer $PLANNER_TOKEN" \
  -d '{"population":5200,"populationDensityPerSqKm":1200,"growthRatePct":2.5,"floatingPopPct":10,"householdSize":4.2,"literacyPct":81}')
echo "$UPDATE_DEMO"

echo ""
echo "== 9. Parameter change history =="
curl -s $BASE/api/habitations/$HAB_ID/parameters/demography/history -H "Authorization: Bearer $PLANNER_TOKEN"; echo

echo ""
echo "== 10. Missing required field -> expect 400 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X PUT $BASE/api/habitations/$HAB_ID/parameters/demography -H "Content-Type: application/json" -H "Authorization: Bearer $PLANNER_TOKEN" \
  -d '{"growthRatePct":2.5}'

echo ""
echo "== 11. Researcher tries to edit parameters -> expect 403 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X PUT $BASE/api/habitations/$HAB_ID/parameters/demography -H "Content-Type: application/json" -H "Authorization: Bearer $RESEARCHER_TOKEN" \
  -d '{"population":9999,"populationDensityPerSqKm":1200}'

echo ""
echo "== 12. Upload a GeoJSON map layer =="
cat > /tmp/roads.geojson << 'EOF'
{"type":"FeatureCollection","features":[
  {"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[74.79,13.35],[74.80,13.36]]}},
  {"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[74.80,13.36],[74.81,13.37]]}}
]}
EOF
UPLOAD_LAYER=$(curl -s -X POST $BASE/api/habitations/$HAB_ID/map-layers -H "Authorization: Bearer $PLANNER_TOKEN" \
  -F "layerType=road" -F "file=@/tmp/roads.geojson")
echo "$UPLOAD_LAYER"

echo "   (waiting 2s for the background GIS worker to process it...)"
sleep 2
echo ""
echo "== 13. List map layers (should show status: ready) =="
curl -s "$BASE/api/habitations/$HAB_ID/map-layers" -H "Authorization: Bearer $PLANNER_TOKEN"; echo

echo ""
echo "== 14. Get overlay (combined GeoJSON) =="
curl -s "$BASE/api/habitations/$HAB_ID/map-layers?overlay=true" -H "Authorization: Bearer $PLANNER_TOKEN"; echo

echo ""
echo "== 15. Upload a dataset with intentional errors (CSV) =="
cat > /tmp/demography_bulk.csv << EOF
habitation_id,population,populationDensityPerSqKm,growthRatePct,floatingPopPct,householdSize,literacyPct
$HAB_ID,6100,1300,3,12,4.5,80
$HAB_ID,,1300,3,12,4.5,80
$HAB_ID,6100,1300,340,12,4.5,80
EOF
UPLOAD_BATCH=$(curl -s -X POST $BASE/api/uploads -H "Authorization: Bearer $PLANNER_TOKEN" \
  -F "habitationId=$HAB_ID" -F "category=demography" -F "file=@/tmp/demography_bulk.csv")
echo "$UPLOAD_BATCH"
BATCH_ID=$(echo "$UPLOAD_BATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "   (waiting 2s for the background validation worker...)"
sleep 2
echo ""
echo "== 16. Batch status (expect partially_validated) =="
curl -s "$BASE/api/uploads/$BATCH_ID" -H "Authorization: Bearer $PLANNER_TOKEN"; echo

echo ""
echo "== 17. Validation issues detail =="
curl -s "$BASE/api/uploads/$BATCH_ID/issues" -H "Authorization: Bearer $PLANNER_TOKEN"; echo

echo ""
echo "== 18. Re-upload identical file -> expect 409 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST $BASE/api/uploads -H "Authorization: Bearer $PLANNER_TOKEN" \
  -F "habitationId=$HAB_ID" -F "category=demography" -F "file=@/tmp/demography_bulk.csv"

echo ""
echo "== 19. Refresh token flow =="
REFRESH_TOKEN=$(echo "$PLANNER_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])")
curl -s -X POST $BASE/api/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"; echo

echo ""
echo "== 20. Unauthenticated request -> expect 401 =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" $BASE/api/habitations

echo ""
echo "ALL SMOKE TESTS COMPLETE"
