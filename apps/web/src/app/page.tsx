import { Benefits, Carousels, FinalCta, FromPinterest, Problem } from "@/components/landing/Sections";
import { WeeklyOutfits } from "@/components/landing/WeeklyOutfits";
import { PageTransition } from "@/components/motion/PageTransition";
import { Story } from "@/components/landing/Story";
import { PINS } from "@/lib/landing";
import { getLanding } from "@/lib/landing-data";

// The story, page after page, alternating black and white: the promise and how it works (scroll
// story), the problem, the feed, why it helps, the week's outfits (and a fragrance), straight from
// Pinterest, your turn.
export default function Landing() {
  const { pins, explainer, local } = getLanding();
  // Your own photos lead the outfits in dev; the published ones fill in (your board may be all menswear).
  const outfits = local ? [...pins, ...PINS] : pins;
  return (
    <PageTransition>
      <div aria-hidden="true" className="scroll-progress" />
      <Story pins={pins} explainer={explainer} />
      <Problem />
      <Carousels pins={pins} />
      <Benefits />
      <WeeklyOutfits pins={outfits} />
      <FromPinterest />
      <FinalCta pins={pins} />
    </PageTransition>
  );
}
