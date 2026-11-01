import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

test('phone opens, switches the existing mode, searches a place, teleports, and fits a mobile viewport', {
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
    await page.setContent(`<!doctype html><style>${phoneCss}</style><button id="btn-phone" type="button"></button>
      <div class="hud-top-left"><div id="search-box"></div><div id="search-results"></div></div>
      <button id="btn-settings" type="button">settings</button>
      <div id="settings-panel" class="panel settings-panel" hidden><div class="toolbar"><button class="time-btn">Midday</button><button id="btn-open-map" class="tool-btn">Map</button></div><div id="camera-switch">Camera</div></div>
      <button id="btn-teleport" type="button">legacy teleport</button><div id="teleport-popover"></div><nav id="mode-switch"></nav><script>
      window.CITY = { uiOverlay: null, isTypingInField: (e) => ['INPUT','TEXTAREA'].includes(e.target?.tagName) };
      window.settingsPanelRef = document.getElementById('settings-panel');
      const place = { name: 'CN Tower', sub: 'Entertainment District', kind: 'landmark', x: -586, z: 553, landmarkId: 'cnTower' };
      let activeLease = null;
      const game = window.game = { ready: true, controllerManager: { activeMode: 'person' },
        selectMode(mode) { this.controllerManager.activeMode = mode; return true; },
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
    assert.equal(await page.evaluate(() => CITY.uiOverlay), 'phone');
    await page.getByRole('button', { name: /Garage/ }).click();
    await page.locator('.garage-option').filter({ hasText: 'Car' }).click();
    assert.equal(await page.evaluate(() => game.controllerManager.activeMode), 'car');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null, 'successful mode switch closes the phone');

    await page.locator('#btn-phone').click();
    await page.getByRole('button', { name: /Garage/ }).click();
    await page.locator('.garage-option').filter({ hasText: 'Helicopter' }).click();
    assert.equal(await page.evaluate(() => game.controllerManager.activeMode), 'helicopter');
    assert.equal(await page.evaluate(() => CITY.uiOverlay), null);

    await page.locator('#btn-phone').click();
    await page.getByRole('button', { name: /Teleport/ }).click();
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
    await page.keyboard.press('ArrowUp');
    await page.locator('#btn-settings').click();
    assert.equal(await page.evaluate(() => phone.screen), 'settings');
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), false, 'existing settings are rendered inside the phone');
    assert.equal(await page.evaluate(() => settingsPanelRef.closest('.phone-content') !== null), true);
    await page.locator('#btn-open-map').click();
    assert.equal(await page.evaluate(() => window.mapActivated), true, 'settings actions that open other overlays release the phone first');
    assert.equal(await page.evaluate(() => phone.isOpen()), false);
    await page.keyboard.press('ArrowUp');
    await page.locator('.phone-app-icon[data-app="settings"]').click();
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), false);
    await page.locator('.phone-home-bar').click();
    assert.equal(await page.evaluate(() => settingsPanelRef.hidden), true, 'settings panel hides when leaving its app');
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await page.locator('.phone-device').boundingBox();
    assert.ok(bounds && bounds.width <= 390 && bounds.height <= 844, 'phone fits the mobile viewport');
    const legacyDisplay = await page.evaluate(() => Object.fromEntries(['#search-box','#search-results','#btn-teleport','#teleport-popover','#mode-switch'].map((selector) => [selector, getComputedStyle(document.querySelector(selector)).display])));
    assert.ok(Object.values(legacyDisplay).every((display) => display === 'none'), 'legacy search, teleport and mode controls are removed from the visible HUD');
  } finally {
    await browser?.close();
  }
});
