// Locates the project's Python virtualenv. Kept outside the repo by default: torch is ~1 GB of
// small files, which cloud-synced folders (OneDrive, Dropbox) handle badly.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const apiDir = join(root, "apps", "api");

const isWindows = process.platform === "win32";

/** Where `npm run setup` creates the venv: $VIBEAR_VENV, or ~/.venvs/vibear. */
export const defaultVenv = process.env.VIBEAR_VENV || join(homedir(), ".venvs", "vibear");

const candidates = [
  defaultVenv,
  join(apiDir, ".venv"),
  ...(isWindows ? ["C:\\dev\\venvs\\vibear"] : []), // location suggested by earlier versions of the README
];

export function venvPython(venv) {
  return isWindows ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
}

/** The first existing venv's python, or null. */
export function findPython() {
  for (const venv of candidates) {
    if (existsSync(venvPython(venv))) return venvPython(venv);
  }
  return null;
}
