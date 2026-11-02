// The in-game handset is an interface over the existing controller and tour-guide APIs.
(function () {
  const VEHICLES = [
    { id: 'car', label: 'Car', detail: 'Summon nearby', icon: '▰', color: 'car' },
    { id: 'cyclist', label: 'Bicycle', detail: 'Summon nearby', icon: '◉', color: 'bike' },
    { id: 'helicopter', label: 'Helicopter', detail: 'Summon in open space', icon: '✣', color: 'heli' }
  ];
  const QUICK_DESTINATIONS = ['CN Tower', 'Rogers Centre', 'Union Station', 'Nathan Phillips Square', 'Dundas Square'];
  const APPS = [
    { id: 'garage', name: 'Garage', color: 'garage', icon: '<svg viewBox="0 0 64 64"><path d="m8 37 4-13a5 5 0 0 1 5-4h30a5 5 0 0 1 5 4l4 13v14h-6v-5H14v5H8z"/><path d="M10 37h44M18 29h28"/><circle cx="18" cy="39" r="3"/><circle cx="46" cy="39" r="3"/></svg>' },
    { id: 'teleport', name: 'Teleport', color: 'teleport', icon: '<svg viewBox="0 0 64 64"><circle cx="28" cy="29" r="21"/><path d="M7 29h42M28 8c8 7 12 14 12 21s-4 14-12 21M28 8c-8 7-12 14-12 21s4 14 12 21M45 46l13 13m-12-18v11h11"/></svg>' }
  ];

  function createPhoneManager(game) {
    const launcher = document.getElementById('btn-phone');
    if (!launcher) return null;
    const settingsPanel = document.getElementById('settings-panel');
    const root = document.createElement('section');
    root.className = 'phone-overlay';
    root.id = 'game-phone';
    root.hidden = true;
    root.setAttribute('aria-label', 'In-game smartphone');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="phone-device">
        <div class="phone-top-bezel"><svg class="phone-brand-mark" viewBox="0 0 16 16" aria-hidden="true"><text x="8" y="13" text-anchor="middle" fill="currentColor" font-family="Impact, sans-serif" font-size="15">6</text></svg><span class="phone-device-brand">THE 6</span><i aria-hidden="true"></i></div>
        <div class="phone-screen">
          <div class="phone-status"><span class="phone-signal" aria-label="Signal"><i></i><i></i><i></i><i></i></span><span class="phone-carrier-mark" aria-label="Carrier" aria-hidden="true">◕</span><span class="phone-day">Wed</span><span class="phone-clock">--:--</span><span class="phone-battery" aria-label="Battery full"><i></i><b></b></span></div>
          <div class="phone-service-band"><span>Home</span></div>
          <div class="phone-content"></div>
          <button class="phone-add" type="button" aria-label="Open Garage to summon a vehicle" title="Garage · summon a vehicle">+</button>
        </div>
        <nav class="phone-home-bar" aria-label="Phone shortcuts">
          <button class="phone-nav-search" type="button" aria-label="Search" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15 15 5 5"/></svg><span class="phone-nav-label">Search</span></button>
          <button class="phone-nav-home" type="button" aria-label="Home" title="Home"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg><span class="phone-nav-label">Home</span></button>
          <button class="phone-nav-back" type="button" aria-label="Back" title="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg><span class="phone-nav-label">Back</span></button>
        </nav>
      </div>`;
    document.body.appendChild(root);
    const content = root.querySelector('.phone-content');
    const clock = root.querySelector('.phone-clock');
    const day = root.querySelector('.phone-day');
    const serviceTitle = root.querySelector('.phone-service-band span');
    let lease = null;
    let screen = 'home';
    let selectedPlace = null;
    let searchTimer = 0;
    let closingTimer = 0;

    function setClock() {
      let now = new Date();
      let gameClock = '';
      try {
        const state = game.liveSky?.state?.();
        if (state?.fixedClock) now = new Date(state.fixedClock);
        gameClock = state?.clock || '';
      } catch (_) {}
      day.textContent = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short' }).format(now);
      clock.textContent = gameClock || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).format(now);
    }
    setClock();
    const clockTimer = window.setInterval(setClock, 30_000);

    function isOpen() { return !!lease; }
    function renderHome() {
      screen = 'home'; selectedPlace = null; serviceTitle.textContent = 'Home';
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'false');
      if (settingsPanel) settingsPanel.hidden = true;
      content.innerHTML = '<div class="phone-app-grid" aria-label="Phone apps"></div>';
      const grid = content.querySelector('.phone-app-grid');
      APPS.forEach((app) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'phone-app-icon'; button.dataset.app = app.id;
        button.setAttribute('aria-label', `Open ${app.name}`);
        button.innerHTML = `<span class="phone-app-glyph ${app.color}" aria-hidden="true">${app.icon}</span><span class="phone-app-name"></span>`;
        button.querySelector('.phone-app-name').textContent = app.name;
        button.addEventListener('click', () => app.id === 'garage' ? renderGarage() : renderTeleport());
        grid.appendChild(button);
      });
    }

    function appHeader(title, subtitle) {
      serviceTitle.textContent = title;
      if (settingsPanel) settingsPanel.hidden = true;
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'false');
      content.replaceChildren();
      const header = document.createElement('header'); header.className = 'phone-app-header';
      const back = document.createElement('button'); back.type = 'button'; back.className = 'phone-back'; back.setAttribute('aria-label', 'Back to phone home'); back.textContent = '‹';
      back.addEventListener('click', renderHome);
      const copy = document.createElement('div'); copy.className = 'phone-app-heading';
      const name = document.createElement('h2'); name.textContent = title;
      const desc = document.createElement('p'); desc.textContent = subtitle;
      copy.append(name, desc); header.append(back, copy);
      const badge = document.createElement('span'); badge.className = 'phone-app-brand'; badge.textContent = '6'; header.appendChild(badge);
      content.appendChild(header);
      return content;
    }

    function renderSettings() {
      screen = 'settings'; appHeader('Settings', 'Set the city to your taste.');
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'true');
      if (!settingsPanel) {
        const message = document.createElement('p'); message.className = 'phone-settings-error';
        message.textContent = 'Settings are unavailable right now.'; content.appendChild(message); return;
      }
      settingsPanel.hidden = false;
      settingsPanel.classList.add('phone-settings-panel');
      content.appendChild(settingsPanel);
    }

    function renderGarage() {
      screen = 'garage'; serviceTitle.textContent = 'Garage';
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'false');
      if (settingsPanel) settingsPanel.hidden = true;
      content.replaceChildren();
      const intro = document.createElement('p'); intro.className = 'garage-intro'; intro.textContent = 'Choose what gets you there.'; content.appendChild(intro);
      const list = document.createElement('div'); list.className = 'garage-list';
      const note = document.createElement('p'); note.className = 'phone-section-label'; note.textContent = 'SUMMON A VEHICLE'; list.appendChild(note);
      VEHICLES.forEach((vehicle) => {
        const existing = [...game.controllerManager.worldVehicles.values()].find((v) => v.type === vehicle.id && v.source === 'summoned');
        const button = document.createElement('button');
        button.type = 'button'; button.className = `garage-option ${existing ? 'is-active' : ''}`;
        button.setAttribute('aria-pressed', String(!!existing));
        button.innerHTML = `<span class="garage-glyph ${vehicle.color}" aria-hidden="true"></span><span class="garage-copy"><strong></strong><small></small></span><span class="garage-state" aria-hidden="true"></span>`;
        button.querySelector('.garage-glyph').textContent = vehicle.icon;
        button.querySelector('strong').textContent = vehicle.label;
        button.querySelector('small').textContent = existing ? 'Already summoned · tap to replace' : vehicle.detail;
        button.addEventListener('click', () => {
          const result = game.summonVehicle(vehicle.id);
          if (result?.ok) close();
          else {
            button.classList.add('has-error');
            button.querySelector('small').textContent = result?.message || 'Could not find a clear place to spawn.';
          }
        });
        list.appendChild(button);
      });
      const foot = document.createElement('p'); foot.className = 'phone-footnote'; foot.textContent = 'Walk up and press E to get in.'; list.appendChild(foot);
      content.appendChild(list);
    }

    function renderTeleport() {
      screen = 'teleport'; selectedPlace = null; appHeader('Teleport', 'Search places in the city map.');
      const wrap = document.createElement('div'); wrap.className = 'teleport-app';
      const label = document.createElement('label'); label.className = 'phone-search-label'; label.textContent = 'DESTINATION'; label.htmlFor = 'phone-place-search';
      const search = document.createElement('input'); search.id = 'phone-place-search'; search.className = 'phone-search'; search.type = 'search'; search.placeholder = 'Search Toronto'; search.autocomplete = 'off'; search.spellcheck = false;
      search.setAttribute('aria-label', 'Search Toronto destinations');
      const status = document.createElement('p'); status.className = 'phone-search-status'; status.setAttribute('aria-live', 'polite'); status.textContent = 'Search a place, street or district.';
      const results = document.createElement('div'); results.className = 'phone-search-results';
      const quickHeading = document.createElement('p'); quickHeading.className = 'phone-section-label'; quickHeading.textContent = 'TORONTO SHORTLIST';
      const quick = document.createElement('div'); quick.className = 'phone-quick-list';
      const selected = document.createElement('div'); selected.className = 'phone-selected-place'; selected.hidden = true;
      const go = document.createElement('button'); go.type = 'button'; go.className = 'phone-go'; go.disabled = true; go.textContent = 'Set destination';
      wrap.append(label, search, status, results, quickHeading, quick, selected, go); content.appendChild(wrap);

      function choose(place) {
        selectedPlace = place;
        selected.hidden = false; selected.replaceChildren();
        const pin = document.createElement('span'); pin.className = 'selected-pin'; pin.textContent = '⌖';
        const copy = document.createElement('span'); copy.className = 'selected-copy';
        const title = document.createElement('strong'); title.textContent = place.name;
        const sub = document.createElement('small'); sub.textContent = place.sub || place.kind || 'Toronto';
        copy.append(title, sub); selected.append(pin, copy); go.disabled = false; go.textContent = `Go to ${place.name}`;
        results.replaceChildren(); status.textContent = 'Destination ready. The map will find a safe arrival point.';
      }
      function showResults(query) {
        const found = game.tourGuide.search(query).slice(0, 5);
        results.replaceChildren();
        if (!found.length) { status.textContent = 'No matches in the city map. Try a landmark or street name.'; return; }
        status.textContent = `${found.length} ${found.length === 1 ? 'match' : 'matches'} in the city map.`;
        found.forEach((place) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'phone-result';
          const glyph = document.createElement('span'); glyph.className = 'phone-result-pin'; glyph.textContent = '⌖';
          const copy = document.createElement('span'); copy.className = 'phone-result-copy';
          const name = document.createElement('strong'); name.textContent = place.name;
          const sub = document.createElement('small'); sub.textContent = place.sub || place.kind || 'Toronto'; copy.append(name, sub);
          const arrow = document.createElement('span'); arrow.className = 'phone-result-arrow'; arrow.textContent = '›';
          button.append(glyph, copy, arrow); button.addEventListener('click', () => choose(place)); results.appendChild(button);
        });
      }
      QUICK_DESTINATIONS.forEach((name) => {
        const place = game.tourGuide.search(name).find((item) => item.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]) || item.landmarkId);
        if (!place) return;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'phone-quick-destination';
        button.textContent = name; button.addEventListener('click', () => { choose(place); }); quick.appendChild(button);
      });
      search.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        results.replaceChildren(); selected.hidden = true; selectedPlace = null; go.disabled = true;
        const query = search.value.trim();
        if (!query) { status.textContent = 'Search a place, street or district.'; return; }
        status.textContent = 'Searching the local city map…';
        searchTimer = window.setTimeout(() => {
          try { showResults(query); }
          catch (error) { status.textContent = 'The city search is unavailable right now.'; console.error('[phone teleport]', error); }
        }, 120);
      });
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault(); window.clearTimeout(searchTimer);
          try { showResults(search.value.trim()); } catch (error) { status.textContent = 'The city search is unavailable right now.'; }
        }
      });
      go.addEventListener('click', () => {
        if (!selectedPlace) return;
        go.disabled = true; go.textContent = 'Finding a safe arrival…'; status.textContent = 'Routing you to the nearest safe spot…';
        try {
          const destination = game.tourGuide.teleportToPlace(selectedPlace);
          if (destination) close();
          else { go.disabled = false; go.textContent = 'Try another arrival'; status.textContent = 'No safe arrival point was available. Choose another destination.'; }
        } catch (error) {
          go.disabled = false; go.textContent = 'Try again'; status.textContent = 'Could not reach that destination. Try another result.'; console.error('[phone teleport]', error);
        }
      });
    }

    function animateClosed() {
      root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true');
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'false');
      window.clearTimeout(closingTimer);
      closingTimer = window.setTimeout(() => { if (!lease) root.hidden = true; }, 300);
      launcher.setAttribute('aria-expanded', 'false');
    }
    function close() {
      if (!lease) return false;
      const current = lease; lease = null;
      current.release();
      return true;
    }
    settingsPanel?.addEventListener('click', (event) => {
      if (event.target.closest?.('#btn-open-map, #btn-help')) close();
    }, true);
    function open(initialScreen = 'home') {
      if (lease) {
        if (initialScreen === 'settings') { renderSettings(); return true; }
        if (initialScreen === 'garage') { renderGarage(); return true; }
        if (initialScreen === 'teleport') { renderTeleport(); return true; }
        return close();
      }
      if (window.CITY.uiOverlay || !game.ready) return false;
      if (document.pointerLockElement) document.exitPointerLock?.();
      const nextLease = game.openOverlay('phone', { onClose: () => {
        if (lease === nextLease) lease = null;
        animateClosed();
      } });
      if (!nextLease) return false;
      lease = nextLease;
      window.clearTimeout(closingTimer);
      root.hidden = false; root.setAttribute('aria-hidden', 'false');
      ({ home: renderHome, garage: renderGarage, teleport: renderTeleport, settings: renderSettings }[initialScreen] || renderHome)();
      requestAnimationFrame(() => root.classList.add('is-open'));
      launcher.setAttribute('aria-expanded', 'true');
      return true;
    }

    root.addEventListener('click', (event) => { if (event.target === root) close(); });
    root.querySelector('.phone-nav-home').addEventListener('click', renderHome);
    root.querySelector('.phone-nav-search').addEventListener('click', renderTeleport);
    root.querySelector('.phone-add').addEventListener('click', renderGarage);
    root.querySelector('.phone-nav-back').addEventListener('click', () => screen === 'home' ? close() : renderHome());
    launcher.addEventListener('click', () => open());
    window.addEventListener('keydown', (event) => {
      if (window.CITY.isTypingInField?.(event)) return;
      if (event.code === 'ArrowUp' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault(); event.stopPropagation();
        if (lease) close(); else open();
      }
    }, true);
    window.addEventListener('pagehide', () => { window.clearInterval(clockTimer); window.clearTimeout(searchTimer); });

    return { open, close, isOpen, get screen() { return screen; }, apps: APPS.map(({ id, name }) => ({ id, name })) };
  }

  Object.assign(window.CITY, { createPhoneManager });
})();
