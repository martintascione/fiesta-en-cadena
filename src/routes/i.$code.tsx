import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getInviter } from "@/lib/guests.functions";

export const Route = createFileRoute("/i/$code")({
  loader: ({ params }) => getInviter({ data: { code: params.code } }),
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.firstName} te invita al Tricumple` : "Te invitaron al Tricumple";
    return {
      meta: [
        { title: t },
        { name: "description", content: "Giuli, Manuela y Martín festejan juntos. Confirmá y llevate tu QR." },
        { property: "og:title", content: t },
        { property: "og:description", content: "Confirmá tu lugar y llevate tu QR de entrada." },
        { property: "og:type", content: "website" },
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
