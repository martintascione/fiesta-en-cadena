import { useSuspenseQuery } from "@tanstack/react-query";
import { Music2, ArrowUpRight } from "lucide-react";
import { publicSongs } from "@/lib/community-songs.functions";

export const communitySongsOptions = {
  queryKey: ["community-songs"],
  queryFn: () => publicSongs(),
  refetchInterval: 20_000,
};

export function CommunityPlaylist() {
  const { data: songs } = useSuspenseQuery(communitySongsOptions);
  if (!songs.length) return null;
  return (
    <section className="community-playlist" aria-labelledby="community-title">
      <p className="community-kicker"><Music2 size={14} aria-hidden="true" /> La previa ya arrancó</p>
      <h2 id="community-title">Lo que están <em>pidiendo.</em></h2>
      <ul className="community-tracks">
        {songs.map((song, i) => (
          <li key={song.id}>
            <span className="community-number">{String(i + 1).padStart(2, "0")}</span>
            {song.cover ? <img src={song.cover} alt="" width={44} height={44} loading="lazy" /> : <span className="community-cover"><Music2 size={20} aria-hidden="true" /></span>}
            <div className="community-track-copy"><b>{song.title}</b><small>{song.artist}</small><span>{song.requests} {song.requests === 1 ? "pedido" : "pedidos"}</span></div>
            <a href={`https://open.spotify.com/track/${encodeURIComponent(song.id)}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${song.title} en Spotify`} title="Abrir en Spotify"><ArrowUpRight size={18} aria-hidden="true" /></a>
          </li>
        ))}
      </ul>
    </section>
  );
}