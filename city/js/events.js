// Gameplay events other systems can subscribe to. Combat emits weapon and NPC events.
// A later wanted-level system can listen for weapon:fired, npc:killed and vehicle:stolen.
// Nothing here awards stars or spawns police.
(function () {
  const listeners = new Map();

  function list(type) {
    let set = listeners.get(type);
    if (!set) listeners.set(type, (set = new Set()));
    return set;
  }

  function on(type, fn) {
    if (typeof fn !== 'function') return () => {};
    list(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = listeners.get(type);
    if (set) set.delete(fn);
  }

  function emit(type, detail) {
    const set = listeners.get(type);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try { fn(detail); }
      catch (err) { console.error('[events]', type, err); }
    }
  }

  window.CITY.events = { on, off, emit };

  // Vehicle code calls this when the player takes a car that isn't theirs.
  // Entering the player's own car does not.
  window.CITY.reportVehicleStolen = function reportVehicleStolen(detail) {
    emit('vehicle:stolen', {
      actor: 'player',
      vehicleId: detail?.vehicleId || 'vehicle',
      position: detail?.position || null,
      timestamp: Date.now(),
      weapon: null,
      ...detail
    });
  };
})();
