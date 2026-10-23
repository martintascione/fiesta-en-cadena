import { describe, expect, it } from "vitest";
import { invitationLink, isShortInviteCode, inviterCodeColumn } from "@/lib/invitation-links";

describe("Guest invitation links", () => {
  it("uses our domain followed directly by the dynamic four-digit code", () => {
    expect(invitationLink("1234")).toBe("https://teinvitoamifiesta.app/1234");
    expect(invitationLink("5678")).toBe("https://teinvitoamifiesta.app/5678");
  });
  it("requires exactly four numeric digits and retains leading zeroes", () => {
    expect(invitationLink("0012")).toBe("https://teinvitoamifiesta.app/0012");
    for (const code of ["123", "12345", "abcd", "12a4"]) {
      expect(isShortInviteCode(code)).toBe(false);
      expect(() => invitationLink(code)).toThrow();
    }
  });
  it("resolves short codes separately while preserving legacy inviter codes", () => {
    expect(inviterCodeColumn("1234")).toBe("share_code");
    expect(inviterCodeColumn("abc2345")).toBe("invite_code");
  });
});