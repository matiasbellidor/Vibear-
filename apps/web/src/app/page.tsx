import {
  Benefits,
  Carousels,
  FinalCta,
  FromPinterest,
  Hero,
  HowItWorks,
  Problem,
} from "@/components/landing/Sections";
import { getLanding } from "@/lib/landing-data";

// The story, top to bottom: the promise, the problem, the feed, straight from Pinterest,
// how it works, why it helps, your turn.
export default function Landing() {
  const { pins, explainer } = getLanding();
  return (
    <>
      <Hero pins={pins} />
      <Problem />
      <Carousels pins={pins} />
      <FromPinterest />
      <HowItWorks explainer={explainer} />
      <Benefits />
      <FinalCta pins={pins} />
    </>
  );
}
