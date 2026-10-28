ALTER TABLE public.guests
  ADD COLUMN notes text,
  ADD COLUMN manual_bar boolean NOT NULL DEFAULT false,
  ADD COLUMN added_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN hosts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN extras integer NOT NULL DEFAULT 0 CHECK (extras >= 0 AND extras <= 20);
