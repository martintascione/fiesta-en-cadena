import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { COPY_FIELDS, mergeCopy } from "@/lib/copy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/lib/database";
import { adminSessionCookie } from "@/lib/admin-session";
import { inviterCodeColumn } from "@/lib/invitation-links";

export type Discount = { code: string; kind: "free" | "percent"; value: number } | null;
type GuestDTO = { fullName: string; email: string; inviteCode: string; qrToken: string; hasReceipt: boolean; discount: Discount };

async function discountFor(db: Awaited<ReturnType<typeof admin>>, codeId: string | null): Promise<Discount> {
  if (!codeId) return null;
  const { data: c } = await db.from("discount_codes").select("code, kind, value").eq("id", codeId).maybeSingle();
  return c ? { code: c.code, kind: c.kind, value: c.value } : null;
}

function code(len: number) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as SupabaseClient<AppDatabase>;
}

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const getInviter = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("full_name").eq(inviterCodeColumn(data.code), data.code).maybeSingle();
    return g ? { firstName: g.full_name.split(" ")[0] } : null;
  });

export const registerGuest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        fullName: z.string().trim().min(3).max(100),
        email: emailSchema,
        ref: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<GuestDTO> => {
    const db = await admin();
    const { data: existing } = await db.from("guests").select("*").eq("email", data.email).maybeSingle();
    if (existing)
      return { fullName: existing.full_name, email: existing.email, inviteCode: existing.share_code ?? existing.invite_code, qrToken: existing.qr_token, hasReceipt: !!existing.receipt_path, discount: await discountFor(db, existing.discount_code_id) };
    let invitedBy: string | null = null;
    if (data.ref) {
      const { data: inv } = await db.from("guests").select("id").eq(inviterCodeColumn(data.ref), data.ref).maybeSingle();
      invitedBy = inv?.id ?? null;
    }
    // Si el admin ya lo cargó a mano (sin email) con el mismo nombre, se vincula a esa fila en vez de duplicarlo.
    const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    try {
      const { data: pending } = await db.from("guests").select("id, full_name, email").like("email", "%@sin-email.tricumple");
      const match = (pending ?? []).find((p) => norm(p.full_name) === norm(data.fullName));
      if (match) {
        const { data: linked } = await db.from("guests").update({ email: data.email, confirmed_at: new Date().toISOString(), ...(invitedBy ? { invited_by: invitedBy } : {}) }).eq("id", match.id).select("*").single();
        if (linked) return { fullName: linked.full_name, email: linked.email, inviteCode: linked.share_code ?? linked.invite_code, qrToken: linked.qr_token, hasReceipt: !!linked.receipt_path, discount: await discountFor(db, linked.discount_code_id) };
      }
    } catch { /* columnas de planilla aún no migradas */ }
    let inserted = await db
      .from("guests")
      .insert({ full_name: data.fullName, email: data.email, invite_code: code(7), qr_token: code(16), invited_by: invitedBy, confirmed_at: new Date().toISOString() })
      .select("*")
      .single();
    if (inserted.error && /confirmed_at/.test(inserted.error.message)) {
      inserted = await db.from("guests").insert({ full_name: data.fullName, email: data.email, invite_code: code(7), qr_token: code(16), invited_by: invitedBy }).select("*").single();
    }
    const { data: g, error } = inserted;
    if (error || !g) throw new Error("No pudimos registrarte, probá de nuevo");
    return { fullName: g.full_name, email: g.email, inviteCode: g.share_code ?? g.invite_code, qrToken: g.qr_token, hasReceipt: !!g.receipt_path, discount: null };
  });

export const findGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }): Promise<GuestDTO | null> => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("*").eq("email", data.email).maybeSingle();
    return g ? { fullName: g.full_name, email: g.email, inviteCode: g.share_code ?? g.invite_code, qrToken: g.qr_token, hasReceipt: !!g.receipt_path, discount: await discountFor(db, g.discount_code_id) } : null;
  });

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "tricumple-admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: adminSessionCookie,
  };
}

async function matches(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ax = new Uint8Array(x), by = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= (ax[i] ?? 0) ^ (by[i] ?? 0);
  return diff === 0;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ user: z.string().max(200), password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expectedUser = process.env["ADMIN_USER"];
    const expected = process.env["ADMIN_PASSWORD"];
    const secret = process.env["SESSION_SECRET"];
    const missing = [!expectedUser && "ADMIN_USER", !expected && "ADMIN_PASSWORD", (!secret || secret.length < 32) && "SESSION_SECRET (mín. 32 caracteres)"].filter(Boolean) as string[];
    if (missing.length) return { ok: false, reason: `Faltan configurar: ${missing.join(", ")}` };
    const [userOk, passOk] = await Promise.all([matches(data.user.trim(), expectedUser!), matches(data.password, expected!)]);
    if (!userOk || !passOk) return { ok: false, reason: "Usuario o contraseña incorrectos" };
    try {
      const s = await useSession<{ admin?: boolean }>(sessionConfig());
      await s.update({ admin: true });
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: `No se pudo crear la sesión: ${e instanceof Error ? e.message : "error"}` };
    }
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await useSession<{ admin?: boolean }>(sessionConfig());
  await s.clear();
  return { ok: true };
});

async function isAdmin() {
  try {
    const s = await useSession<{ admin?: boolean }>(sessionConfig());
    return !!s.data.admin;
  } catch {
    return false;
  }
}

export const adminList = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isAdmin())) return { authorized: false as const, sheetReady: false, guests: [] };
  const db = await admin();
  const full = await db.from("guests").select("id, full_name, email, invited_by, created_at, receipt_path, discount_code_id, notes, manual_bar, added_by_admin, share_code, invite_code, hosts, extras, extra_names, confirmed_at, referrer_name").order("created_at");
  let sheetReady = !full.error;
  let rows = (full.data ?? []) as Array<{ id: string; full_name: string; email: string; invited_by: string | null; created_at: string; receipt_path: string | null; discount_code_id: string | null; notes?: string | null; manual_bar?: boolean; added_by_admin?: boolean; share_code?: string | null; invite_code: string; hosts?: string[] | null; extras?: number | null; extra_names?: string[] | null; confirmed_at?: string | null; referrer_name?: string | null }>;
  if (full.error) {
    // Las columnas de la planilla todavía no existen (migración 0009 sin aplicar): mostrar igual la lista.
    const basic = await db.from("guests").select("id, full_name, email, invited_by, created_at, receipt_path, discount_code_id, share_code, invite_code").order("created_at");
    rows = (basic.data ?? []) as typeof rows;
    sheetReady = false;
  }
  const { data: codes } = await db.from("discount_codes").select("id, code, kind, value");
  const codeById = new Map((codes ?? []).map((c) => [c.id, c]));
  const paths = rows.map((r) => r.receipt_path).filter((x): x is string => !!x);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from("receipts").createSignedUrls(paths, 60 * 60);
    signed?.forEach((x) => x.path && x.signedUrl && urls.set(x.path, x.signedUrl));
  }
  const byId = new Map(rows.map((r) => [r.id, r.full_name]));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const hostsOf = (r: (typeof rows)[number], depth = 0): Host[] => {
    const own = (r.hosts ?? []).filter((h): h is Host => h === "giu" || h === "manuch" || h === "tincho");
    if (own.length) return own;
    if (r.invited_by && depth < 10) { const p = rowById.get(r.invited_by); if (p) return hostsOf(p, depth + 1); }
    return [];
  };
  return {
    authorized: true as const,
    sheetReady,
    guests: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      invitedBy: r.invited_by ? byId.get(r.invited_by) ?? "—" : null,
      invitedCount: rows.filter((x) => x.invited_by === r.id).length,
      createdAt: r.created_at,
      receiptUrl: r.receipt_path ? urls.get(r.receipt_path) ?? null : null,
      discount: r.discount_code_id ? (() => { const c = codeById.get(r.discount_code_id); return c ? { code: c.code, kind: c.kind, value: c.value } : null; })() : null,
      notes: r.notes ?? "",
      manualBar: !!r.manual_bar,
      addedByAdmin: !!r.added_by_admin,
      shareCode: r.share_code ?? r.invite_code,
      placeholderEmail: r.email.endsWith("@sin-email.tricumple"),
      hosts: (r.hosts ?? []) as Host[],
      hostsResolved: hostsOf(r),
      extras: r.extras ?? 0,
      extraNames: r.extra_names ?? [],
      confirmed: r.confirmed_at ? true : !r.added_by_admin,
      referrer: r.referrer_name ?? "",
    })),
  };
});

/* ---------- Planilla de invitados (admin) ---------- */
export type Host = "giu" | "manuch" | "tincho";
export const HOSTS: { key: Host; label: string }[] = [{ key: "giu", label: "Giu" }, { key: "manuch", label: "Manuch" }, { key: "tincho", label: "Tincho" }];
const hostSchema = z.enum(["giu", "manuch", "tincho"]);
const hostsSchema = z.array(hostSchema).max(3);
const nameSchema = z.string().trim().min(2).max(100);

export const adminAddGuests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    rows: z.array(z.object({ fullName: nameSchema, email: z.string().trim().max(255).optional(), extras: z.number().int().min(0).max(20).optional(), extraNames: z.array(z.string().trim().max(80)).max(20).optional(), notes: z.string().trim().max(300).optional(), manualBar: z.boolean().optional(), referrer: z.string().trim().max(100).optional() })).min(1).max(300),
    hosts: hostsSchema.optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, added: 0, skipped: [] as string[], reason: "No autorizado" };
    const db = await admin();
    const skipped: string[] = [];
    let added = 0;
    const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const { data: existingRows } = await db.from("guests").select("full_name, email");
    const existingNames = new Set((existingRows ?? []).map((g) => norm(g.full_name)));
    for (const r of data.rows) {
      if (existingNames.has(norm(r.fullName))) { skipped.push(`${r.fullName} (ya está en la página)`); continue; }
      existingNames.add(norm(r.fullName));
      let email = (r.email ?? "").trim().toLowerCase();
      if (email) {
        const ok = emailSchema.safeParse(email);
        if (!ok.success) { skipped.push(`${r.fullName} (email inválido)`); continue; }
        email = ok.data;
      } else {
        email = `${code(10)}@sin-email.tricumple`;
      }
      const { error } = await db.from("guests").insert({ full_name: r.fullName, email, invite_code: code(7), qr_token: code(16), added_by_admin: true, hosts: data.hosts ?? [], extras: Math.max(r.extras ?? 0, (r.extraNames ?? []).length), extra_names: r.extraNames ?? [], notes: r.notes || null, manual_bar: !!r.manualBar, referrer_name: r.referrer || null });
      if (error) skipped.push(error.code === "23505" ? `${r.fullName} (ya estaba)` : `${r.fullName}`); else added++;
    }
    return { ok: true, added, skipped, reason: null };
  });

export const adminUpdateGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    fullName: nameSchema.optional(),
    email: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(300).optional(),
    manualBar: z.boolean().optional(),
    hosts: hostsSchema.optional(),
    extras: z.number().int().min(0).max(20).optional(),
    extraNames: z.array(z.string().trim().max(80)).max(20).optional(),
    confirmed: z.boolean().optional(),
    referrer: z.string().trim().max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, reason: "No autorizado" };
    const db = await admin();
    const patch: { full_name?: string; email?: string; notes?: string | null; manual_bar?: boolean; hosts?: Host[]; extras?: number; extra_names?: string[]; confirmed_at?: string | null; referrer_name?: string | null } = {};
    if (data.referrer !== undefined) patch.referrer_name = data.referrer || null;
    if (data.hosts !== undefined) patch.hosts = [...new Set(data.hosts)];
    if (data.extras !== undefined) patch.extras = data.extras;
    if (data.extraNames !== undefined) { patch.extra_names = data.extraNames.filter(Boolean); patch.extras = Math.max(data.extras ?? 0, patch.extra_names.length); }
    if (data.confirmed !== undefined) patch.confirmed_at = data.confirmed ? new Date().toISOString() : null;
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.email !== undefined) {
      const e = data.email.toLowerCase();
      if (e) { const ok = emailSchema.safeParse(e); if (!ok.success) return { ok: false, reason: "Email inválido" }; patch.email = ok.data; }
    }
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (data.manualBar !== undefined) patch.manual_bar = data.manualBar;
    const { error } = await db.from("guests").update(patch).eq("id", data.id);
    if (error) return { ok: false, reason: error.code === "23505" ? "Ese email ya está en otro invitado" : "No se pudo guardar" };
    return { ok: true, reason: null };
  });

/** Vincula un invitado externo (cargado a mano) con uno registrado en la web: pasa sus datos y borra la fila externa. */
export const adminMergeGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ externalId: z.string().uuid(), targetId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, reason: "No autorizado" };
    if (data.externalId === data.targetId) return { ok: false, reason: "Es el mismo invitado" };
    const db = await admin();
    const [{ data: ext }, { data: tgt }] = await Promise.all([
      db.from("guests").select("*").eq("id", data.externalId).maybeSingle(),
      db.from("guests").select("*").eq("id", data.targetId).maybeSingle(),
    ]);
    if (!ext || !tgt) return { ok: false, reason: "Invitado no encontrado" };
    const patch: { hosts?: string[]; extras?: number; extra_names?: string[]; referrer_name?: string | null; manual_bar?: boolean; notes?: string | null; confirmed_at?: string | null } = {};
    if (!(tgt.hosts ?? []).length && (ext.hosts ?? []).length) patch.hosts = ext.hosts;
    if (!(tgt.extras ?? 0) && (ext.extras ?? 0)) { patch.extras = ext.extras; patch.extra_names = ext.extra_names ?? []; }
    if (!tgt.referrer_name && ext.referrer_name) patch.referrer_name = ext.referrer_name;
    if (ext.manual_bar && !tgt.manual_bar && !tgt.receipt_path) patch.manual_bar = true;
    if (ext.notes) patch.notes = [tgt.notes, ext.notes].filter(Boolean).join(" · ");
    if (!tgt.confirmed_at) patch.confirmed_at = new Date().toISOString();
    if (Object.keys(patch).length) {
      const { error } = await db.from("guests").update(patch).eq("id", tgt.id);
      if (error) return { ok: false, reason: "No se pudo vincular" };
    }
    // Si alguien se anotó con el link del externo, pasa a colgar del registrado.
    await db.from("guests").update({ invited_by: tgt.id }).eq("invited_by", ext.id);
    const { error } = await db.from("guests").delete().eq("id", ext.id);
    return { ok: !error, reason: error ? "No se pudo borrar la fila externa" : null };
  });

export const adminDeleteGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false };
    const db = await admin();
    const { error } = await db.from("guests").delete().eq("id", data.id);
    return { ok: !error };
  });

const tokenSchema = z.string().min(10).max(40);

export const startReceiptUpload = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ qrToken: tokenSchema, ext: z.enum(["jpg", "jpeg", "png", "webp", "heic", "pdf"]) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("id").eq("qr_token", data.qrToken).maybeSingle();
    if (!g) throw new Error("Invitado no encontrado");
    const path = `${g.id}/${Date.now()}.${data.ext}`;
    const { data: up, error } = await db.storage.from("receipts").createSignedUploadUrl(path);
    if (error || !up) throw new Error("No se pudo preparar la subida");
    return { path, token: up.token };
  });

export const confirmReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ qrToken: tokenSchema, path: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("id").eq("qr_token", data.qrToken).maybeSingle();
    if (!g || !data.path.startsWith(`${g.id}/`)) throw new Error("No autorizado");
    await db.from("guests").update({ receipt_path: data.path, receipt_uploaded_at: new Date().toISOString() }).eq("id", g.id);
    return { ok: true };
  });

export const getCopy = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = await admin();
    const { data } = await db.from("site_copy").select("key, value");
    return mergeCopy(data);
  } catch {
    return mergeCopy(null);
  }
});

export const saveCopy = createServerFn({ method: "POST" })
  .inputValidator((d) => z.record(z.string(), z.string().max(600)).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, reason: "Sesión vencida: volvé a entrar" };
    const allowed = new Set<string>(COPY_FIELDS.map((f) => f.key));
    const rows = Object.entries(data).filter(([k]) => allowed.has(k)).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    try {
      const db = await admin();
      const { error } = await db.from("site_copy").upsert(rows, { onConflict: "key" });
      if (error) return { ok: false, reason: `${error.message}${error.code ? ` (${error.code})` : ""}` };
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Error desconocido" };
    }
  });

/* ---------- Spotify: búsqueda con client credentials (sin login del invitado) ---------- */
export type Song = { id: string; title: string; artist: string; cover: string | null; url: string };
const MAX_SONGS = 5;
let spotifyToken: { value: string; exp: number } | null = null;

async function spotifyAccessToken() {
  if (spotifyToken && spotifyToken.exp > Date.now() + 30_000) return spotifyToken.value;
  const id = process.env["SPOTIFY_CLIENT_ID"], secret = process.env["SPOTIFY_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("Spotify no configurado");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(`${id}:${secret}`) },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Spotify auth falló");
  const j = (await res.json()) as { access_token: string; expires_in: number };
  spotifyToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export const searchSongs = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<Song[]> => {
    const token = await spotifyAccessToken();
    const url = `https://api.spotify.com/v1/search?type=track&limit=8&market=AR&q=${encodeURIComponent(data.q)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const j = (await res.json()) as { tracks?: { items?: Array<{ id: string; name: string; artists: { name: string }[]; album: { images: { url: string; width: number }[] }; external_urls: { spotify: string } }> } };
    return (j.tracks?.items ?? []).map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      cover: t.album.images.sort((a, b) => a.width - b.width)[0]?.url ?? null,
      url: t.external_urls.spotify,
    }));
  });

async function guestByToken(qrToken: string) {
  const db = await admin();
  const { data: g } = await db.from("guests").select("id").eq("qr_token", qrToken).maybeSingle();
  return g?.id ?? null;
}

export const mySongs = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ qrToken: tokenSchema }).parse(d))
  .handler(async ({ data }): Promise<Song[]> => {
    const gid = await guestByToken(data.qrToken);
    if (!gid) return [];
    const db = await admin();
    const { data: rows } = await db.from("song_requests").select("*").eq("guest_id", gid).order("created_at");
    return (rows ?? []).map((r) => ({ id: r.spotify_id, title: r.title, artist: r.artist, cover: r.cover_url, url: `https://open.spotify.com/track/${r.spotify_id}` }));
  });

export const addSongs = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    qrToken: tokenSchema,
    songs: z.array(z.object({ id: z.string().max(40), title: z.string().max(200), artist: z.string().max(200), cover: z.string().url().nullable() })).max(MAX_SONGS),
  }).parse(d))
  .handler(async ({ data }) => {
    const gid = await guestByToken(data.qrToken);
    if (!gid) return { ok: false, reason: "guest" as const };
    const db = await admin();
    const { count } = await db.from("song_requests").select("id", { count: "exact", head: true }).eq("guest_id", gid);
    if ((count ?? 0) + data.songs.length > MAX_SONGS) return { ok: false, reason: "max" as const };
    const { error } = await db.from("song_requests").upsert(
      data.songs.map((s) => ({ guest_id: gid, spotify_id: s.id, title: s.title, artist: s.artist, cover_url: s.cover })),
      { onConflict: "guest_id,spotify_id", ignoreDuplicates: true },
    );
    return { ok: !error, reason: null };
  });

export const removeSong = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ qrToken: tokenSchema, spotifyId: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const gid = await guestByToken(data.qrToken);
    if (!gid) return { ok: false };
    const db = await admin();
    const { error } = await db.from("song_requests").delete().eq("guest_id", gid).eq("spotify_id", data.spotifyId);
    return { ok: !error };
  });

export const adminSongs = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isAdmin())) return [];
  const db = await admin();
  const { data: rows } = await db.from("song_requests").select("spotify_id, title, artist, cover_url, created_at, guests(full_name)").order("created_at");
  const grouped = new Map<string, { id: string; title: string; artist: string; cover: string | null; by: string[] }>();
  for (const r of rows ?? []) {
    const g = grouped.get(r.spotify_id) ?? { id: r.spotify_id, title: r.title, artist: r.artist, cover: r.cover_url, by: [] };
    const who = (r as unknown as { guests: { full_name: string } | null }).guests?.full_name;
    if (who) g.by.push(who);
    grouped.set(r.spotify_id, g);
  }
  return [...grouped.values()].sort((a, b) => b.by.length - a.by.length);
});

export const adminRemoveSong = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ spotifyId: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, reason: "Sesión vencida: volvé a entrar" };
    const db = await admin();
    const { error } = await db.from("song_requests").delete().eq("spotify_id", data.spotifyId);
    return { ok: !error, reason: error ? "No se pudo eliminar el tema. Probá de nuevo." : null };
  });

/* ---------- Códigos de barra libre ---------- */
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,24}$/, "Solo letras, números y guiones");

export const redeemCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ qrToken: tokenSchema, code: codeSchema }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; discount: Discount } | { ok: false; reason: string }> => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("id, discount_code_id").eq("qr_token", data.qrToken).maybeSingle();
    if (!g) return { ok: false, reason: "Invitado no encontrado" };
    if (g.discount_code_id) return { ok: false, reason: "Ya usaste un código" };
    const { data: c } = await db.from("discount_codes").select("*").eq("code", data.code).maybeSingle();
    if (!c || !c.active) return { ok: false, reason: "Ese código no existe" };
    if (c.uses >= c.max_uses) return { ok: false, reason: "Ese código ya se agotó" };
    const { data: bumped } = await db.from("discount_codes").update({ uses: c.uses + 1 }).eq("id", c.id).eq("uses", c.uses).select("id").maybeSingle();
    if (!bumped) return { ok: false, reason: "Ese código ya se agotó" };
    await db.from("guests").update({ discount_code_id: c.id, discount_applied_at: new Date().toISOString() }).eq("id", g.id);
    return { ok: true, discount: { code: c.code, kind: c.kind, value: c.value } };
  });

export const adminCodes = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isAdmin())) return [];
  const db = await admin();
  const { data } = await db.from("discount_codes").select("*").order("created_at", { ascending: false });
  return data ?? [];
});

export const createCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    code: codeSchema,
    kind: z.enum(["free", "percent"]),
    value: z.number().int().min(1).max(100),
    maxUses: z.number().int().min(1).max(500),
    note: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false, reason: "No autorizado" };
    const db = await admin();
    const { error } = await db.from("discount_codes").insert({ code: data.code, kind: data.kind, value: data.kind === "free" ? 100 : data.value, max_uses: data.maxUses, note: data.note || null });
    if (error) return { ok: false, reason: error.code === "23505" ? "Ese código ya existe" : "No se pudo crear" };
    return { ok: true, reason: null };
  });

export const updateCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean().optional(), maxUses: z.number().int().min(1).max(500).optional(), remove: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isAdmin())) return { ok: false };
    const db = await admin();
    if (data.remove) {
      const { data: c } = await db.from("discount_codes").select("uses").eq("id", data.id).maybeSingle();
      if (c && c.uses > 0) return { ok: false };
      const { error } = await db.from("discount_codes").delete().eq("id", data.id);
      return { ok: !error };
    }
    const patch: { active?: boolean; max_uses?: number } = {};
    if (data.active !== undefined) patch.active = data.active;
    if (data.maxUses !== undefined) patch.max_uses = data.maxUses;
    const { error } = await db.from("discount_codes").update(patch).eq("id", data.id);
    return { ok: !error };
  });
