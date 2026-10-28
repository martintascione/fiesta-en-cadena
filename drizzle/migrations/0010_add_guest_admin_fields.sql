ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS manual_bar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hosts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extras integer NOT NULL DEFAULT 0 CHECK (extras >= 0 AND extras <= 20);