import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getCopy } from "@/lib/guests.functions";

const SITE = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const OG_IMAGE = `${SITE}/og.png`;
export const Route = createFileRoute("/")({
  loader: () => getCopy(),
  head: () => ({
    meta: [
      { title: "Tricumple · Giuli, Manu y Martín" },
      { name: "description", content: "Sábado 7/11 · 1:30 hs · Niceto Vega 5635 · Barra libre $15.000. Confirmá tu lugar y llevate tu QR." },
      { property: "og:title", content: "Tricumple · Giuli, Manu y Martín" },
      { property: "og:description", content: "Sáb 7/11 · 1:30 hs · Niceto Vega 5635 · Barra libre. Confirmá tu lugar y llevate tu QR." },
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
