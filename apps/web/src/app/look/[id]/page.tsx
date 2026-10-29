import type { Metadata } from "next";
import { Suspense } from "react";
import { LookView } from "@/components/LookView";
import { PageTransition } from "@/components/motion/PageTransition";
import { LookSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = { title: "Tu look" };

type Params = Promise<{ id: string }>;

export default function LookPage({ params }: { params: Params }) {
  return (
    <PageTransition>
      {/* The id and the selected garment (?item=, read by LookView) are known at request time only. */}
      <Suspense fallback={<LookSkeleton />}>
        <Look params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Look({ params }: { params: Params }) {
  const { id } = await params;
  return <LookView id={id} />;
}
