import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { registerGuest, findGuest } from "@/lib/guests.functions";
import gnome from "@/assets/glyph-gnome.png";
import boombox from "@/assets/glyph-boombox.png";
import rabbit from "@/assets/glyph-rabbit.png";
import { Wristband } from "@/components/Wristband";

function Splat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="currentColor">
      <path d="M52 2 L56 30 L70 10 L64 34 L92 16 L70 42 L98 48 L70 54 L90 78 L62 62 L66 96 L52 66 L40 92 L40 64 L12 84 L32 58 L2 56 L30 46 L8 26 L36 36 L28 8 L44 30 Z" />
    </svg>
  );
}

type Guest = { fullName: string; email: string; inviteCode: string; qrToken: string; hasReceipt: boolean };

const NAMES = [
  { name: "Giuli", accent: "border-sky bg-sky/10 text-sky" },
  { name: "Manu", accent: "border-bubble bg-bubble/10 text-bubble" },
  { name: "Martín", accent: "border-lime bg-lime/10 text-lime" },
];

export function Invite({ refCode, inviterName }: { refCode?: string | undefined; inviterName?: string | null | undefined }) {
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
    <main className="grain min-h-[100dvh] overflow-hidden">
      <div className="relative mx-auto flex max-w-md flex-col px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
        {/* top labels */}
        <div className="flex items-center justify-between border-b border-paper/25 pb-4 text-[10px] font-bold uppercase leading-tight">
          <span>proyecto<br />x3</span>
          <span className="flex text-lg" aria-hidden><span className="text-sky">✦</span><span className="text-bubble">✦</span><span className="text-lime">✦</span></span>
          <span className="text-right">una fiesta<br />que todavía<br />no empezó</span>
        </div>

        {/* Hero sticker */}
        <section className="relative mt-6">
          <Splat className="absolute -left-4 top-2 z-0 h-16 w-16 -rotate-12 text-sun" />
          <img src={gnome} alt="" aria-hidden width={816} height={816}
            style={{ ["--r" as string]: "8deg" }}
            className="animate-poster-drift pointer-events-none absolute -right-4 -top-1 z-20 w-24 grayscale mix-blend-screen" />
          <img src={boombox} alt="" aria-hidden width={816} height={816} loading="lazy"
            style={{ ["--r" as string]: "-10deg", animationDelay: "1s" }}
            className="animate-poster-drift pointer-events-none absolute -bottom-12 -left-5 z-20 w-24 grayscale mix-blend-screen" />
          <div className="animate-poster-enter relative z-10 mx-auto py-14 text-center">
            <span className="absolute bottom-2 right-0 -rotate-6 bg-bubble px-2 py-0.5 text-xs font-bold uppercase text-ink">wow</span>
            <p className="mb-4 text-xs font-bold uppercase">estás invitad@ al</p>
            <h1 className="poster-title font-title text-paper">
              <span className="relative inline-block">TRI<span aria-hidden className="absolute -bottom-1 -right-3 h-1 w-10 -rotate-6 bg-sky" /></span>
              <br />
              <span className="inline-block">CUMPLE</span>
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

        <img src={rabbit} alt="" aria-hidden width={816} height={816} loading="lazy"
          className="animate-poster-drift pointer-events-none relative z-10 -mb-10 mt-2 w-24 self-end grayscale mix-blend-screen" />
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

        {guest ? (
          <Ticket guest={guest} />
        ) : (
          <section className="animate-poster-enter mt-10 rounded-lg bg-card p-6" style={{ animationDelay: ".2s" }}>
            {inviterName && (
              <p className="mb-4 inline-block rounded-full border border-paper/40 px-3 py-1 text-sm font-semibold text-paper">
                👋 Te invitó {inviterName}
              </p>
            )}
            <h2 className="text-2xl font-extrabold leading-tight">
              {mode === "join" ? "Confirmá y llevate tu QR" : "Recuperá tu QR"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {mode === "join" ? "Solo tu nombre y email. Nada más." : "Poné el email con el que te anotaste."}
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              {mode === "join" && (
                <input name="fullName" required maxLength={100} autoComplete="name" placeholder="Nombre y apellido"
                  className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 text-lg outline-none focus:border-ring" />
              )}
              <input name="email" type="email" required maxLength={255} autoComplete="email" inputMode="email" placeholder="tu@email.com"
                className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 text-lg outline-none focus:border-ring" />
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
              <button disabled={loading}
                className="h-14 w-full rounded-full bg-primary text-lg font-extrabold text-primary-foreground transition active:scale-95 disabled:opacity-60">
                {loading ? "Un toque…" : mode === "join" ? "¡Acepto la invitación! 🎉" : "Ver mi QR"}
              </button>
            </form>
            <button onClick={() => { setMode(mode === "join" ? "back" : "join"); setError(""); }}
              className="mt-4 w-full text-center text-sm font-semibold text-secondary underline underline-offset-4">
              {mode === "join" ? "Ya me anoté, quiero ver mi QR" : "Todavía no me anoté"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function Ticket({ guest }: { guest: Guest }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/i/${guest.inviteCode}` : "";
  const first = guest.fullName.split(" ")[0];

  async function share() {
    const text = "¡Vení al tricumple de Giuli, Manu y Martín! Anotate acá 👉";
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

      <Wristband qrToken={guest.qrToken} initialDone={guest.hasReceipt} />



      <div className="animate-poster-enter rounded-[2rem] bg-lime p-6 text-ink" style={{ animationDelay: ".25s" }}>
        <p className="font-hand text-2xl">tu link personal</p>
        <h3 className="text-3xl font-extrabold leading-tight">Podés invitar a 2 o 3 amigos 🙌</h3>
        <p className="mt-1 font-medium">Este link es solo tuyo: así sabemos que vienen de tu parte.</p>
        <div className="mt-4 truncate rounded-2xl border-2 border-ink/20 bg-paper/60 px-4 py-3 font-mono text-sm">{link}</div>
        <button onClick={share}
          className="mt-3 h-14 w-full rounded-full bg-ink text-lg font-extrabold text-paper transition active:scale-95">
          {copied ? "¡Copiado! ✓" : "Compartir mi link"}
        </button>
      </div>
    </section>
  );
}
