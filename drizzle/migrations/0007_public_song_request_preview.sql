GRANT SELECT (spotify_id, title, artist, cover_url, created_at) ON public.song_requests TO anon;
GRANT ALL ON public.song_requests TO service_role;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public song metadata only" ON public.song_requests FOR SELECT TO anon USING (true);