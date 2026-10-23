import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminList, adminLogin, adminLogout, adminSongs, getCopy, saveCopy } from "@/lib/guests.functions";
import { COPY_FIELDS, type Copy } from "@/lib/copy";

export const Route = createFileRoute("/admin")({
  loader: async () => { const [list, copy, songs] = await Promise.all([adminList(), getCopy(), adminSongs()]); return { ...list, copy, songs }; },
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
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [q, setQ] = useState("");

  if (!data.authorized) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-5">
        <form
          className="w-full max-w-sm space-y-3 rounded-[2rem] bg-card p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const r = await login({ data: { user: String(fd.get("user")), password: String(fd.get("password")) } });
            if (r.ok) router.invalidate(); else setErr(true);
          }}
        >
          <h1 className="text-3xl font-extrabold">Panel 🔒</h1>
          <input name="user" type="text" required autoComplete="username" placeholder="Usuario"
            className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 outline-none focus:border-ring" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Contraseña"
            className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 outline-none focus:border-ring" />
          {err && <p className="text-sm text-destructive">Usuario o contraseña incorrectos</p>}
          <button className="h-14 w-full rounded-full bg-primary font-extrabold text-primary-foreground">Entrar</button>
        </form>
      </main>
    );
  }

  const paid = data.guests.filter((g) => g.receiptUrl).length;
  const referred = data.guests.filter((g) => g.invitedBy).length;
  const shown = data.guests.filter((g) => {
    if (filter === "paid" && !g.receiptUrl) return false;
    if (filter === "unpaid" && g.receiptUrl) return false;
    const t = q.trim().toLowerCase();
    return !t || g.fullName.toLowerCase().includes(t) || g.email.toLowerCase().includes(t);
  });
  const exportCsv = () => {
    const rows = [["Nombre", "Email", "Invitado por", "Invitó a", "Pulsera", "Registrado"], ...data.guests.map((g) => [g.fullName, g.email, g.invitedBy ?? "", String(g.invitedCount), g.receiptUrl ? "sí" : "no", new Date(g.createdAt).toLocaleString("es-AR")])];
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
            {g.receiptUrl ? (
              <a href={g.receiptUrl} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-extrabold uppercase text-ink">
                ✓ Pulsera · ver comprobante
              </a>
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
  return (
    <section className="mt-6 rounded-2xl bg-card p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold">Textos de la invitación</span>
        <span className="text-sm text-muted-foreground">{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && (
        <form className="mt-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setState("saving");
          const r = await save({ data: values });
          setState(r.ok ? "ok" : "err");
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
            {state === "err" && <span className="text-sm text-destructive">No se pudo guardar.</span>}
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
