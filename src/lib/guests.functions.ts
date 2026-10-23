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
    const { data: g, error } = await db
      .from("guests")
      .insert({ full_name: data.fullName, email: data.email, invite_code: code(7), qr_token: code(16), invited_by: invitedBy })
      .select("*")
      .single();
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
  if (!(await isAdmin())) return { authorized: false as const, guests: [] };
  const db = await admin();
  const { data } = await db.from("guests").select("id, full_name, email, invited_by, created_at, receipt_path, discount_code_id").order("created_at");
  const rows = data ?? [];
  const { data: codes } = await db.from("discount_codes").select("id, code, kind, value");
  const codeById = new Map((codes ?? []).map((c) => [c.id, c]));
  const paths = rows.map((r) => r.receipt_path).filter((x): x is string => !!x);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from("receipts").createSignedUrls(paths, 60 * 60);
    signed?.forEach((x) => x.path && x.signedUrl && urls.set(x.path, x.signedUrl));
  }
  const byId = new Map(rows.map((r) => [r.id, r.full_name]));
  return {
    authorized: true as const,
    guests: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      invitedBy: r.invited_by ? byId.get(r.invited_by) ?? "—" : null,
      invitedCount: rows.filter((x) => x.invited_by === r.id).length,
      createdAt: r.created_at,
      receiptUrl: r.receipt_path ? urls.get(r.receipt_path) ?? null : null,
      discount: r.discount_code_id ? (() => { const c = codeById.get(r.discount_code_id); return c ? { code: c.code, kind: c.kind, value: c.value } : null; })() : null,
    })),
  };
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
