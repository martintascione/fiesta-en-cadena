ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS referrer_name text;

COMMENT ON COLUMN public.guests.referrer_name IS 'Nombre del anfitrión por quien fue invitado (carga desde admin/planilla)';