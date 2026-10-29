import { Benefits, Carousels, FinalCta, FromPinterest, Problem } from "@/components/landing/Sections";
import { PageTransition } from "@/components/motion/PageTransition";
import { Story } from "@/components/landing/Story";
import { getLanding } from "@/lib/landing-data";

// The story, page after page, alternating black and white: the promise and how it works (scroll
// story), the problem, the feed, why it helps, straight from Pinterest, your turn.
export default function Landing() {
  const { pins, explainer } = getLanding();
  return (
    <PageTransition>
      <div aria-hidden="true" className="scroll-progress" />
      <Story pins={pins} explainer={explainer} />
      <Problem />
      <Carousels pins={pins} />
      <Benefits />
      <FromPinterest />
      <FinalCta pins={pins} />
    </PageTransition>
  );
}
