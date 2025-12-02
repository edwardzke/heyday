-- Add user preference columns for recommendation engine
-- These fields are used by backend/recommendationEngine/floorPlanRecs.py

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS plant_experience TEXT DEFAULT 'beginner'
  CHECK (plant_experience IN ('beginner', 'intermediate', 'expert')),
ADD COLUMN IF NOT EXISTS style_preference TEXT DEFAULT 'modern',
ADD COLUMN IF NOT EXISTS toxicity_sensitivity TEXT DEFAULT 'pet_safe',
ADD COLUMN IF NOT EXISTS maintenance_level TEXT DEFAULT 'low'
  CHECK (maintenance_level IN ('low', 'medium', 'high'));

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location);

-- Add comments for documentation
COMMENT ON COLUMN public.users.location IS 'User location for climate-aware plant recommendations (e.g., "San Francisco, CA")';
COMMENT ON COLUMN public.users.plant_experience IS 'User gardening experience level: beginner, intermediate, or expert';
COMMENT ON COLUMN public.users.style_preference IS 'User aesthetic preference for plant recommendations (e.g., modern, tropical, minimalist)';
COMMENT ON COLUMN public.users.toxicity_sensitivity IS 'Safety requirements (e.g., pet_safe, kid_safe, no_restrictions)';
COMMENT ON COLUMN public.users.maintenance_level IS 'Desired plant maintenance level: low, medium, or high';
