REVOKE ALL ON public.song_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (spotify_id, title, artist, cover_url, created_at) ON public.song_requests TO anon;
GRANT ALL ON public.song_requests TO service_role;