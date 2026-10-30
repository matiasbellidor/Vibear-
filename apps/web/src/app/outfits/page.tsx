import type { Metadata } from "next";
import { FittingRoom } from "@/components/fitting/FittingRoom";
import { PageTransition } from "@/components/motion/PageTransition";

export const metadata: Metadata = { title: "Outfits" };

export default function OutfitsPage() {
  return (
    <PageTransition>
      <FittingRoom />
    </PageTransition>
  );
}
