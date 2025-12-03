-- Diagnostic query to see what data exists in plant_recommendations
-- Run this FIRST to understand what we're working with

-- Check structure of recommended_location JSONB
SELECT
  id,
  plant_id,
  recommended_location,
  jsonb_object_keys(recommended_location) as jsonb_keys,
  status,
  created_at
FROM plant_recommendations
WHERE plant_id IS NULL
LIMIT 5;

-- See all unique keys in recommended_location
SELECT DISTINCT jsonb_object_keys(recommended_location) as available_fields
FROM plant_recommendations;

-- Count how many recommendations have plant_id vs don't
SELECT
  COUNT(*) FILTER (WHERE plant_id IS NOT NULL) as with_plant_id,
  COUNT(*) FILTER (WHERE plant_id IS NULL) as without_plant_id
FROM plant_recommendations;

-- Sample the actual data structure
SELECT
  id,
  plant_id,
  recommended_location::text as location_json
FROM plant_recommendations
LIMIT 10;
