import type { CSSProperties } from "react";
import { cx } from "../ui";

type Line = { text: string; className?: string };

/** Lines whose words rise out of a mask on load, one after another (CSS only, see .kinetic-word). */
export function KineticText({ lines }: { lines: Line[] }) {
  const words = lines.map((line) => line.text.split(" "));
  const offsets = words.map((_, l) => words.slice(0, l).reduce((count, w) => count + w.length, 0));

  return lines.map((line, l) => (
    <span key={line.text} className={cx("block", line.className)}>
      {words[l].map((word, w) => (
        <span key={`${word}-${w}`}>
          <span className="kinetic-mask">
            <span className="kinetic-word" style={{ "--i": offsets[l] + w } as CSSProperties}>
              {word}
            </span>
          </span>
          {w < words[l].length - 1 && " "}
        </span>
      ))}
    </span>
  ));
}
