import type { Metadata } from "next";
import { SavedBoard } from "@/components/SavedBoard";
import { getLanding } from "@/lib/landing-data";
import { boardPreviewFrom } from "@/lib/landing-picks";

export const metadata: Metadata = { title: "Guardados" };

export default function SavedPage() {
  return <SavedBoard preview={boardPreviewFrom(getLanding().pins)} />;
}
