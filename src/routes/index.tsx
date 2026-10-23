import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getCopy } from "@/lib/guests.functions";
import { communitySongsOptions } from "@/components/CommunityPlaylist";

const SITE = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const OG_IMAGE = `${SITE}/og.png`;
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [copy] = await Promise.all([getCopy(), context.queryClient.ensureQueryData(communitySongsOptions)]);
    return copy;
  },
  head: () => ({
    meta: [
      { title: "Tricumple · Giu, Manuch y Tincho" },
      { name: "description", content: "Sábado 7/11 · 1:30 hs · Niceto Vega 5635 · Barra libre. Confirmá tu lugar y llevate tu QR." },
      { property: "og:title", content: "Tricumple · Giu, Manuch y Tincho" },
      { property: "og:description", content: "Sáb 7/11 · 1:30 hs · Niceto Vega 5635 · Barra libre · DJ invitado. Confirmá tu lugar y llevate tu QR." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Invite mainPoster copy={Route.useLoaderData()} />,
});
