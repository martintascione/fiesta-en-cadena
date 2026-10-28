ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS extra_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

UPDATE public.guests SET confirmed_at = created_at WHERE confirmed_at IS NULL AND added_by_admin = false;