"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";

/**
 * Sets data-inview on its element so the .motion-loop animations inside pause off-screen.
 * With `restart`, time-based animations start over each time the section comes back into view,
 * so a timeline explainer always begins at step one.
 */
export function InView({ restart = false, children, ...props }: HTMLAttributes<HTMLDivElement> & { restart?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (!restart || !entry.isIntersecting) return;
        for (const animation of element.getAnimations({ subtree: true })) {
          // Scroll-driven animations have their own timeline; only rewind the clock-based ones.
          if (animation.timeline === document.timeline) animation.currentTime = 0;
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [restart]);

  return (
    <div ref={ref} data-inview={inView} {...props}>
      {children}
    </div>
  );
}
