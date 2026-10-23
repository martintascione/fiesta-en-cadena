import { describe, expect, it, vi, beforeEach } from "vitest";
import { groupCommunitySongs } from "@/lib/community-songs";

const mocks = vi.hoisted(() => ({ authorized: false, eq: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ useSession: async () => ({ data: { admin: mocks.authorized } }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { adminRemoveSong } from "@/lib/guests.functions";

describe("Community playlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized = false;
    mocks.eq.mockResolvedValue({ error: null });
    mocks.remove.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ delete: mocks.remove });
  });
  it("shows saved tracks once, counts requests and never exposes guest details", () => {
    const row = { spotify_id: "track1", title: "Tema", artist: "Artista", cover_url: null, guest_id: "private-id", email: "private@example.com" };
    expect(groupCommunitySongs([row, row])).toEqual([{ id: "track1", title: "Tema", artist: "Artista", cover: null, requests: 2 }]);
  });
  it("does not let a signed-out visitor delete songs", async () => {
    const result = await adminRemoveSong({ data: { spotifyId: "track1" } });
    expect(result.ok).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("lets the admin delete every request for the selected track only", async () => {
    mocks.authorized = true;
    const result = await adminRemoveSong({ data: { spotifyId: "track1" } });
    expect(result.ok).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("song_requests");
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith("spotify_id", "track1");
  });
  it("reports failure when deletion fails", async () => {
    mocks.authorized = true;
    mocks.eq.mockResolvedValue({ error: { message: "failed" } });
    expect((await adminRemoveSong({ data: { spotifyId: "track1" } })).ok).toBe(false);
  });
});