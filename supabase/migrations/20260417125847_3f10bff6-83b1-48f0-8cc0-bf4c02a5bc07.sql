-- Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'church_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'member';