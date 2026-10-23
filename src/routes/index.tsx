import { createFileRoute } from "@tanstack/react-router";
import { Invite } from "@/components/Invite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tricumple · Giuli, Manu y Martín" },
      { name: "description", content: "Estás invitad@ al tricumple de Giuli, Manuela y Martín. Confirmá y llevate tu QR." },
      { property: "og:title", content: "Tricumple · Giuli, Manu y Martín" },
      { property: "og:description", content: "Confirmá tu lugar y llevate tu QR de entrada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Invite mainPoster />,
});
