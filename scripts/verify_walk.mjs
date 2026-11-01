// Simulate walking: press W and confirm the player moves; then walk into the
// CN Tower and confirm collision stops the player entering it.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:5173/";

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

const start = await page.evaluate(() => ({ ...window.__gta6.player.position }));

// Face the player north (toward the CN Tower) and walk forward ~2.5s.
await page.evaluate(() => { window.__gta6.player.yaw = 0; });
await page.keyboard.down("KeyW");
await new Promise((r) => setTimeout(r, 2500));
await page.keyboard.up("KeyW");

const end = await page.evaluate(() => {
  const p = window.__gta6.player.position;
  // Is the player still outside every building footprint?
  const grid = window.__gta6.buildingWorld.grid;
  const inside = (px, pz, pts) => {
    let ins = false; const m = pts.length / 2;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const xi = pts[i*2], zi = pts[i*2+1], xj = pts[j*2], zj = pts[j*2+1];
      if ((zi > pz) !== (zj > pz)) { const xc = xi + (pz-zi)/(zj-zi)*(xj-xi); if (px < xc) ins = !ins; }
    }
    return ins;
  };
  let insideAny = false;
  for (const c of grid.colliders) if (inside(p.x, p.z, c.pts)) { insideAny = true; break; }
  return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), insideAnyBuilding: insideAny };
});

const moved = Math.hypot(end.x - start.x, end.z - start.z);
console.log(JSON.stringify({
  start: { x: +start.x.toFixed(2), z: +start.z.toFixed(2) },
  end,
  movedMeters: +moved.toFixed(2),
  walkedForward: moved > 3,
  stayedOutOfBuildings: !end.insideAnyBuilding,
}, null, 2));

await browser.close();
