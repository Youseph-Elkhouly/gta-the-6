import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

test('phone summons vehicles without entering them, searches places, teleports, and fits a mobile viewport', {
  skip: !fs.existsSync(chromium.executablePath()) ? 'Playwright Chromium is not installed' : false,
  timeout: 20000
}, async () => {
  const phoneScript = new URL('../js/phone.js', import.meta.url);
  const phoneCss = fs.readFileSync(new URL('../css/phone.css', import.meta.url), 'utf8');
  assert.ok(fs.existsSync(phoneScript));
  let browser;
  try {
    browser = await chromium.launch({ args: ['--disable-gpu', '--disable-software-rasterizer'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(2500);
    await page.setContent(`<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(ellipse at 20% 15%,#849b84,#263a3a 54%,#101b20)}${phoneCss}</style><button id="btn-phone" type="button"></button>
      <div class="hud-top-left"><div id="search-box"></div><div id="search-results"></div></div>
      <button id="btn-settings" type="button">settings</button>
      <div id="settings-panel" class="panel settings-panel" hidden><div class="toolbar"><button class="time-btn">Midday</button><button id="btn-open-map" class="tool-btn">Map</button></div><div id="camera-switch">Camera</div></div>
      <button id="btn-teleport" type="button">legacy teleport</button><div id="teleport-popover"></div><nav id="mode-switch"></nav><script>
      window.CITY = { uiOverlay: null, isTypingInField: (e) => ['INPUT','TEXTAREA'].includes(e.target?.tagName) };
      window.settingsPanelRef = document.getElementById('settings-panel');
      const place = { name: 'CN Tower', sub: 'Entertainment District', kind: 'landmark', x: -586, z: 553, landmarkId: 'cnTower' };
      let activeLease = null;
      let vehicleId = 0;
      const game = window.game = { ready: true, controllerManager: { activeMode: 'person', worldVehicles: new Map() },
        summonVehicle(type) {
          for (const [id, v] of this.controllerManager.worldVehicles) if (v.type === type) this.controllerManager.worldVehicles.delete(id);
          const id = 'summoned-' + type + '-' + (++vehicleId);
          this.controllerManager.worldVehicles.set(id, { id, type, source: 'summoned', occupied: false });
          return { ok: true };
        },
        tourGuide: { search(q) { return q.toLowerCase().includes('cn') || q.toLowerCase().includes('tower') ? [place] : []; },
          teleportToPlace(p) { window.lastTeleport = p; return { x: p.x, z: p.z }; } },
        openOverlay(id, options) { if (activeLease) return false; CITY.uiOverlay = id;
          const lease = { release() { if (activeLease !== lease) return false; activeLease = null; CITY.uiOverlay = null; options.onClose?.(); return true; } };
          activeLease = lease; return lease; }
      };
      window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && activeLease) activeLease.release(); });
      document.getElementById('btn-open-map').addEventListener('click', () => { window.mapActivated = CITY.uiOverlay === null; });
    </script>`);
    await page.addScriptTag({ path: phoneScript.pathname });
    await page.evaluate(() => {
      window.phone = CITY.createPhoneManager(game);
      document.getElementById('btn-settings').addEventListener('click', () => phone.open('settings'));
    });

    await page.keyboard.press('ArrowUp');
    await page.locator('.phone-overlay.is-open').waitFor();
    if (process.env.PHONE_PREVIEW_PATH) { await page.waitForTimeout(450); await page.screenshot({ path: process.env.PHONE_PREVIEW_PATH }); }
    assert.equal(await page.evaluate(() => CITY.uiOverlay), 'phone');
    assert.equal(await page.evaluate(() => phone.screen), 'home', 'the phone opens to its home screen');
    assert.deepEqual(await page.locator('.phone-app-icon .phone-app-name').allInnerTexts(), ['Garage', 'Teleport']);
    await page.locator('.phone-app-icon[data-app="garage"]').click();
    assert.equal(await page.evaluate(() => phone.screen), 'garage', 'Garage opens the vehicle picker');
    await page.locator('.garage-option').filter({ hasText: 'Car' }).click();
    assert.equal(await page.evaluate(() => game.controllerManager.activeMode), 'person', 'Garage keeps the player on foot');
    assert.equal(await page.evaluate(() => game.controllerManager.worldVehicles.size), 1, 'Garage summons a world vehicle');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null, 'successful summon closes the phone');

    await page.locator('#btn-phone').click();
    await page.locator('.phone-app-icon[data-app="garage"]').click();
    await page.locator('.garage-option').filter({ hasText: 'Helicopter' }).click();
    assert.equal(await page.evaluate(() => game.controllerManager.activeMode), 'person');
    assert.equal(await page.evaluate(() => game.controllerManager.worldVehicles.size), 2, 'a helicopter can coexist with the car');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null);

    await page.locator('#btn-phone').click();
    await page.locator('.phone-app-icon[data-app="teleport"]').click();
    const search = page.getByRole('searchbox', { name: 'Search Toronto destinations' });
    await search.fill('unlisted moon base');
    await page.getByText(/No matches in the city map/).waitFor();
    await search.fill('CN Tower');
    await page.locator('.phone-result').click();
    await page.getByRole('button', { name: 'Go to CN Tower' }).click();
    assert.equal(await page.evaluate(() => window.lastTeleport?.landmarkId), 'cnTower');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null, 'successful teleport closes the phone');

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null, 'Escape releases the phone overlay');
    await page.locator('#btn-settings').click();
    assert.equal(await page.evaluate(() => phone.screen), 'settings');
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), false, 'existing settings are rendered inside the phone');
    assert.equal(await page.evaluate(() => settingsPanelRef.closest('.phone-content') !== null), true);
    await page.locator('#btn-open-map').click();
    assert.equal(await page.evaluate(() => window.mapActivated), true, 'settings actions that open other overlays release the phone first');
    assert.equal(await page.evaluate(() => phone.isOpen()), false);
    await page.locator('#btn-settings').click();
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), false);
    await page.locator('.phone-nav-home').click();
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), true, 'settings panel hides when leaving its app');
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await page.locator('.phone-device').boundingBox();
    assert.ok(bounds && bounds.width <= 390 && bounds.height <= 844, 'phone fits the mobile viewport');
    const legacyDisplay = await page.evaluate(() => Object.fromEntries(['#search-box','#search-results','#btn-teleport','#teleport-popover'].map((selector) => [selector, getComputedStyle(document.querySelector(selector)).display])));
    assert.ok(Object.values(legacyDisplay).every((display) => display === 'none'), 'legacy search and teleport controls are removed from the visible HUD');
    assert.equal(await page.locator('#mode-switch').count(), 0, 'direct HUD vehicle switching is removed; vehicles enter through world interaction');
  } finally {
    await browser?.close();
  }
});
