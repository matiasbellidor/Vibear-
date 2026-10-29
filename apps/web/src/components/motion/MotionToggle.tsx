"use client";

import { useEffect } from "react";
import { useMotionPreference } from "@/lib/storage";
import { cx, textButton } from "../ui";

/** Visible pause control for every loop on the page (WCAG 2.2.2). Lives on the landing. */
export function MotionToggle({ className }: { className?: string }) {
  const [motion, setMotion] = useMotionPreference();
  const paused = motion === "paused";

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, [motion]);

  return (
    <button
      type="button"
      onClick={() => setMotion(paused ? "running" : "paused")}
      className={cx(textButton, "text-muted", className)}
    >
      {paused ? "Reanudar movimiento" : "Pausar movimiento"}
    </button>
  );
}
