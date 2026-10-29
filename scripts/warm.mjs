// `npm run dev` helper: `next dev` compiles each page the first time it's opened, which makes the
// first visit to each tab take seconds. This waits for the dev server and opens the main pages
// once, so they're compiled before you click. It never fails the dev session: errors are only logged.
const base = process.env.WARM_URL || "http://localhost:3000";
const ROUTES = ["/", "/scan", "/saved", "/creditos"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ready() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(base, { method: "HEAD" });
      return true;
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

if (await ready()) {
  for (const route of ROUTES) {
    const start = Date.now();
    try {
      const response = await fetch(base + route);
      await response.arrayBuffer();
      console.log(`compiled ${route} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
    } catch (error) {
      console.log(`could not open ${route}: ${error.message}`);
    }
  }
  console.log("pages ready: switching tabs is quick from now on");
} else {
  console.log(`no dev server at ${base}; skipped`);
}
