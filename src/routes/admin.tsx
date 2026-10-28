import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState<"all" | "confirmed" | "pending">("all");
  const [tab, setTab] = useState<"guests" | "codes" | "songs" | "copy">("guests");
  const [copiedAll, setCopiedAll] = useState(false);
  const [listText, setListText] = useState("");
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
    if (status === "confirmed" && !g.confirmed) return false;
    if (status === "pending" && g.confirmed) return false;
    const t = q.trim().toLowerCase();
    return !t || g.fullName.toLowerCase().includes(t) || g.email.toLowerCase().includes(t);
  });
  const exportCsv = () => {
    const rows = [["Nombre", "Confirmado", "Email", "Invitado de", "Acompañantes", "Nombres acompañantes", "Invitado por", "Invitó a", "Pulsera", "Código", "Notas", "Link", "Registrado"], ...data.guests.map((g) => [g.fullName, g.confirmed ? "sí" : "no", g.placeholderEmail ? "" : g.email, g.hostsResolved.map((h) => HOSTS.find((x) => x.key === h)?.label).join(" + "), String(g.extras ?? 0), g.extraNames.join(", "), g.invitedBy ?? "", String(g.invitedCount), g.receiptUrl ? "comprobante" : g.discount?.kind === "free" ? "código" : g.manualBar ? "manual" : "no", g.discount?.code ?? "", g.notes, `${window.location.origin}/i/${g.shareCode}`, new Date(g.createdAt).toLocaleString("es-AR")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "tricumple-invitados.csv";
    a.click();
  };

  const extras = data.guests.reduce((a, g) => a + (g.extras ?? 0), 0);
  const conf = data.guests.filter((g) => g.confirmed).length;
  const stats: [string, string | number, string, string][] = [
    ["Invitados", data.guests.length, extras ? `+${extras} acompañantes` : "sin acompañantes", "text-sky"],
    ["Confirmados", conf, `${data.guests.length ? Math.round((conf / data.guests.length) * 100) : 0}% del total`, "text-paper"],
    ["Sin confirmar", data.guests.length - conf, "cargados a mano", "text-sun"],
    ["Barra libre", paid, `$${(paid * 17500).toLocaleString("es-AR")} recaudados`, "text-lime"],
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-muted-foreground">Tricumple · Panel</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Invitados</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/" className="rounded-full border border-paper/20 px-3 py-1.5 font-semibold text-paper/80 hover:border-paper/50">Ver invitación</Link>
          <button onClick={exportCsv} className="rounded-full border border-paper/20 px-3 py-1.5 font-semibold text-paper/80 hover:border-paper/50">Exportar CSV</button>
          <button onClick={async () => {
            const text = data.guests.map((g) => `${g.fullName}, ${g.placeholderEmail ? "" : g.email}, ${g.confirmed ? "confirmado" : "sin confirmar"}`).join("\n");
            setListText(text);
            try { await navigator.clipboard.writeText(text); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1800); } catch { /* sin permiso de portapapeles: queda el cuadro para copiar a mano */ }
          }} className="rounded-full border border-paper/20 px-3 py-1.5 font-semibold text-paper/80 hover:border-paper/50">{copiedAll ? "¡Copiado!" : "Copiar lista"}</button>
          <button onClick={() => router.invalidate()} className="rounded-full border border-paper/20 px-3 py-1.5 font-semibold text-paper/80 hover:border-paper/50">Actualizar</button>
          <button onClick={async () => { await logout(); router.invalidate(); }} className="rounded-full px-3 py-1.5 font-semibold text-muted-foreground hover:text-destructive">Salir</button>
        </div>
      </header>

      {listText && (
        <div className="mt-4 rounded-2xl border border-paper/10 bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Lista de invitados ({data.guests.length})</p>
            <button onClick={() => setListText("")} className="text-xs text-muted-foreground underline">Cerrar</button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Si no se copió solo, tocá adentro del cuadro: se selecciona todo, y copiá con Cmd+C (o Ctrl+C).</p>
          <textarea readOnly value={listText} rows={8} onFocus={(e) => e.target.select()} onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="mt-2 w-full rounded-xl border border-paper/15 bg-ink px-3 py-2 font-mono text-xs text-paper outline-none focus:border-sun" />
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, n, sub, c]) => (
          <div key={l} className="rounded-2xl border border-paper/10 bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</p>
            <p className={`mt-1 text-4xl font-extrabold leading-none tracking-tight ${c}`}>{n}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-paper/10">
        {([["guests", "Planilla"], ["codes", "Códigos"], ["songs", "Playlist"], ["copy", "Textos"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition ${tab === k ? "border-sun text-paper" : "border-transparent text-muted-foreground hover:text-paper"}`}>{l}</button>
        ))}
      </nav>

      {tab === "copy" && <CopyEditor initial={data.copy} />}
      {tab === "songs" && <SongList songs={data.songs ?? []} onChange={() => router.invalidate()} />}
      {tab === "codes" && <Codes codes={data.codes ?? []} onChange={() => router.invalidate()} />}
      {tab === "guests" && <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([["all", "Todos"], ["confirmed", "Confirmados"], ["pending", "Sin confirmar"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${status === k ? "bg-sun text-ink" : "bg-card text-paper/70 hover:text-paper"}`}>{l}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-paper/15" />
        {([["all", "Todas"], ["paid", "Con barra libre"], ["unpaid", "Sin barra libre"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === k ? "bg-lime text-ink" : "bg-card text-paper/70 hover:text-paper"}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o email"
          className="ml-auto h-9 w-full max-w-xs rounded-full border border-paper/15 bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-sun" />
      </div>
      {!data.sheetReady && <p className="mt-4 rounded-2xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">La base todavía no tiene las columnas de la planilla (migración 0009). Hasta que Lovable la aplique, no se puede editar ni cargar invitados a mano. Si no se aplica sola, corré el SQL de la migración en Cloud → Database.</p>}
      <GuestSheet guests={shown} total={data.guests.length} onChange={() => router.invalidate()} />
      </>}
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
    <section className="mt-6 rounded-2xl border border-paper/10 bg-card p-5">
      <h2 className="text-lg font-bold">Textos de la invitación</h2>
      <p className="mt-1 text-sm text-muted-foreground">Lo que guardes acá se ve en la portada al instante.</p>
      {true && (
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
    <section className="mt-6 rounded-2xl border border-paper/10 bg-card p-5">
      <h2 className="text-lg font-bold">Playlist pedida <span className="text-lime">{songs.length}</span></h2>
      {true && (
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
      <h2 className="text-lg font-bold">Códigos de barra libre <span className="text-lime">{codes.length}</span></h2>
      {true && (
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

type GuestRow = { id: string; fullName: string; email: string; placeholderEmail: boolean; invitedBy: string | null; invitedCount: number; createdAt: string; receiptUrl: string | null; discount: { code: string; kind: "free" | "percent"; value: number } | null; notes: string; manualBar: boolean; addedByAdmin: boolean; shareCode: string; hosts: Host[]; hostsResolved: Host[]; extras: number; extraNames: string[]; confirmed: boolean };

function Cell({ value, onSave, placeholder, type = "text", className = "" }: { value: string; onSave: (v: string) => Promise<void>; placeholder?: string; type?: string; className?: string }) {
  const [v, setV] = useState(value);
  const last = useRef(value);
  useEffect(() => { setV(value); last.current = value; }, [value]);
  async function commit() { if (v.trim() !== last.current.trim()) { last.current = v; await onSave(v.trim()); } }
  return (
    <input type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(last.current); (e.target as HTMLInputElement).blur(); } }}
      className={`h-9 w-full cursor-text rounded-md border border-transparent bg-transparent px-2 text-sm outline-none focus:border-ring focus:bg-ink ${className}`} />
  );
}

function GuestSheet({ guests: incoming, total, onChange }: { guests: GuestRow[]; total: number; onChange: () => void }) {
  const [guests, setGuests] = useState<GuestRow[]>(incoming);
  useEffect(() => { setGuests(incoming); }, [incoming]);
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
  const ordered = [...guests].map((g) => ({ ...g, hostsResolved: sortedHosts(g.hostsResolved ?? []), hosts: g.hosts ?? [], extraNames: g.extraNames ?? [] })).sort((a, b) =>
    comboRank(a.hostsResolved) - comboRank(b.hostsResolved) || comboLabel(a.hostsResolved).localeCompare(comboLabel(b.hostsResolved)) || a.fullName.localeCompare(b.fullName, "es"),
  ).filter((g) => group === "all" ? true : group === "none" ? g.hostsResolved.length === 0 : g.hostsResolved.includes(group));
  const counts = HOSTS.map((h) => ({ ...h, n: guests.filter((g) => (g.hostsResolved ?? []).includes(h.key)).length }));
  const common = guests.filter((g) => (g.hostsResolved ?? []).length === 3).length;
  const unassigned = guests.filter((g) => (g.hostsResolved ?? []).length === 0).length;
  const toggle = (hs: Host[], h: Host) => hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h];
  const parseExtras = (v: string) => { const t = v.trim(); if (!t) return { extras: 0, extraNames: [] as string[] }; if (/^\+?\d+$/.test(t)) return { extras: Number(t.replace("+", "")), extraNames: [] as string[] }; const names = t.split(/[,;+]/).map((x) => x.trim()).filter(Boolean); return { extras: names.length, extraNames: names }; };
  async function patch(id: string, data: { fullName?: string; email?: string; notes?: string; manualBar?: boolean; hosts?: Host[]; extras?: number; extraNames?: string[]; confirmed?: boolean }) {
    setMsg("");
    // Optimista: se refleja al instante y recién después se guarda; no recarga todo el panel.
    setGuests((gs) => gs.map((g) => g.id !== id ? g : {
      ...g,
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.email !== undefined ? { email: data.email, placeholderEmail: !data.email } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.manualBar !== undefined ? { manualBar: data.manualBar } : {}),
      ...(data.hosts !== undefined ? { hosts: data.hosts, hostsResolved: data.hosts } : {}),
      ...(data.extras !== undefined ? { extras: data.extras } : {}),
      ...(data.extraNames !== undefined ? { extraNames: data.extraNames, extras: Math.max(data.extras ?? 0, data.extraNames.length) } : {}),
      ...(data.confirmed !== undefined ? { confirmed: data.confirmed } : {}),
    }));
    try {
      const r = await update({ data: { id, ...data } });
      if (!r.ok) { setMsg(r.reason ?? "No se pudo guardar"); onChange(); }
    } catch { setMsg("No se pudo guardar"); onChange(); }
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
      const extrasRaw = parts.find((x) => /^\+\d+$/.test(x) || /^\+\s*[a-záéíóúñ]/i.test(x));
      const pago = parts.find((x) => /^(si|sí|no)$/i.test(x));
      const notes = parts.filter((x) => x !== email && x !== extrasRaw && x !== pago).join(" · ");
      const ex = extrasRaw ? (/^\+\d+$/.test(extrasRaw) ? { extras: Number(extrasRaw.slice(1)), extraNames: [] as string[] } : (() => { const names = extrasRaw.replace(/^\+\s*/, "").split(/\s*\+\s*/).map((x) => x.trim()).filter(Boolean); return { extras: names.length, extraNames: names }; })()) : { extras: 0, extraNames: [] as string[] };
      return { fullName, email, ...ex, manualBar: !!pago && /^s/i.test(pago), notes: [notes, pago && /^no$/i.test(pago) ? "no paga" : ""].filter(Boolean).join(" · ") || undefined };
    }).filter((r) => r.fullName.length >= 2);
    if (!rows.length) return setMsg("No encontré nombres en el texto");
    const r = await add({ data: { rows, hosts: newHosts } });
    setMsg(`${r.added} agregados${r.skipped.length ? `. Ya estaban en la página (${r.skipped.length}): ${r.skipped.map((x) => x.replace(/ \(.*\)$/, "")).join(", ")}` : ""}`);
    setBulkText(""); setBulk(false); onChange();
  }
  const link = (g: GuestRow) => `${window.location.origin}/i/${g.shareCode}`;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Invitados de</span>
        <button onClick={() => setGroup("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${group === "all" ? "bg-paper text-ink" : "bg-card text-paper/70 hover:text-paper"}`}>Todos</button>
        {counts.map((h) => (
          <button key={h.key} onClick={() => setGroup(h.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold text-ink transition ${hostColor[h.key]} ${group === h.key ? "ring-2 ring-paper ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}>{h.label} <span className="opacity-60">{h.n}</span></button>
        ))}
        <button onClick={() => setGroup("none")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${group === "none" ? "bg-paper text-ink" : "bg-card text-paper/70 hover:text-paper"}`}>Sin asignar <span className="opacity-60">{unassigned}</span></button>
        <span className="text-xs text-muted-foreground">· en común {common}</span>
        <button onClick={() => setBulk(!bulk)} className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold transition ${bulk ? "bg-paper text-ink" : "border border-paper/20 text-paper/80 hover:border-paper/50"}`}>{bulk ? "Cerrar" : "Pegar lista"}</button>
      </div>
      {bulk && (
        <div className="mt-3 rounded-2xl border border-paper/10 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Cargar como invitado de
            {HOSTS.map((h) => (
              <button key={h.key} type="button" onClick={() => setNewHosts(toggle(newHosts, h.key))} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${newHosts.includes(h.key) ? `${hostColor[h.key]} text-ink` : "border border-paper/30 text-paper/70"}`}>{h.label}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Una persona por línea, separado por comas: <span className="font-mono">Nombre Apellido, email, +2, SI, nota</span>. Solo el nombre es obligatorio; <span className="font-mono">+2</span> son acompañantes (o con nombres: <span className="font-mono">+Juan +Ana</span>), <span className="font-mono">SI/NO</span> es si pagó la barra, el resto va a notas. Podés pegar directo desde Excel.</p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder={"Juan Pérez, juan@mail.com\nAna Gómez"}
            className="mt-2 w-full rounded-xl border-2 border-input bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-ring" />
          <button onClick={addBulk} className="mt-2 h-10 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground">Agregar todos</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-sun">{msg}</p>}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-paper/10 bg-card">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="w-8 px-2 py-2" title="Confirmado">✓</th>
              <th className="px-2 py-2">Nombre</th>
              <th className="px-2 py-2">Email</th>
              <th className="w-36 px-2 py-2">Invitado de</th>
              <th className="w-40 px-2 py-2">Acompañantes</th>
              <th className="w-28 px-2 py-2 text-center">Barra libre</th>
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
              return (<Fragment key={g.id}>
                {newGroup && (
                  <tr className="border-t border-paper/10">
                    <td colSpan={11} className="bg-muted/20 px-3 py-2"><span className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider`}><span className={`inline-block h-2.5 w-2.5 rounded-full ${g.hostsResolved.length === 1 ? hostColor[g.hostsResolved[0]!] : g.hostsResolved.length ? "bg-paper" : "bg-muted-foreground"}`} />{g.hostsResolved.length ? `Invitados ${g.hostsResolved.length === 3 ? "en común" : "de " + label}` : "Sin asignar"}</span></td>
                  </tr>
                )}
                <tr className="border-t border-paper/5 transition hover:bg-paper/[.03]">
                  <td className="px-2 py-1 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-1 text-center"><input type="checkbox" checked={g.confirmed} onChange={(e) => patch(g.id, { confirmed: e.target.checked })} title={g.confirmed ? "Confirmado" : "Sin confirmar: todavía no se anotó en la página"} className="h-4 w-4 accent-sun" /></td>
                  <td className="px-1 py-1"><Cell value={g.fullName} onSave={(v) => patch(g.id, { fullName: v })} className={`font-semibold ${g.confirmed ? "" : "text-paper/70"}`} /></td>
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
                  <td className="px-1 py-1">
                    <Cell value={g.extraNames?.length ? g.extraNames.join(", ") : g.extras ? `+${g.extras}` : ""} placeholder="+2 o nombres" onSave={(v) => patch(g.id, parseExtras(v))} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {g.receiptUrl ? (
                      <a href={g.receiptUrl} target="_blank" rel="noreferrer" title="Pagó: ver comprobante" className="inline-flex h-8 items-center gap-1 rounded-full bg-lime px-3 text-[11px] font-extrabold uppercase text-ink">✓ Pagó <span className="font-normal normal-case opacity-70">ver</span></a>
                    ) : g.discount?.kind === "free" ? (
                      <span title={`Código ${g.discount.code}`} className="inline-flex h-8 items-center rounded-full bg-lime px-3 text-[11px] font-extrabold uppercase text-ink">✓ Gratis</span>
                    ) : (
                      <button type="button" onClick={() => patch(g.id, { manualBar: !g.manualBar })} title={g.manualBar ? "Marcado como pagado a mano. Clic para desmarcar" : "Clic para marcar como pagado (efectivo, etc.)"}
                        className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-extrabold uppercase transition active:scale-95 ${g.manualBar ? "bg-lime text-ink" : "border-2 border-dashed border-paper/40 text-paper/60 hover:border-sun hover:text-sun"}`}>
                        {g.manualBar ? "✓ Pagó" : "○ Falta"}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs text-muted-foreground">{g.invitedBy ?? (g.addedByAdmin ? "cargado a mano" : "link general")}{g.invitedCount ? ` · invitó a ${g.invitedCount}` : ""}{g.discount ? ` · ${g.discount.code}` : ""}</td>
                  <td className="px-1 py-1"><Cell value={g.notes} placeholder="…" onSave={(v) => patch(g.id, { notes: v })} /></td>
                  <td className="px-2 py-1">
                    <button onClick={async () => { await navigator.clipboard.writeText(link(g)); setCopied(g.id); setTimeout(() => setCopied(""), 1500); }} className="rounded-full border border-paper/30 px-2 py-0.5 text-[10px] font-bold uppercase">{copied === g.id ? "copiado" : g.shareCode}</button>
                  </td>
                  <td className="px-2 py-1 text-right"><button onClick={async () => { if (confirm(`¿Borrar a ${g.fullName}?`)) { await remove({ data: { id: g.id } }); onChange(); } }} className="text-muted-foreground hover:text-destructive" aria-label="Borrar">×</button></td>
                </tr>
              </Fragment>);
            })}
            <tr className="border-t border-paper/15 bg-muted/10">
              <td className="px-2 py-2 text-xs font-bold text-sun">+</td>
              <td></td>
              <td className="px-1 py-1"><form id="add-guest" onSubmit={addOne}><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre y apellido" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring" /></form></td>
              <td className="px-1 py-1"><input form="add-guest" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email (opcional)" type="email" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring" /></td>
              <td colSpan={7} className="px-2 py-1"><button form="add-guest" className="h-9 rounded-full bg-sun px-4 text-xs font-extrabold text-ink transition active:scale-95">Agregar invitado</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {guests.length === 0 && <p className="mt-3 text-muted-foreground">{total === 0 ? "Todavía no hay invitados. Cargá el primero arriba." : "Nada que coincida."}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Clic en una celda para editar; Enter o salir de la celda guarda. "Invitado de" admite uno, dos o los tres (G = Giu, M = Manuch, T = Tincho); si no lo asignás, lo hereda de quien lo invitó con su link. "Acompañantes" acepta un número (+2) o los nombres separados por coma. La tilde ✓ es si confirmó: los que cargás a mano quedan sin confirmar hasta que se anoten en la página con el mismo nombre (se vinculan solos) o la marques vos. En Barra libre, "○ Falta" se cambia a "✓ Pagó" con un clic (para pagos en efectivo o por fuera); si subió comprobante o usó código, ya figura solo. El botón de link copia el link personal del invitado.</p>
    </section>
  );
}
