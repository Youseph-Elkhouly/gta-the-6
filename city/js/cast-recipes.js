// Look recipes and pure motion helpers for the rigged cast (js/cast.js).
// These are stylized parody silhouettes, not the real people.
(function () {
  const PRIORITY = ['drake', 'tobi', 'sam', 'jensen', 'hinton', 'chow', 'kawhi'];

  // Shared athletic male, dressed per character. Colours are the target skin and cloth, not a flat body paint.
  const LOOKS = {
    cj: {
      role: 'player',
      skin: '#8d5524',
      hair: '#1a120e',
      hairStyle: 'buzz',
      beard: 0,
      brows: '#1a120e',
      top: 'tank',
      tank: '#f3f0e8',
      jeans: '#243f78',
      belt: '#161616',
      shoes: '#111111',
      sole: '#e4e0d8',
      glasses: false,
      cap: false
    },
    drake: {
      role: 'npc',
      skin: '#805137',
      hair: '#120e0c',
      hairStyle: 'buzz',
      beard: 1,
      brows: '#120e0c',
      top: 'jacket',
      jacket: '#141416',
      jacketRough: 0.78,
      jacketMetal: 0.02,
      jeans: '#1a1c22',
      belt: '#121212',
      shoes: '#0e0e10',
      sole: '#2a2a2a',
      glasses: false,
      cap: false,
      headScale: [1.13, 0.96, 1.08],
      modelScale: [1.085, 1, 1.06]
    },
    tobi: {
      role: 'npc',
      skin: '#f0d0b4',
      hair: '#c8b8a4',
      hairStyle: 'bald',
      beard: 0.48,
      brows: '#6a5040',
      top: 'jacket',
      jacket: '#3c4654',
      jacketRough: 0.86,
      jacketMetal: 0,
      jeans: '#5c564c',
      belt: '#2a2622',
      shoes: '#2c2c2c',
      sole: '#c8c4bc',
      glasses: false,
      cap: true,
      capColor: '#24282d',
      headScale: [0.98, 1.035, 1.01],
      modelScale: [0.985, 1, 1]
    },
    sam: {
      role: 'npc',
      skin: '#f2c8a6',
      hair: '#2a211c',
      hairStyle: 'short',
      beard: 0,
      brows: '#2a211c',
      top: 'jacket',
      jacket: '#d5d0c8',
      jacketRough: 0.84,
      jacketMetal: 0,
      jeans: '#2a3038',
      belt: '#1c1c1c',
      shoes: '#1a1a1a',
      sole: '#d8d4cc',
      glasses: false,
      cap: false
    },
    jensen: {
      role: 'npc',
      skin: '#e0b48e',
      hair: '#c5c8ce',
      hairStyle: 'short',
      beard: 0,
      brows: '#6a6e74',
      top: 'jacket',
      jacket: '#0c0c0e',
      jacketRough: 0.38,
      jacketMetal: 0.24,
      jeans: '#16181e',
      belt: '#0a0a0a',
      shoes: '#0a0a0a',
      sole: '#3a3a3a',
      glasses: false,
      cap: false,
      older: true
    },
    hinton: {
      role: 'npc',
      skin: '#efd0b6',
      hair: '#b7b6b2',
      hairStyle: 'short',
      beard: 0,
      brows: '#8a8884',
      top: 'jacket',
      jacket: '#6d5344',
      jacketRough: 0.9,
      jacketMetal: 0,
      jeans: '#3e342c',
      belt: '#2a221c',
      shoes: '#3a2e26',
      sole: '#c4b8a8',
      glasses: true,
      cap: false,
      older: true
    },
    chow: {
      role: 'npc',
      skin: '#d69d79',
      hair: '#171313',
      hairStyle: 'bob',
      beard: 0,
      brows: '#34231f',
      top: 'jacket',
      jacket: '#315d91',
      jacketRough: 0.78,
      jacketMetal: 0,
      jeans: '#273449',
      belt: '#191919',
      shoes: '#171719',
      sole: '#b8b4ae',
      glasses: true,
      cap: false,
      older: true,
      headScale: [1.015, 0.98, 1.015],
      modelScale: [0.9, 0.94, 0.92]
    },
    kawhi: {
      role: 'npc',
      skin: '#74432d',
      hair: '#15100e',
      hairStyle: 'braids',
      beard: 0.55,
      brows: '#1d1512',
      top: 'jacket',
      jacket: '#8f1729',
      jacketRough: 0.82,
      jacketMetal: 0,
      jeans: '#14171d',
      belt: '#111111',
      shoes: '#19191b',
      sole: '#d4d0ca',
      glasses: false,
      cap: false,
      headScale: [0.96, 1.075, 1.025],
      modelScale: [1.13, 1.09, 1.08]
    }
  };

  // The source skin texture is a light face. Scale its channels so the average lands on `hex`
  // without flattening the pores, lips and brows into one colour.
  const SKIN_REF = [0.9, 0.74, 0.64];

  function hexRgb(hex) {
    const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function skinScale(hex) {
    const c = hexRgb(hex);
    return [c[0] / SKIN_REF[0], c[1] / SKIN_REF[1], c[2] / SKIN_REF[2]];
  }

  // Walk is 4.4 m/s, sprint is 8.2 (controllers.js). Airborne wins so a jump clip can play.
  function locomotionName(speed, airborne) {
    if (airborne) return 'jump';
    const s = Math.abs(Number(speed) || 0);
    if (s < 0.4) return 'idle';
    if (s < 6.2) return 'walk';
    return 'run';
  }

  function walkTimeScale(speed) {
    return speed < -0.25 ? -1 : 1;
  }

  // Ready Player Me walk clips translate the hips forward by metres. Keep the bob and the
  // lateral sway, and leave the model's own hip depth alone so the body stays on the capsule.
  function hipLocal(rest, sample, first) {
    return {
      x: rest.x + (sample[0] - first[0]),
      y: rest.y + (sample[1] - first[1]),
      z: rest.z
    };
  }

  // Torso of the athletic body, with a scooped neck and bare shoulders. Sleeve and arm
  // vertices (low spine weight, or far from the centre line) stay skin.
  function tankVertex(x, y, z, torsoWeight) {
    if (torsoWeight < 0.55) return false;
    if (y < 0.68 || y > 1.14) return false;
    if (Math.abs(x) > 0.2) return false;
    if (y > 1.0 && Math.abs(x) < 0.055 && z > -0.01) return false;
    return true;
  }

  // Scalp shell. Bald leaves the head texture. A buzz is a short shell; short hair sits a little lower.
  function hairVertex(y, z, ny, style) {
    if (style === 'bald') return false;
    const line = style === 'buzz' ? 1.7 : 1.64;
    if (y < line && ny < 0.55) return false;
    if (z > 0.05 && y < line + 0.04 && ny < 0.65) return false;
    return y > line || ny > 0.62;
  }

  window.CITY = window.CITY || {};
  window.CITY.CAST_PRIORITY = PRIORITY;
  window.CITY.CAST_LOOKS = LOOKS;
  window.CITY.castRecipes = {
    PRIORITY,
    LOOKS,
    hexRgb,
    skinScale,
    locomotionName,
    walkTimeScale,
    hipLocal,
    tankVertex,
    hairVertex
  };
})();
