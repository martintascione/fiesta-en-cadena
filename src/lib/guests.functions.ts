import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { COPY_FIELDS, mergeCopy } from "@/lib/copy";

type GuestDTO = { fullName: string; email: string; inviteCode: string; qrToken: string; hasReceipt: boolean };

function code(len: number) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const getInviter = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("full_name").eq("invite_code", data.code).maybeSingle();
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
      return { fullName: existing.full_name, email: existing.email, inviteCode: existing.invite_code, qrToken: existing.qr_token, hasReceipt: !!existing.receipt_path };
    let invitedBy: string | null = null;
    if (data.ref) {
      const { data: inv } = await db.from("guests").select("id").eq("invite_code", data.ref).maybeSingle();
      invitedBy = inv?.id ?? null;
    }
    const { data: g, error } = await db
      .from("guests")
      .insert({ full_name: data.fullName, email: data.email, invite_code: code(7), qr_token: code(16), invited_by: invitedBy })
      .select("*")
      .single();
    if (error || !g) throw new Error("No pudimos registrarte, probá de nuevo");
    return { fullName: g.full_name, email: g.email, inviteCode: g.invite_code, qrToken: g.qr_token, hasReceipt: !!g.receipt_path };
  });

export const findGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }): Promise<GuestDTO | null> => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("*").eq("email", data.email).maybeSingle();
    return g ? { fullName: g.full_name, email: g.email, inviteCode: g.invite_code, qrToken: g.qr_token, hasReceipt: !!g.receipt_path } : null;
  });

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "tricumple-admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
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
    if (!expectedUser || !expected) return { ok: false };
    const [userOk, passOk] = await Promise.all([matches(data.user.trim(), expectedUser), matches(data.password, expected)]);
    if (!userOk || !passOk) return { ok: false };
    const s = await useSession<{ admin?: boolean }>(sessionConfig());
    await s.update({ admin: true });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await useSession<{ admin?: boolean }>(sessionConfig());
  await s.clear();
  return { ok: true };
});

export const adminList = createServerFn({ method: "GET" }).handler(async () => {
  const s = await useSession<{ admin?: boolean }>(sessionConfig());
  if (!s.data.admin) return { authorized: false as const, guests: [] };
  const db = await admin();
  const { data } = await db.from("guests").select("id, full_name, email, invited_by, created_at, receipt_path").order("created_at");
  const rows = data ?? [];
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
    const s = await useSession<{ admin?: boolean }>(sessionConfig());
    if (!s.data.admin) return { ok: false };
    const allowed = new Set<string>(COPY_FIELDS.map((f) => f.key));
    const rows = Object.entries(data).filter(([k]) => allowed.has(k)).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    const db = await admin();
    const { error } = await db.from("site_copy").upsert(rows);
    return { ok: !error };
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
  const s = await useSession<{ admin?: boolean }>(sessionConfig());
  if (!s.data.admin) return [];
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
