export type CommunitySong = { id: string; title: string; artist: string; cover: string | null; requests: number };
type PublicSongRow = { spotify_id: string; title: string; artist: string; cover_url: string | null };

export function groupCommunitySongs(rows: PublicSongRow[]): CommunitySong[] {
  const songs = new Map<string, CommunitySong>();
  for (const row of rows) {
    const existing = songs.get(row.spotify_id);
    if (existing) existing.requests += 1;
    else songs.set(row.spotify_id, { id: row.spotify_id, title: row.title, artist: row.artist, cover: row.cover_url, requests: 1 });
  }
  return [...songs.values()];
}