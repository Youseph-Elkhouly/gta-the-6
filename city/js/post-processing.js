(function () {
// Scene-linear color grading and lens bloom, composed in the existing final render pass.
const { THREE } = window.CITY;
const { Fn, uniform, renderGroup, float, vec2, vec3, vec4, dot, mix, min, max, pow, smoothstep, length, screenUV, screenSize, fract, sin, time } = window.CITY.TSL;
const { bloom } = window.CITY.PostFX;

// Exposure and white balance belong to the camera, independently of the physical lighting presets.
// Keep exposure restrained for ACES; stronger bloom stays selective so midtones retain their contrast.
const LOOKS = {
  golden:   { exposure: 1.04, contrast: 1.12, saturation: 1.08, balance: [1.045, 1.00, 0.955], bloom: 0.24, threshold: 1.20 },
  midday:   { exposure: 1.00, contrast: 1.10, saturation: 1.06, balance: [1.015, 1.00, 0.985], bloom: 0.18, threshold: 1.35 },
  twilight: { exposure: 1.06, contrast: 1.10, saturation: 1.08, balance: [1.025, 0.995, 1.015], bloom: 0.28, threshold: 1.05 },
  midnight: { exposure: 1.04, contrast: 1.08, saturation: 1.06, balance: [0.985, 1.00, 1.035], bloom: 0.30, threshold: 1.00 }
};

// `reflections` (SSR) may be null, and { bloom: false } leaves the bloom out (the phone tiers, quality.js)
function createPostProcessing(renderer, sceneColor, reflections, options = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Exposure is applied before bloom so its threshold follows the image's exposed brightness.
  // RenderPipeline performs ACES and the output color-space conversion exactly once, after this graph.
  renderer.toneMappingExposure = 1.0;

  // (the time of day's grade, rewritten by applyPreset: renderGroup uniforms, uploaded once per render)
  const exposure = uniform(1.0).setGroup(renderGroup);
  const contrast = uniform(1.0).setGroup(renderGroup);
  const saturation = uniform(1.0).setGroup(renderGroup);
  const balance = uniform(new THREE.Vector3(1, 1, 1)).setGroup(renderGroup);
  // The game's GTA colour grade is part of its default look and stays enabled.
  const gtaOn = true;
  const gta = uniform(1).setGroup(renderGroup);
  const exposed = max(reflections ? sceneColor.rgb.add(reflections.rgb) : sceneColor.rgb, vec3(0)).mul(exposure).mul(balance);

  // Limit only bloom's peak radiance, scaling RGB together to retain neon and lamp colors.
  // The original HDR image keeps its full range for the tone mapper's highlight shoulder.
  const peak = max(max(exposed.r, exposed.g), exposed.b);
  const bloomInput = vec4(exposed.mul(float(8.0).div(max(peak, 8.0))), 1.0);
  const bloomPass = options.bloom === false ? null : bloom(bloomInput, 0.24, 0.40, 1.20);
  if (bloomPass) {
    bloomPass.smoothWidth.value = 0.30;
    bloomPass.setResolutionScale(0.5);
  }

  const outputNode = Fn(() => {
    const color = (bloomPass ? exposed.add(bloomPass.rgb) : exposed).toVar();
    const luma = dot(color, vec3(0.2126, 0.7152, 0.0722)).toVar();

    // Gentle cool shadow / warm highlight separation; multiply rather than lifting the black level.
    const shadows = mix(vec3(0.965, 1.005, 1.045), vec3(1), smoothstep(0.02, 0.60, luma));
    const highlights = mix(vec3(1), vec3(1.035, 1.005, 0.965), smoothstep(0.60, 3.0, luma));
    color.mulAssign(shadows.mul(highlights));

    // Contrast pivots around middle gray and scales RGB together, avoiding per-channel gamma shifts.
    color.mulAssign(pow(max(luma, 0.0001).div(0.18), contrast.add(gta.mul(0.08)).sub(1.0)));
    const gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
    const chroma = max(max(color.r, color.g), color.b).sub(min(min(color.r, color.g), color.b));
    const vibrance = float(0.10).mul(float(1).sub(chroma.div(max(max(max(color.r, color.g), color.b), 0.0001))));
    color.assign(max(mix(vec3(gray), color, saturation.add(vibrance)), vec3(0)));

    // Normalize by the corner radius so the lens falloff remains subtle in portrait and landscape.
    const aspect = screenSize.x.div(screenSize.y);
    const radius = length(screenUV.sub(0.5).mul(vec2(aspect, 1))).div(length(vec2(aspect, 1).mul(0.5)));
    const vignette = float(1).sub(smoothstep(0.35, 1.0, radius).mul(mix(float(0.12), float(0.22), gta)));

    // Amber highlights, teal shadows, a little less chroma, a light grain. Mixed by the debug toggle.
    const split = mix(vec3(0.86, 0.97, 1.08), vec3(1.1, 1.02, 0.88), smoothstep(0.05, 0.8, luma));
    const tinted = color.mul(split).toVar();
    const tintLuma = dot(tinted, vec3(0.2126, 0.7152, 0.0722));
    const muted = mix(vec3(tintLuma), tinted, float(0.86));
    const grainUv = screenUV.mul(screenSize).add(vec2(time.mul(17.0), time.mul(9.0)));
    const grain = fract(sin(dot(grainUv, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).mul(0.028);
    const graded = muted.add(grain);
    return vec4(mix(color, graded, gta).mul(vignette), 1.0);
  })();

  // A preset's look, or (the live sky, lighting.js applyLive) the presets' looks blended by `weights` with the weather's
  // saturation & exposure on top
  function applyPreset(id, weights = null, weatherSaturation = 1, weatherExposure = 1) {
    let look = LOOKS[id] || LOOKS.golden;
    if (weights) {
      const ids = Object.keys(LOOKS).filter((k) => weights[k] > 0);
      const mix = (f) => ids.reduce((sum, k) => sum + f(LOOKS[k]) * weights[k], 0);
      look = { exposure: mix((l) => l.exposure), contrast: mix((l) => l.contrast), saturation: mix((l) => l.saturation),
        balance: [0, 1, 2].map((i) => mix((l) => l.balance[i])), bloom: mix((l) => l.bloom), threshold: mix((l) => l.threshold) };
    }
    exposure.value = look.exposure * weatherExposure;
    contrast.value = look.contrast;
    saturation.value = look.saturation * weatherSaturation;
    balance.value.set(...look.balance);
    if (bloomPass) {
      bloomPass.strength.value = look.bloom;
      bloomPass.threshold.value = look.threshold;
    }
  }

  const GTAVisualPreset = {
    id: 'gta-golden',
    enabled: gtaOn
  };

  applyPreset('golden');
  window.CITY.GTAVisualPreset = GTAVisualPreset;
  return { outputNode, bloomPass, applyPreset, exposure, contrast, saturation, balance, GTAVisualPreset };
}

Object.assign(window.CITY, { createPostProcessing });
})();
