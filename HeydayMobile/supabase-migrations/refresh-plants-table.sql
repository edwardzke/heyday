-- Refresh Plants Table - Clear out old/invalid data
-- This script removes all existing plants so they can be re-fetched from Perenual API with correct image URLs

-- OPTION 1: Delete ALL plants (forces complete re-fetch on next scan)
-- WARNING: This will also orphan any plant_recommendations that reference these plants
-- Uncomment the line below to use this option:
-- DELETE FROM plants;

-- OPTION 2: Delete only plants with missing or placeholder image URLs (RECOMMENDED)
DELETE FROM plants
WHERE default_image_url IS NULL
   OR default_image_url = ''
   OR default_image_url LIKE '%placeholder%'
   OR default_image_url LIKE '%example.com%';

-- OPTION 3: Just view plants with bad image URLs (diagnostic only)
-- Comment out the DELETE above and uncomment this to see what would be deleted:
-- SELECT
--   id,
--   common_name,
--   scientific_name,
--   default_image_url,
--   created_at
-- FROM plants
-- WHERE default_image_url IS NULL
--    OR default_image_url = ''
--    OR default_image_url LIKE '%placeholder%'
--    OR default_image_url LIKE '%example.com%';

-- Show summary of plants table after cleanup
SELECT
  COUNT(*) as total_plants,
  COUNT(*) FILTER (WHERE default_image_url IS NOT NULL AND default_image_url != '') as plants_with_images,
  COUNT(*) FILTER (WHERE default_image_url IS NULL OR default_image_url = '') as plants_without_images
FROM plants;

-- IMPORTANT NOTES:
-- 1. After running this script, existing plant_recommendations may have broken plant_id references
-- 2. You should either:
--    a) Delete old recommendations: DELETE FROM plant_recommendations WHERE plant_id NOT IN (SELECT id FROM plants);
--    b) Set plant_id to NULL: UPDATE plant_recommendations SET plant_id = NULL WHERE plant_id NOT IN (SELECT id FROM plants);
--    c) Do a fresh room scan which will re-create plants and recommendations with proper data
