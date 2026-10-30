const PINTEREST = /^https:\/\/([a-z]+\.)?pinterest\.[a-z.]+\//i;

/**
 * Boards and pins from the environment (apps/web/.env.local), set by the person running the site.
 * NEXT_PUBLIC_PINTEREST_BOARD takes one board or several, separated by commas.
 */
export function pinterestConfig(): { boards: string[]; pins: string[] } {
  const list = (value?: string) => (value ?? "").split(/[\s,]+/).filter(Boolean);
  const boards = list(process.env.NEXT_PUBLIC_PINTEREST_BOARD).filter((url) => PINTEREST.test(url) && !/\/pin\//i.test(url));
  const pins = list(process.env.NEXT_PUBLIC_PINTEREST_PINS).filter((url) => PINTEREST.test(url) && /\/pin\//i.test(url));
  return { boards, pins };
}
