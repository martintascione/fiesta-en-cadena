import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startReceiptUpload, confirmReceipt, redeemCode, type Discount } from "@/lib/guests.functions";

const ALIAS = "tricumple.bru";
const ACCOUNT_NAME = "MANUELA FERRARI";
export const BAR_PRICE = 17500;
const money = (n: number) => "$" + n.toLocaleString("es-AR");
const EXTS = ["jpg", "jpeg", "png", "webp", "heic", "pdf"] as const;
type Ext = (typeof EXTS)[number];

export function Wristband({ qrToken, initialDone, initialDiscount = null }: { qrToken: string; initialDone: boolean; initialDiscount?: Discount }) {
  const redeem = useServerFn(redeemCode);
  const [discount, setDiscount] = useState<Discount>(initialDiscount);
  const [code, setCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const price = discount ? (discount.kind === "free" ? 0 : Math.round(BAR_PRICE * (100 - discount.value) / 100)) : BAR_PRICE;
  const isFree = discount?.kind === "free";

  async function applyCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeErr(""); setCodeBusy(true);
    try {
      const r = await redeem({ data: { qrToken, code } });
      if (r.ok) { setDiscount(r.discount); setCodeOpen(false); } else setCodeErr(r.reason);
    } catch { setCodeErr("No se pudo aplicar. Probá de nuevo."); }
    finally { setCodeBusy(false); }
  }

  const start = useServerFn(startReceiptUpload);
  const confirm = useServerFn(confirmReceipt);
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [aliasCopied, setAliasCopied] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    if (file.size > 10 * 1024 * 1024) return setErr("El archivo pesa más de 10 MB");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase() as Ext;
    if (!EXTS.includes(ext)) return setErr("Subí una foto o un PDF");
    setBusy(true);
    try {
      const { path, token } = await start({ data: { qrToken, ext } });
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.storage.from("receipts").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await confirm({ data: { qrToken, path } });
      setDone(true);
    } catch {
      setErr("No se pudo subir. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const picker = (
    <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={busy} onChange={onFile} />
  );

  return (
    <div className="animate-pop relative" style={{ animationDelay: ".15s" }}>
      <div className="relative overflow-hidden rounded-[1.25rem] bg-destructive text-paper">
        <div className="band-stripes absolute inset-0 opacity-25" aria-hidden />
        <div className="relative flex items-stretch">
          <div className="flex-1 p-5">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.25em]">
              <span>acceso</span><span className="h-px flex-1 bg-paper/60" /><span>all night</span>
            </div>
            <p className="mt-3 font-display text-[3.4rem] font-extrabold uppercase leading-[0.8] tracking-[-0.06em]">
              Barra<br />libre
            </p>
            <p className="mt-3 max-w-[15rem] text-sm font-semibold leading-snug">
              {isFree ? `Tu pulsera va por nuestra cuenta (código ${discount?.code}). Hidratate toda la noche.` : discount ? `Con tu código ${discount.code} pagás ${money(price)} en vez de ${money(BAR_PRICE)}.` : "¿Querés barra libre? Pagá la pulsera e hidratate toda la noche."}
            </p>
          </div>
          <div className="band-perf relative flex w-24 shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-paper/70">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">pulsera</span>
            <span className="-rotate-90 whitespace-nowrap py-10 font-display text-3xl font-extrabold tracking-tight">{isFree ? "GRATIS" : money(price)}</span>
            <span className="text-lg">✦</span>
          </div>
        </div>
      </div>

      {isFree ? (
        <div className="-mt-3 rounded-b-[1.75rem] border-2 border-t-0 border-paper/15 bg-card px-5 pb-5 pt-7">
          <div className="flex items-center gap-3 rounded-2xl bg-lime px-4 py-3 text-ink">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-lg text-lime">✓</span>
            <div className="leading-tight">
              <p className="font-extrabold">Barra libre confirmada</p>
              <p className="text-xs font-semibold">No tenés que pagar nada. Tu pulsera te espera en la puerta.</p>
            </div>
          </div>
        </div>
      ) : (
      <div className="-mt-3 rounded-b-[1.75rem] border-2 border-t-0 border-paper/15 bg-card px-5 pb-5 pt-7">
        {!discount && (codeOpen ? (
          <form onSubmit={applyCode} className="mb-5 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={24} autoCapitalize="characters" aria-label="Código de descuento"
              className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-input bg-transparent px-3 font-mono text-base font-bold uppercase outline-none focus:border-ring" />
            <button disabled={codeBusy || code.length < 3} className="h-11 rounded-full bg-paper px-4 text-sm font-extrabold text-ink disabled:opacity-50">{codeBusy ? "…" : "Aplicar"}</button>
          </form>
        ) : (
          <button type="button" onClick={() => setCodeOpen(true)} className="mb-5 text-xs font-semibold text-muted-foreground underline underline-offset-4">¿Tenés un código? Usalo acá</button>
        ))}
        {codeErr && <p className="-mt-3 mb-4 text-sm font-semibold text-destructive">{codeErr}</p>}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">1 · transferí {money(price)} al alias</p>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(ALIAS);
            setAliasCopied(true);
            setTimeout(() => setAliasCopied(false), 1800);
          }}
          className="mt-2 flex w-full items-center justify-between rounded-2xl border-2 border-paper bg-ink px-4 py-3 transition active:scale-[.98]"
        >
          <span className="font-mono text-xl font-bold">{ALIAS}</span>
          <span className="rounded-full bg-sun px-3 py-1 text-xs font-extrabold uppercase text-ink">{aliasCopied ? "copiado" : "copiar"}</span>
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Titular de la cuenta: <span className="font-bold text-paper">{ACCOUNT_NAME}</span></p>

        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">2 · subí el comprobante</p>
        {done ? (
          <>
            <div className="mt-2 flex items-center gap-3 rounded-2xl bg-lime px-4 py-3 text-ink">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-lg text-lime">✓</span>
              <div className="leading-tight">
                <p className="font-extrabold">Comprobante recibido</p>
                <p className="text-xs font-semibold">Lo revisamos y tu pulsera te espera en la puerta.</p>
              </div>
            </div>
            <label className="mt-2 block cursor-pointer text-center text-xs font-semibold text-muted-foreground underline underline-offset-4">
              {picker}
              {busy ? "Subiendo…" : "Reemplazar comprobante"}
            </label>
          </>
        ) : (
          <label className={`mt-2 flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-paper text-lg font-extrabold text-ink transition active:scale-95 ${busy ? "opacity-60" : ""}`}>
            {picker}
            {busy ? "Subiendo…" : "Cargar comprobante ↑"}
          </label>
        )}
        {err && <p className="mt-2 text-sm font-semibold text-destructive">{err}</p>}
      </div>
      )}
    </div>
  );
}
