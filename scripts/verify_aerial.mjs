import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:5173/";
const OUT = process.env.OUT || "/tmp/gta6-aerial.png";
const CAM = JSON.parse(process.env.CAM || "[0,650,500]");
const YAW = parseFloat(process.env.YAW ?? "0");
const PITCH = parseFloat(process.env.PITCH ?? "-0.91");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--window-size=1280,800"],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 3000));

const info = await page.evaluate(({ CAM, YAW, PITCH }) => {
  const g = window.__gta6;
  g.setFly(CAM, YAW, PITCH);
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9, maxY = 0;
  g.buildingWorld.group.traverse((o) => {
    if (o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      minX = Math.min(minX, b.min.x); maxX = Math.max(maxX, b.max.x);
      minZ = Math.min(minZ, b.min.z); maxZ = Math.max(maxZ, b.max.z);
      maxY = Math.max(maxY, b.max.y);
    }
  });
  return { bbox: { minX: +minX.toFixed(0), minZ: +minZ.toFixed(0), maxX: +maxX.toFixed(0), maxZ: +maxZ.toFixed(0), maxY: +maxY.toFixed(1) }, meshes: g.buildingWorld.group.children.length };
}, { CAM, YAW, PITCH });

// let the RAF loop render the new fly pose
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: OUT });
console.log("bbox/meshes:", JSON.stringify(info));
console.log("errors:", errors.length ? errors.join("\n") : "(none)");
console.log("screenshot:", OUT);
await browser.close();
