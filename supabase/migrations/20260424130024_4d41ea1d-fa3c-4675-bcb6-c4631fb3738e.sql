ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en'
CHECK (preferred_language IN ('en', 'pt', 'es'));