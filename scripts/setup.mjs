// One-time setup: npm packages, the API's Python virtualenv, local .env files and the test browser.
// Safe to run again: every step skips or updates what already exists.
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apiDir, defaultVenv, findPython, root, venvPython } from "./python.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(title, command, args, options = {}) {
  console.log(`\n▸ ${title}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...options });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${title}`);
    process.exit(result.status ?? 1);
  }
}

function systemPython() {
  for (const [command, args] of [["python3", []], ["python", []], ["py", ["-3"]]]) {
    const probe = spawnSync(command, [...args, "-c", "import sys; print(sys.version_info >= (3, 11))"], {
      encoding: "utf8",
    });
    if (probe.status === 0 && probe.stdout.trim() === "True") return [command, args];
  }
  return null;
}

run("Installing npm packages", npm, ["install"]);

let python = findPython();
if (python) {
  console.log(`\n▸ Using the existing virtualenv: ${python}`);
} else {
  const found = systemPython();
  if (!found) {
    console.error("\n✗ Python 3.11+ is required for the API: https://www.python.org/downloads/");
    process.exit(1);
  }
  const [command, args] = found;
  run(`Creating the virtualenv at ${defaultVenv}`, command, [...args, "-m", "venv", defaultVenv], { shell: false });
  python = venvPython(defaultVenv);
}

if (process.platform === "linux") {
  // The default Linux torch wheel bundles CUDA (several GB); the API runs on CPU.
  run("Installing CPU-only torch", python, [
    "-m", "pip", "install", "--index-url", "https://download.pytorch.org/whl/cpu", "torch", "torchvision",
  ], { shell: false });
}
run("Installing API dependencies (first time: several minutes)", python, [
  "-m", "pip", "install", "-r", join(apiDir, "requirements-dev.txt"),
], { shell: false });

const env = join(apiDir, ".env");
if (!existsSync(env)) {
  copyFileSync(join(apiDir, ".env.example"), env);
  console.log("\n▸ Created apps/api/.env (demo search on; add SERPAPI_API_KEY for real products)");
} else if (!/^DEMO_SEARCH=/m.test(readFileSync(env, "utf8"))) {
  // .env files from before demo mode existed: add the flag, leave everything else untouched.
  appendFileSync(env, "\n# Added by npm run setup: results from your own photos until SERPAPI_API_KEY is set.\nDEMO_SEARCH=true\n");
  console.log("\n▸ Added DEMO_SEARCH=true to apps/api/.env");
}

run("Installing the browser for end-to-end tests", npx, ["playwright", "install", "chromium"], {
  cwd: join(root, "apps", "web"),
});

console.log("\n✓ Ready. Start everything with: npm run dev  →  http://localhost:3000");
