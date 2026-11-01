// Headless smoke test: load the app in Chrome, capture console/page errors,
// confirm the world built, and save a screenshot.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL || "http://localhost:5173/";
const OUT = process.env.OUT || "/tmp/gta6-screenshot.png";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1280,800"],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const errors = [];
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("requestfailed", (r) => errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));

await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });

// Wait for the world to build and the loop to run a bit.
await new Promise((r) => setTimeout(r, 3500));

const state = await page.evaluate(() => {
  const g = window.__gta6;
  if (!g) return { ready: false };
  return {
    ready: true,
    buildings: g.buildingWorld.count,
    buildingMeshes: g.buildingWorld.group.children.length,
    roads: g.roadWorld.count,
    roadMeshes: g.roadWorld.group.children.length,
    sceneChildren: g.scene.children.length,
    spawn: g.manifest.spawn,
    camPos: g.camera.position.toArray().map((n) => +n.toFixed(1)),
    playerPos: g.player.position.toArray().map((n) => +n.toFixed(1)),
    colliders: g.buildingWorld.grid.colliders.length,
  };
});

// Read HUD values from the DOM.
const hud = await page.evaluate(() => ({
  fps: document.getElementById("fps-v")?.textContent,
  bldg: document.getElementById("bldg-count")?.textContent,
  chunk: document.getElementById("chunk-id")?.textContent,
  cam: document.getElementById("cam-mode")?.textContent,
  posY: document.getElementById("pos-y")?.textContent,
}));

await page.screenshot({ path: OUT });

console.log("=== WORLD STATE ===");
console.log(JSON.stringify(state, null, 2));
console.log("=== HUD ===");
console.log(JSON.stringify(hud, null, 2));
console.log("=== ERRORS ===");
console.log(errors.length ? errors.join("\n") : "(none)");
console.log("=== CONSOLE (last 15) ===");
console.log(logs.slice(-15).join("\n"));
console.log("=== SCREENSHOT ===", OUT);

await browser.close();
process.exit(errors.length ? 1 : 0);
