// `node scripts/api.mjs dev` runs the API and restarts it when a .py file changes;
// `node scripts/api.mjs test` runs pytest.
//
// Why not `uvicorn --reload`: on Windows it restarts the worker with CTRL_C_EVENT, which reaches every
// process on the console, so under `npm run dev` it would also kill Next. Restarting from here works
// the same on every OS.
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { join } from "node:path";
import { apiDir, findPython } from "./python.mjs";

const mode = process.argv[2];
if (!["dev", "test", "photos"].includes(mode)) {
  console.error("Usage: node scripts/api.mjs dev|test|photos");
  process.exit(2);
}

const python = findPython();
if (!python) {
  console.error("No Python virtualenv found for the API. Run `npm run setup` first (or set VIBEAR_VENV).");
  process.exit(1);
}

if (mode === "test" || mode === "photos") {
  // photos: build the landing from apps/web/local-photos (shown by `npm run dev` only).
  const args =
    mode === "test"
      ? ["-m", "pytest", "-q"]
      : ["scripts/build_landing_assets.py", "--local", join(apiDir, "..", "web", "local-photos")];
  const child = spawn(python, args, { cwd: apiDir, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  const port = process.env.API_PORT || "8000";
  const args = ["-m", "uvicorn", "app.main:create_app", "--factory", "--port", port];
  let child;
  let restarting = false;
  let stopping = false;

  const start = () => {
    child = spawn(python, args, { cwd: apiDir, stdio: "inherit" });
    child.on("exit", (code) => {
      if (stopping) process.exit(0);
      if (restarting) {
        restarting = false;
        start();
      } else {
        // A crash (e.g. a syntax error) should not take the web app down with it.
        console.error(`\n[api] exited with code ${code}. Fix the error and save a .py file to restart.`);
        child = null;
      }
    });
  };

  let timer;
  watch(join(apiDir, "app"), { recursive: true }, (_event, file) => {
    if (!file?.endsWith(".py")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n[api] ${file} changed, restarting (models take ~20 s to load)…`);
      if (!child) return start();
      restarting = true;
      child.kill();
    }, 300);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopping = true;
      if (!child) process.exit(0);
      child.kill();
    });
  }

  start();
}
