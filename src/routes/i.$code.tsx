import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getInviter } from "@/lib/guests.functions";

const SITE = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const OG_IMAGE = `${SITE}/og.png`;
export const Route = createFileRoute("/i/$code")({
  loader: ({ params }) => getInviter({ data: { code: params.code } }),
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.firstName} te invita al Tricumple` : "Te invitaron al Tricumple";
    return {
      meta: [
        { title: t },
        { name: "description", content: "Giu, Manuch y Tincho festejan juntos. Sáb 7/11 · 1:30 hs · Niceto Vega 5635. Confirmá y llevate tu QR." },
        { property: "og:title", content: t },
        { property: "og:description", content: "Confirmá tu lugar y llevate tu QR de entrada." },
        { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: RefPage,
});

function RefPage() {
  const { code } = Route.useParams();
  const inviter = Route.useLoaderData();
  return <Invite refCode={inviter ? code : undefined} inviterName={inviter?.firstName} />;
}
