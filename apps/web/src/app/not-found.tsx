import { LostAndFound } from "@/components/LostAndFound";
import { PageTransition } from "@/components/motion/PageTransition";
import { PINS } from "@/lib/landing";
import { getLanding } from "@/lib/landing-data";

export default function NotFound() {
  const { pins, local } = getLanding();
  return (
    <PageTransition>
      <LostAndFound pins={local ? [...pins, ...PINS] : pins} />
    </PageTransition>
  );
}
