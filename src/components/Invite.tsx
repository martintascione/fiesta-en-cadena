import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { registerGuest, findGuest, type Discount } from "@/lib/guests.functions";
import boombox from "@/assets/glyph-boombox.png";
import { Wristband } from "@/components/Wristband";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { DEFAULT_COPY, type Copy } from "@/lib/copy";
import { Playlist } from "@/components/Playlist";
import { invitationLink } from "@/lib/invitation-links";
import { CommunityPlaylist } from "@/components/CommunityPlaylist";

function Splat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="currentColor">
      <path d="M52 2 L56 30 L70 10 L64 34 L92 16 L70 42 L98 48 L70 54 L90 78 L62 62 L66 96 L52 66 L40 92 L40 64 L12 84 L32 58 L2 56 L30 46 L8 26 L36 36 L28 8 L44 30 Z" />
    </svg>
  );
}

type Guest = { fullName: string; email: string; inviteCode: string; qrToken: string; hasReceipt: boolean; discount: Discount };

const NAMES = [
  { name: "Giu", accent: "border-sky bg-sky/10 text-sky" },
  { name: "Manuch", accent: "border-bubble bg-bubble/10 text-bubble" },
  { name: "Tincho", accent: "border-lime bg-lime/10 text-lime" },
];

const HIGHLIGHT = "barra libre";

function Synopsis({ text }: { text: string }) {
  const i = text.toLowerCase().indexOf(HIGHLIGHT);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="night-chip">{text.slice(i, i + HIGHLIGHT.length)}</span>
      {text.slice(i + HIGHLIGHT.length)}
    </>
  );
}

export function Invite({ refCode, inviterName, mainPoster = false, copy = DEFAULT_COPY }: { refCode?: string | undefined; inviterName?: string | null | undefined; mainPoster?: boolean; copy?: Copy }) {
  const c = copy;
  const register = useServerFn(registerGuest);
  const find = useServerFn(findGuest);
  const [mode, setMode] = useState<"join" | "back">("join");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    setLoading(true);
    try {
      if (mode === "join") {
        const fullName = String(fd.get("fullName") || "");
        if (fullName.trim().split(/\s+/).length < 2) throw new Error("Poné nombre y apellido 🙏");
        setGuest(await register({ data: { fullName, email, ref: refCode } }));
      } else {
        const g = await find({ data: { email } });
        if (!g) throw new Error("No encontramos ese email. ¿Ya te anotaste?");
        setGuest(g);
      }
    } catch (err) {
      setError(err instanceof Error && err.message.length < 80 ? err.message : "Revisá los datos e intentá de nuevo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={mainPoster && !guest ? "poster-night min-h-[100dvh] overflow-hidden" : "grain min-h-[100dvh] overflow-hidden"}>
            {!mainPoster && <div aria-hidden className="sand-field pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 90 }, (_, i) => (
          <span key={i} className="sand-particle" style={{
            left: `${(i * 37.13) % 100}%`,
            top: `${(i * 61.79) % 100}%`,
            animationDelay: `${-(i % 19)}s`,
            animationDuration: `${14 + i % 13}s`,
          }} />
        ))}
      </div>}
      <div className={mainPoster && !guest ? "night-layout relative mx-auto flex flex-col" : "relative mx-auto flex max-w-md flex-col px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))]"}>
        {mainPoster ? !guest && <>
          <header className="night-top">
            <span className="night-tags">{[c.tag1, c.tag2, c.tag3].filter(Boolean).map((t) => <span key={t}>{t}</span>)}</span>
          </header>
          <section className="night-hero">
            <p className="night-eyebrow">{c.eyebrow}</p>
            <h1 className="night-title">Tri<svg aria-hidden className="night-spark" viewBox="0 0 100 100"><path d="M50 0 L58 40 L100 50 L58 60 L50 100 L42 60 L0 50 L42 40 Z" /></svg>{c.title.slice(3)}</h1>
            <p className="night-dir"><span className="night-rule" aria-hidden />{c.hosts}</p>
            <p className="night-synopsis"><Synopsis text={c.synopsis} /></p>
            {c.joke && <p className="night-joke">{c.joke}</p>}
            <dl className="night-info">
              <div><dt>Cuándo</dt><dd>{c.when}<br /><small>{c.whenNote}</small></dd></div>
              <div><dt>Dónde</dt><dd>{c.where}<br /><small>{c.whereNote}</small></dd></div>
              <div><dt>Barra libre</dt><dd>{c.bar}<small>{c.barNote}</small></dd></div>
            </dl>
            <Countdown />
          </section>
          <div className="night-cast">
            <img src="/tricumple/trio.png" alt="" className="night-cut" loading="eager" />
            {[["manufferrari", "Manuch", "a"], ["giuli_mallemaci", "Giu", "b"], ["martintascione", "Tincho", "c"]].map(([h, n, k]) => (
              <a key={h} href={`https://instagram.com/${h}`} target="_blank" rel="noreferrer" aria-label={`Instagram de ${n}`} className={`night-tagig night-tagig-${k}`}>@{h}</a>
            ))}
            <div className="night-halftone" />
          </div>
        </> : <>
        {/* top labels */}
        <div className="flex items-center justify-between border-b border-paper/25 pb-4 text-[10px] font-bold uppercase leading-tight">
          <span>proyecto<br />x3</span>
          <span className="flex text-lg" aria-hidden><span className="text-sky">✦</span><span className="text-bubble">✦</span><span className="text-lime">✦</span></span>
          <span className="text-right">una fiesta<br />que todavía<br />no empezó</span>
        </div>

        {/* Hero sticker */}
        <section className="relative mt-6">
          <Splat className="animate-poster-drift absolute -left-4 top-2 z-0 h-16 w-16 -rotate-12 text-sun" />
          <img src={boombox} alt="" aria-hidden width={816} height={816} loading="lazy"
            style={{ ["--r" as string]: "-10deg", animationDelay: "1s" }}
            className="animate-poster-drift pointer-events-none absolute -bottom-12 -left-5 z-20 w-24 grayscale mix-blend-screen" />
          <div className="animate-poster-enter relative z-10 mx-auto py-14 text-center">
            <span className="absolute bottom-2 right-0 -rotate-6 bg-bubble px-2 py-0.5 font-title text-base uppercase text-ink">wow</span>
            <p className="mb-4 inline-block -rotate-3 font-title text-lg uppercase text-paper">estás invitad@ al</p>
            <h1 aria-label="Tricumple" className="poster-title font-title text-paper">
              <span aria-hidden className="poster-word"><span>T</span><span>R</span><span className="text-bubble">I</span></span>
              <span aria-hidden className="poster-word"><span>C</span><span>U</span><span>M</span><span>P</span><span className="text-lime">L</span><span>E</span></span>
            </h1>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {NAMES.map(({ name, accent }) => (
              <span
                key={name}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${accent}`}
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* marquee */}
        <div className="-mx-5 mt-8 overflow-hidden border-y border-paper/25 py-3 text-paper">
          <div className="animate-marquee flex w-max gap-8 whitespace-nowrap text-xs font-bold uppercase [animation-duration:40s]">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["3 cumples", "★", "1 fiesta", "★", "traé amigos", "★", "fecha y lugar muy pronto", "★"].map((t, i) => (
                <span key={`${k}-${i}`} className={t === "★" ? "text-sun" : undefined}>{t}</span>
              )),
            )}
          </div>
        </div>
        </>}

        {guest ? (
          <Ticket guest={guest} />
        ) : (
          <section className={mainPoster ? "night-rsvp animate-poster-enter" : "animate-poster-enter mt-10 rounded-lg bg-card p-6"}>
            {inviterName && (
              <p className="mb-4 inline-block rounded-full border border-paper/40 px-3 py-1 text-sm font-semibold text-paper">
                👋 Te invitó {inviterName}
              </p>
            )}
            {mainPoster ? (
              <h2 className="night-h2">{mode === "join" ? <>{c.formTitle.split(" ")[0]}<br /><em>{c.formTitle.split(" ").slice(1).join(" ")}</em></> : <>Recuperá<br /><em>tu QR.</em></>}</h2>
            ) : (
              <h2 className="text-2xl font-extrabold leading-tight">
                {mode === "join" ? "Confirmá y llevate tu QR" : "Recuperá tu QR"}
              </h2>
            )}
            <p className={mainPoster ? "night-sub" : "mt-1 text-muted-foreground"}>
              {mode === "join" ? (mainPoster ? c.formSub : "Solo tu nombre y email. Nada más.") : "Poné el email con el que te anotaste."}
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              {mode === "join" && (
                <input name="fullName" required maxLength={100} autoComplete="name" placeholder="Nombre y apellido"
                  aria-label="Nombre y apellido" className={mainPoster ? "night-input" : "h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 text-lg outline-none focus:border-ring"} />
              )}
              <input name="email" type="email" required maxLength={255} autoComplete="email" inputMode="email" placeholder="tu@email.com"
                aria-label="Email" className={mainPoster ? "night-input" : "h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 text-lg outline-none focus:border-ring"} />
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
              <Button disabled={loading} type="submit"
                className={mainPoster ? `night-submit${loading ? " is-loading" : ""}` : "h-14 w-full rounded-full bg-primary text-lg font-extrabold text-primary-foreground transition active:scale-95 disabled:opacity-60"}>
                {loading ? (mainPoster ? c.buttonLoading : "Un toque…") : mode === "join" ? (mainPoster ? c.button : "¡Acepto la invitación! 🎉") : "Ver mi QR"}
              </Button>
            </form>
            <Button variant="link" onClick={() => { setMode(mode === "join" ? "back" : "join"); setError(""); }}
              className={mainPoster ? "night-recovery" : "mt-4 w-full text-center text-sm font-semibold text-secondary underline underline-offset-4"}>
              {mode === "join" ? "Ya me anoté, quiero ver mi QR" : "Todavía no me anoté"}
            </Button>
          </section>
        )}
        {mainPoster && !guest && <Playlist variant="poster" />}
        {mainPoster && !guest && <CommunityPlaylist />}
        {mainPoster && !guest && <p className="night-admin"><Link to="/admin">admin</Link></p>}
      </div>
    </main>
  );
}

const PARTY_AT = new Date("2026-11-07T01:30:00-03:00").getTime();

function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, PARTY_AT - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const parts = left === null ? null : {
    d: Math.floor(left / 86400000),
    h: Math.floor((left % 86400000) / 3600000),
    m: Math.floor((left % 3600000) / 60000),
    s: Math.floor((left % 60000) / 1000),
  };
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="night-count" aria-live="polite">
      <span className="night-count-label">{left === 0 ? "Es hoy" : "Faltan"}</span>
      <div className="night-count-grid">
        {(["d", "h", "m", "s"] as const).map(k => (
          <div key={k}><b>{parts ? (k === "d" ? parts.d : two(parts[k])) : "--"}</b><small>{{ d: "días", h: "hs", m: "min", s: "seg" }[k]}</small></div>
        ))}
      </div>
    </div>
  );
}

function Ticket({ guest }: { guest: Guest }) {
  const [copied, setCopied] = useState(false);
  const link = invitationLink(guest.inviteCode);
  const first = guest.fullName.split(" ")[0];

  async function share() {
    const text = "¡Vení al tricumple de Giu, Manuch y Tincho! Anotate acá 👉";
    if (navigator.share) {
      try { await navigator.share({ title: "Tricumple", text, url: link }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-10 space-y-6">
      <div className="animate-poster-enter sticker rounded-[2rem] bg-paper p-6 text-center text-ink">
        <p className="font-hand text-3xl">¡Adentro, {first}!</p>
        <div className="mx-auto mt-4 w-fit rounded-3xl bg-sun p-4">
          <QRCodeSVG value={`TRICUMPLE:${guest.qrToken}`} size={220} bgColor="transparent" />
        </div>
        <p className="mt-4 text-lg font-extrabold uppercase">{guest.fullName}</p>
        <p className="mt-2 rounded-xl bg-ink px-3 py-2 text-sm font-bold text-paper">
          📸 Sacale captura. Lo vas a mostrar en la puerta.
        </p>
        <p className="mt-2 text-xs opacity-70">Si lo perdés, volvé a este link y entrá con tu email.</p>
      </div>

      <Wristband qrToken={guest.qrToken} initialDone={guest.hasReceipt} initialDiscount={guest.discount} />

      <Playlist qrToken={guest.qrToken} variant="ticket" />



      <div className="animate-poster-enter rounded-[2rem] border border-paper/12 bg-card p-6 text-paper" style={{ animationDelay: ".25s" }}>
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/45 bg-destructive/10 px-4 py-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-destructive text-sm font-black text-paper">!</span>
          <p className="text-sm font-extrabold uppercase leading-snug tracking-wide">
            <span className="mr-2 inline-block -translate-y-0.5 rounded-full bg-destructive px-2.5 py-1 text-[0.65rem] font-black text-paper">warning</span>
            <span className="text-paper">¿venís solo? sumá a 1 o 2 amigos, pasales tu link.</span>
          </p>
        </div>
        <p className="font-hand text-2xl text-muted-foreground">tu link personal</p>
        <h3 className="text-3xl font-extrabold leading-tight">Podés invitar a 1 o 2 amigos 🙌</h3>
        <p className="mt-1 font-medium text-muted-foreground">Este link es solo tuyo: así sabemos que vienen de tu parte.</p>
        <div className="mt-4 truncate rounded-2xl border border-paper/12 bg-ink px-3 py-3 font-mono text-xs">{link}</div>
        <Button onClick={share}
          className="mt-3 h-14 w-full rounded-full bg-paper text-lg font-extrabold text-ink transition active:scale-95">
          {copied ? "¡Copiado! ✓" : "Compartir mi link"}
        </Button>
      </div>
    </section>
  );
}
