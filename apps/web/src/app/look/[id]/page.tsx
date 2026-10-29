import type { Metadata } from "next";
import { Suspense } from "react";
import { LookView } from "@/components/LookView";
import { LookSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = { title: "Tu look" };

export default async function LookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // useSearchParams (the selected garment lives in ?item=) needs a Suspense boundary.
    <Suspense fallback={<LookSkeleton />}>
      <LookView id={id} />
    </Suspense>
  );
}
