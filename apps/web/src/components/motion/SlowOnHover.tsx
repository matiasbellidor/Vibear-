"use client";

import { useRef, type HTMLAttributes } from "react";

/**
 * Slows the CSS loop called `name` inside it to `rate` while a mouse is over it. playbackRate keeps
 * the loop where it is (a new duration would make it jump), and the compositor keeps running it.
 */
export function SlowOnHover({ name, rate = 0.3, ...props }: HTMLAttributes<HTMLDivElement> & { name: string; rate?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (value: number) => {
    for (const animation of ref.current?.getAnimations({ subtree: true }) ?? []) {
      if (animation instanceof CSSAnimation && animation.animationName === name) animation.updatePlaybackRate(value);
    }
  };
  return (
    <div
      ref={ref}
      onPointerEnter={(event) => event.pointerType === "mouse" && set(rate)}
      onPointerLeave={() => set(1)}
      {...props}
    />
  );
}
