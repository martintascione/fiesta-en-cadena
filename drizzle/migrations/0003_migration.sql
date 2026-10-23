CREATE TABLE public.song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  spotify_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, spotify_id)
);
GRANT ALL ON public.song_requests TO service_role;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
