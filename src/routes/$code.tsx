import { createFileRoute, notFound } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";
import { getInviter } from "@/lib/guests.functions";
import { isShortInviteCode } from "@/lib/invitation-links";

export const Route = createFileRoute("/$code")({
  loader: async ({ params }) => {
    if (!isShortInviteCode(params.code)) throw notFound();
    const inviter = await getInviter({ data: { code: params.code } });
    if (!inviter) throw notFound();
    return inviter;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.firstName} te invita · Tricumple` : "Invitación personal · Tricumple";
    const description = "Vení al Tricumple de Giu, Manuch y Tincho. Confirmá tu invitación y recibí tu QR de entrada.";
    return { meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ] };
  },
  component: ShortInvitation,
});

function ShortInvitation() {
  const { code } = Route.useParams();
  const inviter = Route.useLoaderData();
  return <Invite refCode={code} inviterName={inviter.firstName} />;
}