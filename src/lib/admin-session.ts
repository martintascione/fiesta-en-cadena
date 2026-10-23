// Partition the secure session cookie so embedded previews retain it without
// sharing the session with unrelated top-level sites.
export const adminSessionCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  partitioned: true,
  path: "/",
};