import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminList, adminLogin, adminLogout, adminSongs, adminCodes, createCode, updateCode, getCopy, saveCopy } from "@/lib/guests.functions";
import { COPY_FIELDS, type Copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  loader: async () => { const [list, copy, songs, codes] = await Promise.all([adminList(), getCopy(), adminSongs(), adminCodes()]); return { ...list, copy, songs, codes }; },
  head: () => ({
    meta: [
      { title: "Panel · Tricumple" },
      { name: "description", content: "Lista privada de invitados del tricumple." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Panel · Tricumple" },
      { property: "og:description", content: "Lista privada de invitados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const [err, setErr] = useState("");
  const [entering, setEntering] = useState(false);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [q, setQ] = useState("");

  if (!data.authorized) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-5">
        <form
          className="w-full max-w-sm space-y-3 rounded-[2rem] bg-card p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (entering) return;
            const fd = new FormData(e.currentTarget);
            setErr("");
            setEntering(true);
            try {
              const r = await login({ data: { user: String(fd.get("user")), password: String(fd.get("password")) } });
              if (!r.ok) { setErr(r.reason ?? "Usuario o contraseña incorrectos"); return; }
              const session = await adminList();
              if (!session.authorized) { setErr("El navegador no pudo mantener el acceso. Abrí el panel en una pestaña nueva y probá otra vez."); return; }
              await router.invalidate();
            } catch (ex) {
              setErr(`Error del servidor: ${ex instanceof Error ? ex.message : "desconocido"}`);
            } finally {
              setEntering(false);
            }
          }}
        >
          <h1 className="text-3xl font-extrabold">Panel 🔒</h1>
          <input name="user" type="text" required autoComplete="username" placeholder="Usuario"
            className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 outline-none focus:border-ring" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Contraseña"
            className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 outline-none focus:border-ring" />
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={entering} className="h-14 w-full rounded-full bg-primary font-extrabold text-primary-foreground">{entering ? "Entrando…" : "Entrar"}</Button>
        </form>
      </main>
    );
  }

  const paid = data.guests.filter((g) => g.receiptUrl || g.discount?.kind === "free").length;
  const referred = data.guests.filter((g) => g.invitedBy).length;
  const shown = data.guests.filter((g) => {
    const hasBar = !!g.receiptUrl || g.discount?.kind === "free";
    if (filter === "paid" && !hasBar) return false;
    if (filter === "unpaid" && hasBar) return false;
    const t = q.trim().toLowerCase();
    return !t || g.fullName.toLowerCase().includes(t) || g.email.toLowerCase().includes(t);
  });
  const exportCsv = () => {
    const rows = [["Nombre", "Email", "Invitado por", "Invitó a", "Pulsera", "Código", "Registrado"], ...data.guests.map((g) => [g.fullName, g.email, g.invitedBy ?? "", String(g.invitedCount), g.receiptUrl ? "comprobante" : g.discount?.kind === "free" ? "código" : "no", g.discount?.code ?? "", new Date(g.createdAt).toLocaleString("es-AR")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "tricumple-invitados.csv";
    a.click();
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold">Panel</h1>
        <div className="flex gap-4">
          <button onClick={exportCsv} className="text-sm text-muted-foreground underline">Exportar CSV</button>
          <button onClick={() => router.invalidate()} className="text-sm text-muted-foreground underline">Actualizar</button>
          <button onClick={async () => { await logout(); router.invalidate(); }} className="text-sm text-muted-foreground underline">Salir</button>
        </div>
      </div>
      <CopyEditor initial={data.copy} />
      <SongList songs={data.songs} />
      <Codes codes={data.codes ?? []} onChange={() => router.invalidate()} />
      <div className="mt-8 grid grid-cols-3 gap-2">
        {[["Invitados", data.guests.length, "bg-sky"], ["Barra libre", paid, "bg-lime"], ["Por referidos", referred, "bg-bubble"]].map(([l, n, c]) => (
          <div key={String(l)} className={`rounded-2xl p-4 text-ink ${c}`}>
            <p className="text-3xl font-extrabold leading-none">{n}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([["all", "Todos"], ["paid", "Con barra libre"], ["unpaid", "Sin barra libre"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === k ? "border-paper bg-paper text-ink" : "border-paper/30 text-paper"}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o email"
          className="ml-auto h-9 w-full max-w-xs rounded-full border-2 border-input bg-transparent px-4 text-sm outline-none focus:border-ring" />
      </div>
      <ul className="mt-4 space-y-2">
        {shown.map((g) => (
          <li key={g.id} className="rounded-2xl bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-bold">{g.fullName}</p>
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold text-ink ${g.invitedBy ? "bg-bubble" : "bg-sky"}`}>
                {g.invitedBy ? `de parte de ${g.invitedBy}` : "link general"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{g.email} · invitó a {g.invitedCount} · {new Date(g.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
            {g.discount && <span className="mr-2 mt-2 inline-block rounded-full bg-sun px-3 py-1 text-xs font-extrabold uppercase text-ink">Código {g.discount.code}{g.discount.kind === "percent" ? ` · -${g.discount.value}%` : " · gratis"}</span>}
            {g.receiptUrl ? (
              <a href={g.receiptUrl} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-extrabold uppercase text-ink">
                ✓ Pulsera · ver comprobante
              </a>
            ) : g.discount?.kind === "free" ? (
              <span className="mt-2 inline-block rounded-full bg-lime px-3 py-1 text-xs font-extrabold uppercase text-ink">✓ Pulsera · código</span>
            ) : (
              <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sin pulsera</span>
            )}
          </li>
        ))}
        {shown.length === 0 && <p className="text-muted-foreground">{data.guests.length === 0 ? "Todavía no se anotó nadie." : "Nada que coincida."}</p>}
      </ul>
    </main>
  );
}

function CopyEditor({ initial }: { initial: Copy }) {
  const save = useServerFn(saveCopy);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Copy>(initial);
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [reason, setReason] = useState("");
  return (
    <section className="mt-6 rounded-2xl bg-card p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold">Textos de la invitación</span>
        <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && (
        <form className="mt-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setState("saving");
          try {
            const r = await save({ data: values });
            setState(r.ok ? "ok" : "err"); setReason(r.reason ?? "");
          } catch (ex) { setState("err"); setReason(ex instanceof Error ? ex.message : "Error del servidor"); }
        }}>
          {COPY_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{f.label}</span>
              {f.multiline ? (
                <textarea value={values[f.key]} rows={3} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
              ) : (
                <input value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border-2 border-input bg-transparent px-3 text-sm outline-none focus:border-ring" />
              )}
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button disabled={state === "saving"} className="h-11 rounded-full bg-primary px-5 font-extrabold text-primary-foreground disabled:opacity-60">
              {state === "saving" ? "Guardando…" : "Guardar textos"}
            </button>
            {state === "ok" && <span className="text-sm text-lime">Guardado. Ya se ve en la invitación.</span>}
            {state === "err" && <span className="text-sm text-destructive">No se pudo guardar{reason ? `: ${reason}` : "."}</span>}
          </div>
        </form>
      )}
    </section>
  );
}

function SongList({ songs }: { songs: { id: string; title: string; artist: string; cover: string | null; by: string[] }[] }) {
  const [open, setOpen] = useState(false);
  const copyIds = () => navigator.clipboard.writeText(songs.map((s) => `spotify:track:${s.id}`).join("\n"));
  return (
    <section className="mt-4 rounded-2xl bg-card p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold">Playlist pedida <span className="text-lime">{songs.length}</span></span>
        <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Ver"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          {songs.length > 0 && (
            <button onClick={copyIds} className="text-sm text-muted-foreground underline">Copiar URIs para pegar en una playlist de Spotify</button>
          )}
          {songs.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-2">
              {s.cover && <img src={s.cover} alt="" className="h-10 w-10 rounded-lg" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{s.title} <span className="font-normal text-muted-foreground">· {s.artist}</span></p>
                <p className="truncate text-xs text-muted-foreground">{s.by.length} {s.by.length === 1 ? "pedido" : "pedidos"} · {s.by.join(", ")}</p>
              </div>
              <a href={`https://open.spotify.com/track/${s.id}`} target="_blank" rel="noreferrer" className="rounded-full bg-lime px-3 py-1 text-xs font-extrabold text-ink">Abrir</a>
            </div>
          ))}
          {songs.length === 0 && <p className="text-muted-foreground">Todavía nadie pidió temas.</p>}
        </div>
      )}
    </section>
  );
}

type CodeRow = { id: string; code: string; kind: "free" | "percent"; value: number; max_uses: number; uses: number; active: boolean; note: string | null };
function Codes({ codes, onChange }: { codes: CodeRow[]; onChange: () => void }) {
  const create = useServerFn(createCode);
  const update = useServerFn(updateCode);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"free" | "percent">("free");
  const [err, setErr] = useState("");
  return (
    <section className="mt-4 rounded-2xl bg-card p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold">Códigos de barra libre <span className="text-lime">{codes.length}</span></span>
        <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Ver"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <form className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-5" onSubmit={async (e) => {
            e.preventDefault(); setErr("");
            const fd = new FormData(e.currentTarget);
            const r = await create({ data: { code: String(fd.get("code")), kind, value: Number(fd.get("value") || 100), maxUses: Number(fd.get("maxUses") || 1), note: String(fd.get("note") || "") } });
            if (r.ok) { (e.target as HTMLFormElement).reset(); onChange(); } else setErr(r.reason ?? "No se pudo crear");
          }}>
            <input name="code" required placeholder="CÓDIGO" maxLength={24} className="h-10 rounded-xl border-2 border-input bg-transparent px-3 font-mono text-sm font-bold uppercase outline-none focus:border-ring" />
            <select value={kind} onChange={(e) => setKind(e.target.value as "free" | "percent")} className="h-10 rounded-xl border-2 border-input bg-card px-2 text-sm outline-none">
              <option value="free">Gratis</option>
              <option value="percent">Descuento %</option>
            </select>
            <input name="value" type="number" min={1} max={99} placeholder="% desc." disabled={kind === "free"} className="h-10 rounded-xl border-2 border-input bg-transparent px-3 text-sm outline-none focus:border-ring disabled:opacity-40" />
            <input name="maxUses" type="number" min={1} max={500} defaultValue={1} placeholder="Usos" className="h-10 rounded-xl border-2 border-input bg-transparent px-3 text-sm outline-none focus:border-ring" />
            <button className="h-10 rounded-full bg-primary px-4 text-sm font-extrabold text-primary-foreground">Crear</button>
            <input name="note" placeholder="Para quién (opcional)" maxLength={120} className="col-span-2 h-10 rounded-xl border-2 border-input bg-transparent px-3 text-sm outline-none focus:border-ring sm:col-span-5" />
          </form>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">Cada invitado puede usar un solo código. Gratis = pulsera sin pagar; Descuento = paga el precio con el % aplicado y sube comprobante.</p>
          {codes.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 p-3 ${c.active ? "" : "opacity-50"}`}>
              <span className="font-mono text-lg font-bold">{c.code}</span>
              <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-ink">{c.kind === "free" ? "Gratis" : `-${c.value}%`}</span>
              <span className="text-sm text-muted-foreground">{c.uses}/{c.max_uses} usos{c.note ? ` · ${c.note}` : ""}</span>
              <span className="ml-auto flex gap-3 text-sm">
                <button onClick={async () => { await update({ data: { id: c.id, active: !c.active } }); onChange(); }} className="underline">{c.active ? "Pausar" : "Activar"}</button>
                <button onClick={async () => { const n = Number(prompt("Nuevo máximo de usos", String(c.max_uses))); if (n > 0) { await update({ data: { id: c.id, maxUses: n } }); onChange(); } }} className="underline">Usos</button>
                {c.uses === 0 && <button onClick={async () => { if (confirm(`¿Borrar ${c.code}?`)) { await update({ data: { id: c.id, remove: true } }); onChange(); } }} className="text-destructive underline">Borrar</button>}
              </span>
            </div>
          ))}
          {codes.length === 0 && <p className="text-muted-foreground">Todavía no creaste códigos.</p>}
        </div>
      )}
    </section>
  );
}
