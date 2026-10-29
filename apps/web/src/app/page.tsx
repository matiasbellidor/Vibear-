import { Benefits, Carousels, FinalCta, Hero, HowItWorks, Problem } from "@/components/landing/Sections";

// The story, top to bottom: the promise, the problem, the feed, how it works, why it helps, your turn.
export default function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <Carousels />
      <HowItWorks />
      <Benefits />
      <FinalCta />
    </>
  );
}
