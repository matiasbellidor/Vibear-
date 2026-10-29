import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { SavedBoard } from "@/components/SavedBoard";
import { getLanding } from "@/lib/landing-data";
import { boardPreviewFrom } from "@/lib/landing-picks";

export const metadata: Metadata = { title: "Guardados" };

export default function SavedPage() {
  return (
    <PageTransition>
      <SavedBoard preview={boardPreviewFrom(getLanding().pins)} />
    </PageTransition>
  );
}
