/** Board and pins from the environment (apps/web/.env.local), set by the person running the site. */
export function pinterestConfig(): { board?: string; pins: string[] } {
  const board = process.env.NEXT_PUBLIC_PINTEREST_BOARD?.trim() || undefined;
  const pins = (process.env.NEXT_PUBLIC_PINTEREST_PINS ?? "")
    .split(/[\s,]+/)
    .filter((url) => /^https:\/\/([a-z]+\.)?pinterest\.[a-z.]+\/pin\//i.test(url));
  return { board: board && /^https:\/\/([a-z]+\.)?pinterest\.[a-z.]+\//i.test(board) ? board : undefined, pins };
}
