CREATE TABLE IF NOT EXISTS public.site_copy (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.site_copy TO service_role;
ALTER TABLE public.site_copy ENABLE ROW LEVEL SECURITY;