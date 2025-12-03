-- Migration: Add unique constraint to prevent duplicate plant recommendations
-- Created: 2025-12-02
-- Purpose: Ensure a user can't have duplicate recommendations for the same plant in the same floorplan

-- Step 1: Clean up any existing duplicates (optional, uncomment if needed)
-- This will keep only the oldest recommendation for each (user_id, plant_id, floorplan_id) combination
/*
DELETE FROM public.plant_recommendations a
USING public.plant_recommendations b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.plant_id = b.plant_id
  AND a.floorplan_id = b.floorplan_id;
*/

-- Step 2: Add unique constraint
ALTER TABLE public.plant_recommendations
ADD CONSTRAINT unique_user_plant_floorplan
UNIQUE (user_id, plant_id, floorplan_id);

-- Verification
-- You can verify the constraint was added by running:
-- SELECT conname, contype, conkey FROM pg_constraint WHERE conrelid = 'public.plant_recommendations'::regclass;
