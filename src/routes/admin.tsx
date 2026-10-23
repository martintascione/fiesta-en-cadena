import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminList, adminLogin, adminLogout } from "@/lib/guests.functions";

export const Route = createFileRoute("/admin")({
  loader: () => adminList(),
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

  if (!data.authorized) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-5">
        <form
          className="w-full max-w-sm space-y-3 rounded-[2rem] bg-card p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const password = String(new FormData(e.currentTarget).get("password"));
            const r = await login({ data: { password } });
            if (r.ok) router.invalidate(); else setErr(true);
          }}
        >
          <h1 className="text-3xl font-extrabold">Panel 🔒</h1>
          <input name="password" type="password" required placeholder="Contraseña"
            className="h-14 w-full rounded-2xl border-2 border-input bg-transparent px-4 outline-none focus:border-ring" />
          {err && <p className="text-sm text-destructive">Contraseña incorrecta</p>}
          <button className="h-14 w-full rounded-full bg-primary font-extrabold text-primary-foreground">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold">Invitados <span className="text-lime">{data.guests.length}</span></h1>
          <p className="text-sm text-muted-foreground">Pulseras con comprobante: {data.guests.filter((g) => g.receiptUrl).length}</p>
        </div>
        <button onClick={async () => { await logout(); router.invalidate(); }} className="text-sm text-muted-foreground underline">Salir</button>
      </div>
      <ul className="mt-6 space-y-2">
        {data.guests.map((g) => (
          <li key={g.id} className="rounded-2xl bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-bold">{g.fullName}</p>
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold text-ink ${g.invitedBy ? "bg-bubble" : "bg-sky"}`}>
                {g.invitedBy ? `de parte de ${g.invitedBy}` : "link general"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{g.email} · invitó a {g.invitedCount}</p>
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
        {data.guests.length === 0 && <p className="text-muted-foreground">Todavía no se anotó nadie.</p>}
      </ul>
    </main>
  );
}
