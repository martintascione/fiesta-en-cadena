<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the main-screen poster presentation opt-in on Invite; referral screens and accepted-ticket logic stay unchanged so visual redesigns do not alter guest flows.
- The main-screen poster (`poster-night` styles) uses a strict black / off-white / cobalt-blue palette with Poppins + Instrument Serif; keep new elements inside that palette. Editable copy lives in `site_copy` (see `src/lib/copy.ts`).
- Extend generated database types in src/lib/database.ts for existing migration-backed tables omitted by the managed generator; keep generated files untouched and remove the extension when generation includes those tables.
- Admin encrypted sessions use secure HttpOnly partitioned SameSite=None cookies so authentication survives inside cross-site preview frames; CSRF middleware remains enabled.
