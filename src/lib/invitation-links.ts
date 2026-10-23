export const INVITATION_ORIGIN = "https://teinvitoamifiesta.app";

export function isShortInviteCode(code: string): boolean {
  return /^[0-9]{4}$/.test(code);
}

export function invitationLink(code: string): string {
  if (!isShortInviteCode(code)) throw new Error("Código de invitación inválido");
  return `${INVITATION_ORIGIN}/${code}`;
}

export function inviterCodeColumn(code: string): "share_code" | "invite_code" {
  return isShortInviteCode(code) ? "share_code" : "invite_code";
}