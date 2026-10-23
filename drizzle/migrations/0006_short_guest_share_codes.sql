ALTER TABLE public.guests ADD COLUMN share_code text;
ALTER TABLE public.guests ADD CONSTRAINT guests_share_code_unique UNIQUE (share_code);
ALTER TABLE public.guests ADD CONSTRAINT guests_share_code_four_digits CHECK (share_code ~ '^[0-9]{4}$');
CREATE FUNCTION public.assign_guest_share_code() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.share_code IS NULL THEN
    PERFORM pg_advisory_xact_lock(746218390);
    SELECT lpad(n::text, 4, '0') INTO NEW.share_code
    FROM generate_series(0, 9999) AS codes(n)
    WHERE NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.share_code = lpad(n::text, 4, '0') OR g.invite_code = lpad(n::text, 4, '0'))
    ORDER BY random() LIMIT 1;
    IF NEW.share_code IS NULL THEN
      RAISE EXCEPTION 'No hay códigos de invitación disponibles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_guest_share_code() FROM PUBLIC;
CREATE TRIGGER guests_assign_share_code BEFORE INSERT OR UPDATE OF share_code ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.assign_guest_share_code();
UPDATE public.guests SET share_code = NULL WHERE share_code IS NULL;
COMMENT ON COLUMN public.guests.share_code IS 'Unique four-digit guest sharing code; invite_code remains supported for previously shared links.';