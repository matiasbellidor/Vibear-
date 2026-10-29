import type { Metadata } from "next";
import { SavedBoard } from "@/components/SavedBoard";

export const metadata: Metadata = { title: "Guardados" };

export default function SavedPage() {
  return <SavedBoard />;
}
