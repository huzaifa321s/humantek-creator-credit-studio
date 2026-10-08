-- Add full_name column to public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
