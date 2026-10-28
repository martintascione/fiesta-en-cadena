import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { adminList, adminLogin, adminLogout, adminSongs, adminRemoveSong, adminCodes, createCode, updateCode, getCopy, saveCopy, adminAddGuests, adminUpdateGuest, adminDeleteGuest, HOSTS, type Host } from "@/lib/guests.functions";
import { Trash2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

  const paid = data.guests.filter((g) => g.receiptUrl || g.discount?.kind === "free" || g.manualBar).length;
  const referred = data.guests.filter((g) => g.invitedBy).length;
  const shown = data.guests.filter((g) => {
    const hasBar = !!g.receiptUrl || g.discount?.kind === "free" || g.manualBar;
    if (filter === "paid" && !hasBar) return false;
    if (filter === "unpaid" && hasBar) return false;
    const t = q.trim().toLowerCase();
    return !t || g.fullName.toLowerCase().includes(t) || g.email.toLowerCase().includes(t);
  });
  const exportCsv = () => {
    const rows = [["Nombre", "Email", "Invitado de", "Acompañantes", "Invitado por", "Invitó a", "Pulsera", "Código", "Notas", "Link", "Registrado"], ...data.guests.map((g) => [g.fullName, g.placeholderEmail ? "" : g.email, g.hostsResolved.map((h) => HOSTS.find((x) => x.key === h)?.label).join(" + "), String(g.extras ?? 0), g.invitedBy ?? "", String(g.invitedCount), g.receiptUrl ? "comprobante" : g.discount?.kind === "free" ? "código" : g.manualBar ? "manual" : "no", g.discount?.code ?? "", g.notes, `${window.location.origin}/i/${g.shareCode}`, new Date(g.createdAt).toLocaleString("es-AR")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "tricumple-invitados.csv";
    a.click();
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-extrabold">Panel</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link to="/" className="font-semibold text-muted-foreground underline">Volver a la invitación</Link>
          <button onClick={exportCsv} className="text-muted-foreground underline">Exportar CSV</button>
          <button onClick={() => router.invalidate()} className="text-muted-foreground underline">Actualizar</button>
          <button onClick={async () => { await logout(); router.invalidate(); }} className="text-muted-foreground underline">Salir</button>
        </div>
      </div>
      <CopyEditor initial={data.copy} />
      <SongList songs={data.songs ?? []} onChange={() => router.invalidate()} />
      <Codes codes={data.codes ?? []} onChange={() => router.invalidate()} />
      <div className="mt-8 grid grid-cols-3 gap-2">
        {[["Invitados", `${data.guests.length}${data.guests.reduce((a, g) => a + (g.extras ?? 0), 0) ? ` +${data.guests.reduce((a, g) => a + (g.extras ?? 0), 0)}` : ""}`, "bg-sky"], ["Barra libre", paid, "bg-lime"], ["Por referidos", referred, "bg-bubble"]].map(([l, n, c]) => (
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
      <GuestSheet guests={shown} total={data.guests.length} onChange={() => router.invalidate()} />
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

function SongList({ songs, onChange }: { songs: { id: string; title: string; artist: string; cover: string | null; by: string[] }[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const remove = useServerFn(adminRemoveSong);
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function drop(id: string, title: string) {
    if (!confirm(`¿Eliminar “${title}” de todos los pedidos y de la página principal?`)) return;
    setRemoving(id); setError("");
    try {
      const result = await remove({ data: { spotifyId: id } });
      if (!result.ok) { setError(result.reason ?? "No se pudo eliminar"); return; }
      await Promise.all([onChange(), queryClient.invalidateQueries({ queryKey: ["community-songs"] })]);
    } catch { setError("No se pudo eliminar el tema. Probá de nuevo."); }
    finally { setRemoving(null); }
  }
  const copyIds = () => navigator.clipboard.writeText(songs.map((s) => `spotify:track:${s.id}`).join("\n"));
  return (
    <section className="mt-4 rounded-2xl bg-card p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold">Playlist pedida <span className="text-lime">{songs.length}</span></span>
        <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Ver"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
              <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={removing !== null} onClick={() => drop(s.id, s.title)} aria-label={`Eliminar ${s.title}`} title="Eliminar tema">
                {removing === s.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
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

type GuestRow = { id: string; fullName: string; email: string; placeholderEmail: boolean; invitedBy: string | null; invitedCount: number; createdAt: string; receiptUrl: string | null; discount: { code: string; kind: "free" | "percent"; value: number } | null; notes: string; manualBar: boolean; addedByAdmin: boolean; shareCode: string; hosts: Host[]; hostsResolved: Host[]; extras: number };

function Cell({ value, onSave, placeholder, type = "text", className = "" }: { value: string; onSave: (v: string) => Promise<void>; placeholder?: string; type?: string; className?: string }) {
  const [v, setV] = useState(value);
  const last = useRef(value);
  useEffect(() => { setV(value); last.current = value; }, [value]);
  async function commit() { if (v.trim() !== last.current.trim()) { last.current = v; await onSave(v.trim()); } }
  return (
    <input type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(last.current); (e.target as HTMLInputElement).blur(); } }}
      className={`h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-ring focus:bg-ink ${className}`} />
  );
}

function GuestSheet({ guests, total, onChange }: { guests: GuestRow[]; total: number; onChange: () => void }) {
  const update = useServerFn(adminUpdateGuest);
  const remove = useServerFn(adminDeleteGuest);
  const add = useServerFn(adminAddGuests);
  const [msg, setMsg] = useState("");
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [copied, setCopied] = useState("");

  const [group, setGroup] = useState<"all" | Host | "none">("all");
  const [newHosts, setNewHosts] = useState<Host[]>([]);
  const hostLabel = (h: Host) => HOSTS.find((x) => x.key === h)?.label ?? h;
  const hostColor: Record<Host, string> = { giu: "bg-bubble", manuch: "bg-sky", tincho: "bg-lime" };
  const comboLabel = (hs: Host[]) => hs.length === 0 ? "Sin asignar" : hs.length === 3 ? "En común (los 3)" : hs.map(hostLabel).join(" + ");
  const comboRank = (hs: Host[]) => hs.length === 3 ? 0 : hs.length === 1 ? 1 + HOSTS.findIndex((x) => x.key === hs[0]) : hs.length === 2 ? 10 : 99;
  const sortedHosts = (hs: Host[]) => [...hs].sort((x, y) => HOSTS.findIndex((h) => h.key === x) - HOSTS.findIndex((h) => h.key === y));
  const ordered = [...guests].map((g) => ({ ...g, hostsResolved: sortedHosts(g.hostsResolved) })).sort((a, b) =>
    comboRank(a.hostsResolved) - comboRank(b.hostsResolved) || comboLabel(a.hostsResolved).localeCompare(comboLabel(b.hostsResolved)) || a.fullName.localeCompare(b.fullName, "es"),
  ).filter((g) => group === "all" ? true : group === "none" ? g.hostsResolved.length === 0 : g.hostsResolved.includes(group));
  const counts = HOSTS.map((h) => ({ ...h, n: guests.filter((g) => g.hostsResolved.includes(h.key)).length }));
  const common = guests.filter((g) => g.hostsResolved.length === 3).length;
  const unassigned = guests.filter((g) => g.hostsResolved.length === 0).length;
  const toggle = (hs: Host[], h: Host) => hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h];
  async function patch(id: string, data: { fullName?: string; email?: string; notes?: string; manualBar?: boolean; hosts?: Host[]; extras?: number }) {
    setMsg("");
    const r = await update({ data: { id, ...data } });
    if (!r.ok) setMsg(r.reason ?? "No se pudo guardar");
    onChange();
  }
  async function addOne(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (newName.trim().length < 2) return;
    const r = await add({ data: { rows: [{ fullName: newName.trim(), email: newEmail.trim() || undefined }], hosts: newHosts } });
    if (r.skipped.length) setMsg(`No se agregó: ${r.skipped.join(", ")}`);
    setNewName(""); setNewEmail(""); onChange();
  }
  async function addBulk() {
    setMsg("");
    const rows = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const parts = l.split(/[,;\t]/).map((x) => x.trim()).filter(Boolean);
      const fullName = parts.shift() ?? "";
      const email = parts.find((x) => x.includes("@"));
      const extrasRaw = parts.find((x) => /^\+\d+$/.test(x));
      const pago = parts.find((x) => /^(si|sí|no)$/i.test(x));
      const notes = parts.filter((x) => x !== email && x !== extrasRaw && x !== pago).join(" · ");
      return { fullName, email, extras: extrasRaw ? Number(extrasRaw.slice(1)) : 0, manualBar: !!pago && /^s/i.test(pago), notes: [notes, pago && /^no$/i.test(pago) ? "no paga" : ""].filter(Boolean).join(" · ") || undefined };
    }).filter((r) => r.fullName.length >= 2);
    if (!rows.length) return setMsg("No encontré nombres en el texto");
    const r = await add({ data: { rows, hosts: newHosts } });
    setMsg(`${r.added} agregados${r.skipped.length ? ` · sin agregar: ${r.skipped.join(", ")}` : ""}`);
    setBulkText(""); setBulk(false); onChange();
  }
  const link = (g: GuestRow) => `${window.location.origin}/i/${g.shareCode}`;

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">Planilla <span className="text-muted-foreground">{ordered.length}/{total}</span></h2>
        <button onClick={() => setBulk(!bulk)} className="ml-auto text-sm text-muted-foreground underline">{bulk ? "Cerrar" : "Pegar lista"}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setGroup("all")} className={`rounded-full border px-3 py-1 text-xs font-bold ${group === "all" ? "border-paper bg-paper text-ink" : "border-paper/30"}`}>Todos</button>
        {counts.map((h) => (
          <button key={h.key} onClick={() => setGroup(h.key)} className={`rounded-full px-3 py-1 text-xs font-bold text-ink ${hostColor[h.key]} ${group === h.key ? "ring-2 ring-paper" : "opacity-80"}`}>{h.label} · {h.n}</button>
        ))}
        <button onClick={() => setGroup("none")} className={`rounded-full border px-3 py-1 text-xs font-bold ${group === "none" ? "border-paper bg-paper text-ink" : "border-paper/30"}`}>Sin asignar · {unassigned}</button>
        <span className="text-xs text-muted-foreground">En común: {common}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">Cargar como invitado de
          {HOSTS.map((h) => (
            <button key={h.key} type="button" onClick={() => setNewHosts(toggle(newHosts, h.key))} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${newHosts.includes(h.key) ? `${hostColor[h.key]} text-ink` : "border border-paper/30 text-paper"}`}>{h.label}</button>
          ))}
        </span>
      </div>
      {bulk && (
        <div className="mt-3 rounded-2xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Una persona por línea, separado por comas: <span className="font-mono">Nombre Apellido, email, +2, SI, nota</span>. Solo el nombre es obligatorio; <span className="font-mono">+2</span> son acompañantes, <span className="font-mono">SI/NO</span> es si pagó la barra, el resto va a notas. Podés pegar directo desde Excel.</p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder={"Juan Pérez, juan@mail.com\nAna Gómez"}
            className="mt-2 w-full rounded-xl border-2 border-input bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-ring" />
          <button onClick={addBulk} className="mt-2 h-10 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground">Agregar todos</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-sun">{msg}</p>}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-paper/10 bg-card">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Nombre</th>
              <th className="px-2 py-2">Email</th>
              <th className="w-36 px-2 py-2">Invitado de</th>
              <th className="w-14 px-2 py-2 text-center">+Acomp.</th>
              <th className="w-20 px-2 py-2 text-center">Barra</th>
              <th className="px-2 py-2">Invitado por</th>
              <th className="px-2 py-2">Notas</th>
              <th className="w-24 px-2 py-2">Link</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((g, i) => {
              const bar = g.receiptUrl ? "comprobante" : g.discount?.kind === "free" ? "código" : g.manualBar ? "manual" : "";
              const prev = ordered[i - 1];
              const label = comboLabel(g.hostsResolved);
              const newGroup = group === "all" && (!prev || comboLabel(prev.hostsResolved) !== label);
              const inherited = !g.hosts.length && g.hostsResolved.length > 0;
              return (<>
                {newGroup && (
                  <tr key={`h-${label}`} className="border-t border-paper/10">
                    <td colSpan={10} className="px-2 pb-1 pt-3"><span className={`rounded-full px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${g.hostsResolved.length === 1 ? `${hostColor[g.hostsResolved[0]!]} text-ink` : g.hostsResolved.length ? "bg-paper text-ink" : "bg-muted text-paper"}`}>{g.hostsResolved.length ? `Invitados ${g.hostsResolved.length === 3 ? "en común" : "de " + label}` : "Sin asignar"}</span></td>
                  </tr>
                )}
                <tr key={g.id} className="border-t border-paper/10 hover:bg-muted/20">
                  <td className="px-2 py-1 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-1"><Cell value={g.fullName} onSave={(v) => patch(g.id, { fullName: v })} className="font-semibold" /></td>
                  <td className="px-1 py-1"><Cell value={g.placeholderEmail ? "" : g.email} type="email" placeholder="sin email" onSave={(v) => patch(g.id, { email: v })} /></td>
                  <td className="px-1 py-1">
                    <span className="flex gap-1" title={inherited ? `Heredado de ${g.invitedBy}` : ""}>
                      {HOSTS.map((h) => {
                        const on = g.hostsResolved.includes(h.key);
                        return <button key={h.key} type="button" onClick={() => patch(g.id, { hosts: toggle(g.hostsResolved, h.key) })}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? `${hostColor[h.key]} text-ink` : "border border-paper/20 text-muted-foreground"} ${on && inherited ? "opacity-60" : ""}`}>{h.label[0]}</button>;
                      })}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input type="number" min={0} max={20} defaultValue={g.extras} key={`${g.id}-${g.extras}`} onBlur={(e) => { const n = Number(e.target.value); if (n !== g.extras) patch(g.id, { extras: n }); }}
                      className="h-8 w-12 rounded-md border border-transparent bg-transparent text-center text-sm outline-none hover:border-input focus:border-ring" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {g.receiptUrl ? <a href={g.receiptUrl} target="_blank" rel="noreferrer" className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">ver</a>
                      : g.discount?.kind === "free" ? <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">código</span>
                      : <input type="checkbox" checked={g.manualBar} onChange={(e) => patch(g.id, { manualBar: e.target.checked })} title="Marcar barra libre pagada a mano" className="h-4 w-4 accent-lime" />}
                    {bar === "manual" && <span className="ml-1 text-[10px] text-muted-foreground">manual</span>}
                  </td>
                  <td className="px-2 py-1 text-xs text-muted-foreground">{g.invitedBy ?? (g.addedByAdmin ? "cargado a mano" : "link general")}{g.invitedCount ? ` · invitó a ${g.invitedCount}` : ""}{g.discount ? ` · ${g.discount.code}` : ""}</td>
                  <td className="px-1 py-1"><Cell value={g.notes} placeholder="…" onSave={(v) => patch(g.id, { notes: v })} /></td>
                  <td className="px-2 py-1">
                    <button onClick={async () => { await navigator.clipboard.writeText(link(g)); setCopied(g.id); setTimeout(() => setCopied(""), 1500); }} className="rounded-full border border-paper/30 px-2 py-0.5 text-[10px] font-bold uppercase">{copied === g.id ? "copiado" : g.shareCode}</button>
                  </td>
                  <td className="px-2 py-1 text-right"><button onClick={async () => { if (confirm(`¿Borrar a ${g.fullName}?`)) { await remove({ data: { id: g.id } }); onChange(); } }} className="text-muted-foreground hover:text-destructive" aria-label="Borrar">×</button></td>
                </tr>
              </>);
            })}
            <tr className="border-t-2 border-paper/20 bg-muted/20">
              <td className="px-2 py-1 text-xs text-muted-foreground">+</td>
              <td className="px-1 py-1"><form id="add-guest" onSubmit={addOne}><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre y apellido" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring" /></form></td>
              <td className="px-1 py-1"><input form="add-guest" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email (opcional)" type="email" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring" /></td>
              <td colSpan={7} className="px-2 py-1"><button form="add-guest" className="h-9 rounded-full bg-primary px-4 text-xs font-extrabold text-primary-foreground">Agregar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {guests.length === 0 && <p className="mt-3 text-muted-foreground">{total === 0 ? "Todavía no hay invitados. Cargá el primero arriba." : "Nada que coincida."}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Clic en una celda para editar; Enter o salir de la celda guarda. "Invitado de" admite uno, dos o los tres (G = Giu, M = Manuch, T = Tincho); si no lo asignás, lo hereda de quien lo invitó con su link. "+Acomp." son los acompañantes que trae. La casilla de Barra marca pulsera pagada a mano. El botón de link copia el link personal del invitado.</p>
    </section>
  );
}
