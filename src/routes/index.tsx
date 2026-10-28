import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getCopy, getConfirmedCount } from "@/lib/guests.functions";
import { communitySongsOptions } from "@/components/CommunityPlaylist";

const SITE = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const OG_IMAGE = `${SITE}/og.png`;
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [copy, confirmed] = await Promise.all([getCopy(), getConfirmedCount(), context.queryClient.ensureQueryData(communitySongsOptions)]);
    return { copy, confirmed };
  },
  head: () => ({
    meta: [
      { title: "Tricumple · Giu, Manuch y Tincho" },
      { name: "description", content: "Viernes 6/11 · 1:30 hs · Niceto Vega 5635 · Barra libre. Confirmá tu lugar y llevate tu QR." },
      { property: "og:title", content: "Tricumple · Giu, Manuch y Tincho" },
      { property: "og:description", content: "Vie 6/11 · 1:30 hs · Niceto Vega 5635 · Barra libre · DJ invitado. Confirmá tu lugar y llevate tu QR." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => { const d = Route.useLoaderData(); return <Invite mainPoster copy={d.copy} confirmedCount={d.confirmed} />; },
});
