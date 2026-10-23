import { describe, expect, it } from "vitest";
import { adminSessionCookie } from "@/lib/admin-session";

describe("Admin session in embedded preview", () => {
  it("permits the secure cookie in a cross-site frame", () => {
    expect(adminSessionCookie.sameSite).toBe("none");
    expect(adminSessionCookie.secure).toBe(true);
  });

  it("isolates the session by top-level site and from browser scripts", () => {
    expect(adminSessionCookie.partitioned).toBe(true);
    expect(adminSessionCookie.httpOnly).toBe(true);
  });
});