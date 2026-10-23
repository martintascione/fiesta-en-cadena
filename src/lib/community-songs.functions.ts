import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/lib/database";
import { groupCommunitySongs } from "@/lib/community-songs";

export const publicSongs = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("No pudimos cargar los temas");
  const db = createClient<AppDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await db.from("song_requests").select("spotify_id, title, artist, cover_url, created_at").order("created_at", { ascending: false });
  if (error) throw new Error("No pudimos cargar los temas");
  return groupCommunitySongs(data ?? []);
});