// The in-game handset is an interface over the existing controller and tour-guide APIs.
(function () {
  const VEHICLES = [
    { id: 'person', label: 'On Foot', detail: 'Walk the blocks', icon: '♙', color: 'walk' },
    { id: 'car', label: 'Car', detail: 'Take the wheel', icon: '▰', color: 'car' },
    { id: 'cyclist', label: 'Bicycle', detail: 'Ride the lanes', icon: '◉', color: 'bike' },
    { id: 'helicopter', label: 'Helicopter', detail: 'Get above it all', icon: '✣', color: 'heli' }
  ];
  const QUICK_DESTINATIONS = ['CN Tower', 'Rogers Centre', 'Union Station', 'Nathan Phillips Square', 'Dundas Square'];
  const APPS = [
    { id: 'garage', name: 'Garage', tagline: 'Pick your ride', icon: '<svg viewBox="0 0 32 32"><path d="m4 18 2.5-7a3 3 0 0 1 2.8-2h13.4a3 3 0 0 1 2.8 2L28 18v7H4z"/><path d="M4 18h24M8 25v2m16-2v2M8 15h16"/><circle cx="9" cy="22" r="1.4"/><circle cx="23" cy="22" r="1.4"/></svg>', color: 'garage' },
    { id: 'teleport', name: 'Teleport', tagline: 'Skip the traffic', icon: '<svg viewBox="0 0 32 32"><path d="M16 28s10-9.1 10-16a10 10 0 1 0-20 0c0 6.9 10 16 10 16Z"/><circle cx="16" cy="12" r="3.4"/><path d="M18.5 23.5 27 25l-1.5-8.5"/></svg>', color: 'teleport' },
    { id: 'settings', name: 'Settings', tagline: 'Tune your world', icon: '⚙', color: 'settings' }
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
        <div class="phone-top-bezel"><span class="phone-brand-mark" aria-hidden="true">S</span><span class="phone-device-brand">Slopberry</span><i aria-hidden="true"></i></div>
        <div class="phone-screen">
          <div class="phone-status"><span class="phone-signal" aria-label="Signal"><i></i><i></i><i></i><i></i></span><span class="phone-carrier">SLOP</span><span class="phone-clock">--:--</span><span class="phone-battery" aria-label="Battery full"><i></i><b></b></span></div>
          <div class="phone-service-band"><span>SixOS</span><small>TORONTO</small></div>
          <div class="phone-content"></div>
          <nav class="phone-home-bar" aria-label="Phone shortcuts">
            <button class="phone-nav-home" type="button" aria-label="Home">⌂</button>
            <button class="phone-nav-garage" type="button" aria-label="Garage">▰</button>
            <button class="phone-nav-teleport" type="button" aria-label="Teleport">⌖</button>
            <button class="phone-nav-back" type="button" aria-label="Back">↶</button>
          </nav>
        </div>
      </div>`;
    document.body.appendChild(root);
    const content = root.querySelector('.phone-content');
    const clock = root.querySelector('.phone-clock');
    let lease = null;
    let screen = 'home';
    let selectedPlace = null;
    let searchTimer = 0;
    let closingTimer = 0;

    function setClock() {
      clock.textContent = new Intl.DateTimeFormat(undefined, { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date());
    }
    setClock();
    const clockTimer = window.setInterval(setClock, 30_000);

    function isOpen() { return !!lease; }
    function renderHome() {
      screen = 'home'; selectedPlace = null;
      document.getElementById('btn-settings')?.setAttribute('aria-expanded', 'false');
      if (settingsPanel) settingsPanel.hidden = true;
      content.innerHTML = '<div class="phone-home-wallpaper"><div class="phone-greeting"><span class="phone-kicker">SLOP SIX WIRELESS</span><h2>Quick Save</h2><p>Toronto will still be here.</p></div><div class="phone-facets" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="phone-app-grid" aria-label="Phone apps"></div>';
      const grid = content.querySelector('.phone-app-grid');
      APPS.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'phone-app-icon'; button.dataset.app = item.id;
        button.innerHTML = `<span class="phone-app-glyph ${item.color}" aria-hidden="true">${item.icon}</span><span class="phone-app-name"></span><span class="phone-app-tagline"></span>`;
        button.querySelector('.phone-app-name').textContent = item.name;
        button.querySelector('.phone-app-tagline').textContent = item.tagline;
        button.addEventListener('click', () => ({ garage: renderGarage, teleport: renderTeleport, settings: renderSettings })[item.id]());
        grid.appendChild(button);
      });
    }

    function appHeader(title, subtitle) {
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
      screen = 'garage'; appHeader('Garage', 'Choose what gets you there.');
      const list = document.createElement('div'); list.className = 'garage-list';
      const active = game.controllerManager.activeMode;
      const current = VEHICLES.find((v) => v.id === active);
      const note = document.createElement('p'); note.className = 'phone-section-label'; note.textContent = `CURRENTLY ACTIVE · ${current?.label || active}`; list.appendChild(note);
      VEHICLES.forEach((vehicle) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = `garage-option ${vehicle.id === active ? 'is-active' : ''}`;
        button.setAttribute('aria-pressed', String(vehicle.id === active));
        button.innerHTML = `<span class="garage-glyph ${vehicle.color}" aria-hidden="true"></span><span class="garage-copy"><strong></strong><small></small></span><span class="garage-state" aria-hidden="true"></span>`;
        button.querySelector('.garage-glyph').textContent = vehicle.icon;
        button.querySelector('strong').textContent = vehicle.label;
        button.querySelector('small').textContent = vehicle.detail;
        button.addEventListener('click', () => {
          const switched = game.selectMode(vehicle.id);
          if (switched) close();
          else {
            button.classList.add('has-error');
            button.querySelector('small').textContent = 'Can’t switch here — try a clearer spot.';
          }
        });
        list.appendChild(button);
      });
      const foot = document.createElement('p'); foot.className = 'phone-footnote'; foot.textContent = 'Vehicles stay where you leave them. Switching keeps you close.'; list.appendChild(foot);
      content.appendChild(list);
    }

    function renderTeleport() {
      screen = 'teleport'; selectedPlace = null; appHeader('Teleport', 'Pick a place in the city map.');
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
    root.querySelector('.phone-nav-home').addEventListener('click', () => screen === 'home' ? close() : renderHome());
    root.querySelector('.phone-nav-garage').addEventListener('click', renderGarage);
    root.querySelector('.phone-nav-teleport').addEventListener('click', renderTeleport);
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
