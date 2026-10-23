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
- Define the reusable blurred-print SVG filter once inside the main-screen presentation and reference it from scoped CSS to keep all printed edges consistent.
- Extend generated database types in src/lib/database.ts for existing migration-backed tables omitted by the managed generator; keep generated files untouched and remove the extension when generation includes those tables.
