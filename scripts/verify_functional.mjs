// Functional checks: building collision resolution + click-to-inspect picking.
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

const results = await page.evaluate(() => {
  const g = window.__gta6;
  const THREE = g.THREE;
  const out = {};

  // ---- Collision test: centroid of a building is "inside"; resolve must push the circle out. ----
  const col = g.buildingWorld.grid.colliders[0];
  let cx = 0, cz = 0;
  const n = col.pts.length / 2;
  for (let i = 0; i < n; i++) { cx += col.pts[i * 2]; cz += col.pts[i * 2 + 1]; }
  cx /= n; cz /= n;
  const res = { x: 0, z: 0 };
  const collided = g.buildingWorld.grid.resolve(cx, cz, 0.45, res);
  const moved = Math.hypot(res.x - cx, res.z - cz);
  out.collision = { collided, movedOutMeters: +moved.toFixed(2) };

  // Verify the resolved point is actually OUTSIDE that polygon (point-in-polygon).
  const inside = (px, pz, pts) => {
    let ins = false;
    const m = pts.length / 2;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1];
      if ((zi > pz) !== (zj > pz)) {
        const xc = xi + (pz - zi) / (zj - zi) * (xj - xi);
        if (px < xc) ins = !ins;
      }
    }
    return ins;
  };
  out.collision.startedInside = inside(cx, cz, col.pts);
  out.collision.endedInside = inside(res.x, res.z, col.pts);

  // ---- Free pass-through test: a point far from any building should be unchanged. ----
  const free = { x: 0, z: 0 };
  const farCollided = g.buildingWorld.grid.resolve(5000, 5000, 0.45, free);
  out.freeSpace = { collided: farCollided, x: free.x, z: free.z };

  // ---- Picking test: aim a ray at a building from outside and resolve its id/metadata. ----
  // Use the tallest building (CN Tower) centroid; shoot a ray at it from 300m south, 120m up.
  let tallest = null;
  for (const b of g.buildingWorld.meta.values()) if (!tallest || b.h > tallest.h) tallest = b;
  const tr = tallest.rings[0];
  let tx = 0, tz = 0; const tn = tr.length / 2;
  for (let i = 0; i < tn; i++) { tx += tr[i * 2]; tz += tr[i * 2 + 1]; }
  tx /= tn; tz /= tn;

  const origin = new THREE.Vector3(tx, 120, tz + 300);
  const dir = new THREE.Vector3(tx - origin.x, 60 - origin.y, tz - origin.z).normalize();
  const ray = new THREE.Raycaster(origin, dir, 0.1, 2000);
  const hits = ray.intersectObject(g.buildingWorld.group, true);
  if (hits.length) {
    const h = hits[0];
    const id = g.buildingWorld.pickTriangle(h.object, h.faceIndex);
    const feat = id ? g.buildingWorld.meta.get(id) : null;
    out.pick = { hit: true, id, height: feat ? feat.h : null, matchesTallest: id === tallest.id, tallestH: tallest.h };
  } else {
    out.pick = { hit: false };
  }

  return out;
});

console.log(JSON.stringify(results, null, 2));
await browser.close();
