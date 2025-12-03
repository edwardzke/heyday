-- Backfill missing plant_id references in plant_recommendations
-- This script finds existing recommendations with null plant_id and links them to plants table

-- Step 1: Update recommendations by matching scientific name (most accurate)
UPDATE plant_recommendations
SET plant_id = (
  SELECT p.id
  FROM plants p
  WHERE p.scientific_name IS NOT NULL
    AND plant_recommendations.recommended_location->>'plant_name' IS NOT NULL
    AND p.scientific_name ILIKE '%' || (plant_recommendations.recommended_location->>'plant_name') || '%'
  LIMIT 1
)
WHERE plant_id IS NULL
  AND recommended_location->>'plant_name' IS NOT NULL;

-- Step 2: Update remaining recommendations by matching common name
UPDATE plant_recommendations
SET plant_id = (
  SELECT p.id
  FROM plants p
  WHERE p.common_name IS NOT NULL
    AND plant_recommendations.recommended_location->>'plant_name' IS NOT NULL
    AND p.common_name ILIKE '%' || (plant_recommendations.recommended_location->>'plant_name') || '%'
  LIMIT 1
)
WHERE plant_id IS NULL
  AND recommended_location->>'plant_name' IS NOT NULL;

-- Step 3: Try reverse match - plant name contains the plant's scientific/common name
UPDATE plant_recommendations
SET plant_id = (
  SELECT p.id
  FROM plants p
  WHERE plant_recommendations.recommended_location->>'plant_name' IS NOT NULL
    AND (
      (plant_recommendations.recommended_location->>'plant_name') ILIKE '%' || p.scientific_name || '%'
      OR (plant_recommendations.recommended_location->>'plant_name') ILIKE '%' || p.common_name || '%'
    )
  LIMIT 1
)
WHERE plant_id IS NULL
  AND recommended_location->>'plant_name' IS NOT NULL;

-- Step 4: Report results
SELECT
  COUNT(*) FILTER (WHERE plant_id IS NOT NULL) as recommendations_with_plant_id,
  COUNT(*) FILTER (WHERE plant_id IS NULL) as recommendations_missing_plant_id,
  string_agg(DISTINCT recommended_location->>'plant_name', ', ') FILTER (WHERE plant_id IS NULL) as unmatched_plant_names
FROM plant_recommendations;
