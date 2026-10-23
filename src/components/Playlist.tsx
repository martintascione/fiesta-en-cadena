import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchSongs, addSongs, removeSong, mySongs, type Song } from "@/lib/guests.functions";

const MAX = 5;
const PENDING_KEY = "tricumple-pending-songs";

export function readPending(): Song[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}
function writePending(s: Song[]) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** qrToken presente → guarda en la base. Sin qrToken → guarda localmente hasta que el invitado se anote. */
export function Playlist({ qrToken, variant = "poster" }: { qrToken?: string; variant?: "poster" | "ticket" }) {
  const search = useServerFn(searchSongs);
  const add = useServerFn(addSongs);
  const remove = useServerFn(removeSong);
  const mine = useServerFn(mySongs);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [picked, setPicked] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (qrToken) {
      const pending = readPending();
      (async () => {
        if (pending.length) { await add({ data: { qrToken, songs: pending.slice(0, MAX).map(({ id, title, artist, cover }) => ({ id, title, artist, cover })) } }); writePending([]); }
        setPicked(await mine({ data: { qrToken } }));
      })();
    } else setPicked(readPending());
  }, [qrToken]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await search({ data: { q } })); } catch { setResults([]); setMsg("No pudimos buscar en Spotify ahora"); }
      setBusy(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function pick(s: Song) {
    setMsg("");
    if (picked.some((p) => p.id === s.id)) return;
    if (picked.length >= MAX) return setMsg(`Máximo ${MAX} temas por persona`);
    const next = [...picked, s];
    setPicked(next); setQ(""); setResults([]);
    if (qrToken) {
      const r = await add({ data: { qrToken, songs: [{ id: s.id, title: s.title, artist: s.artist, cover: s.cover }] } });
      if (!r.ok) { setPicked(picked); setMsg(r.reason === "max" ? `Máximo ${MAX} temas por persona` : "No se pudo guardar"); }
    } else writePending(next);
  }

  async function drop(s: Song) {
    const next = picked.filter((p) => p.id !== s.id);
    setPicked(next);
    if (qrToken) await remove({ data: { qrToken, spotifyId: s.id } }); else writePending(next);
  }

  return (
    <section className={`playlist playlist-${variant}`}>
      <p className="playlist-kicker">DJ en vivo · pedí tu tema</p>
      <h2 className="playlist-title">Sé parte de la <em>playlist</em> de la fiesta.</h2>
      <p className="playlist-sub">El DJ hace sonar el tema que pediste vos.</p>
      <div className="playlist-search">
        <svg viewBox="0 0 24 24" aria-hidden><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.4-2.1-10.6-1.2a.75.75 0 1 1-.3-1.5c4.6-1 8.5-.6 11.7 1.4.3.2.4.7.2 1.05Zm1.5-3.3a.94.94 0 0 1-1.3.3c-3.2-2-8.2-2.6-12-1.4a.94.94 0 1 1-.55-1.8c4.4-1.3 9.8-.7 13.5 1.6.4.3.6.9.35 1.3Zm.1-3.4C15.3 8.3 9 8.1 5.3 9.2a1.12 1.12 0 1 1-.65-2.15c4.3-1.3 11.3-1 15.7 1.6a1.12 1.12 0 0 1-1.15 1.95Z" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá un tema o artista" aria-label="Buscar en Spotify" />
        {busy && <span className="playlist-busy" />}
      </div>
      {results.length > 0 && (
        <ul className="playlist-results">
          {results.map((s) => (
            <li key={s.id}><button type="button" onClick={() => pick(s)}>
              {s.cover ? <img src={s.cover} alt="" width={40} height={40} /> : <span className="playlist-noimg" />}
              <span><b>{s.title}</b><small>{s.artist}</small></span>
              <i>+</i>
            </button></li>
          ))}
        </ul>
      )}
      {msg && <p className="playlist-msg">{msg}</p>}
      {picked.length > 0 && (
        <ul className="playlist-picked">
          {picked.map((s, i) => (
            <li key={s.id}>
              <span className="playlist-n">{i + 1}</span>
              {s.cover ? <img src={s.cover} alt="" width={40} height={40} /> : <span className="playlist-noimg" />}
              <span><b>{s.title}</b><small>{s.artist}</small></span>
              <button type="button" aria-label="Sacar" onClick={() => drop(s)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {!qrToken && picked.length > 0 && <p className="playlist-note">Se guardan cuando confirmes tu lugar arriba.</p>}
    </section>
  );
}
