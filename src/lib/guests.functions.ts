import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GuestDTO = { fullName: string; email: string; inviteCode: string; qrToken: string };

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
      return { fullName: existing.full_name, email: existing.email, inviteCode: existing.invite_code, qrToken: existing.qr_token };
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
    return { fullName: g.full_name, email: g.email, inviteCode: g.invite_code, qrToken: g.qr_token };
  });

export const findGuest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }): Promise<GuestDTO | null> => {
    const db = await admin();
    const { data: g } = await db.from("guests").select("*").eq("email", data.email).maybeSingle();
    return g ? { fullName: g.full_name, email: g.email, inviteCode: g.invite_code, qrToken: g.qr_token } : null;
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
  .inputValidator((d) => z.object({ password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected || !(await matches(data.password, expected))) return { ok: false };
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
  const { data } = await db.from("guests").select("id, full_name, email, invited_by, created_at").order("created_at");
  const rows = data ?? [];
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
    })),
  };
});
