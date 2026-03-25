function createGrid(width, height, backgroundIndex) {
  return Array.from({ length: height }, () => Array(width).fill(backgroundIndex));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRng(seed = Date.now()) {
  let state = Number(seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pickWeighted(rng, options) {
  const total = options.reduce((sum, option) => sum + (option.weight || 0), 0);
  let cursor = rng() * total;

  for (const option of options) {
    cursor -= option.weight || 0;
    if (cursor <= 0) return option;
  }

  return options[options.length - 1];
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function matchesCondition(traits, condition = {}) {
  return Object.entries(condition).every(([key, expected]) => {
    if (traits[key] === undefined) return false;
    return asArray(expected).includes(traits[key]);
  });
}

function getTraitOptions(config, traitName) {
  return config.traits?.[traitName]?.options || [];
}

function findOption(config, traitName, optionId) {
  return getTraitOptions(config, traitName).find((option) => option.id === optionId) || null;
}

function buildRoleBindings(config, option) {
  return {
    ...(config.palette?.roleBindings || {}),
    ...(option?.extraRoleBindings || {}),
  };
}

function resolveRoleIndex(role, bindings) {
  if (typeof role === "number") return role;
  if (bindings[role] !== undefined) return bindings[role];
  return 0;
}

function drawAbsolutePixels(grid, pixels, colorIndex) {
  for (const point of pixels) {
    const [x, y] = point;
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = colorIndex;
    }
  }
}

function drawOverlayPixels(grid, pixels, bindings, fallbackRole) {
  for (const pixel of pixels || []) {
    const x = pixel.x;
    const y = pixel.y;
    const role = pixel.role || pixel.c || fallbackRole;
    const colorIndex = resolveRoleIndex(role, bindings);
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = colorIndex;
    }
  }
}

function isTraitAllowedForCurrentState(traitName, option, traits, config) {
  if (traitName === "skin" && option.allowedBaseTypes?.length) {
    return option.allowedBaseTypes.includes(traits.baseType);
  }

  return true;
}

function applyPreselectionRules(traitName, options, traits, config) {
  let nextOptions = options.filter((option) =>
    isTraitAllowedForCurrentState(traitName, option, traits, config)
  );

  for (const rule of config.rules || []) {
    if (rule.type === "forceIf" && matchesCondition(traits, rule.if || {})) {
      const allowedValues = rule.then?.[traitName];
      if (allowedValues) {
        nextOptions = nextOptions.filter((option) => asArray(allowedValues).includes(option.id));
      }
    }

    if (rule.type === "forbidIf" && matchesCondition(traits, rule.if || {})) {
      const blockedValues = rule.not?.[traitName];
      if (blockedValues) {
        nextOptions = nextOptions.filter((option) => !asArray(blockedValues).includes(option.id));
      }
    }
  }

  return nextOptions;
}

function applyWeightModifiers(traitName, options, traits, config) {
  return options
    .map((option) => {
      let weight = option.weight || 0;

      for (const rule of config.rules || []) {
        if (rule.type !== "weightModifier") continue;
        if (!matchesCondition(traits, rule.when || {})) continue;
        const override = rule.adjust?.[traitName]?.[option.id];
        if (override !== undefined) {
          weight = override;
        }
      }

      return { ...option, weight };
    })
    .filter((option) => option.weight > 0);
}

function rerollTrait(traits, traitName, config, rng, extraBlocked = []) {
  let options = getTraitOptions(config, traitName);
  options = applyPreselectionRules(traitName, options, traits, config);
  options = options.filter((option) => !extraBlocked.includes(option.id));
  options = applyWeightModifiers(traitName, options, traits, config);

  if (!options.length) {
    return traits[traitName];
  }

  return pickWeighted(rng, options).id;
}

function optionSatisfiesRequires(option, traits) {
  if (!option?.requires) return true;
  return Object.entries(option.requires).every(([traitName, allowed]) =>
    asArray(allowed).includes(traits[traitName])
  );
}

function isEmptyLook(traits, config) {
  const definition = config.qualityGuards?.emptyLookDefinition;
  if (!definition) return false;

  return Object.entries(definition).every(([traitName, values]) =>
    asArray(values).includes(traits[traitName])
  );
}

function applyPostRules(initialTraits, config, rng) {
  const traits = { ...initialTraits };
  const maxRetries = config.random?.maxRetries || 24;

  for (let iteration = 0; iteration < maxRetries; iteration += 1) {
    let changed = false;

    for (const rule of config.rules || []) {
      if (rule.type === "forceIf" && matchesCondition(traits, rule.if || {})) {
        for (const [traitName, allowedValues] of Object.entries(rule.then || {})) {
          const allowed = asArray(allowedValues);
          if (!allowed.includes(traits[traitName])) {
            traits[traitName] = rerollTrait(traits, traitName, config, rng);
            if (!allowed.includes(traits[traitName])) {
              traits[traitName] = allowed[0];
            }
            changed = true;
          }
        }
      }

      if (rule.type === "forbidIf" && matchesCondition(traits, rule.if || {})) {
        for (const [traitName, blockedValues] of Object.entries(rule.not || {})) {
          const blocked = asArray(blockedValues);
          if (blocked.includes(traits[traitName])) {
            traits[traitName] = rerollTrait(traits, traitName, config, rng, blocked);
            changed = true;
          }
        }
      }
    }

    for (const traitName of config.generationOrder || []) {
      const option = findOption(config, traitName, traits[traitName]);
      if (option && !optionSatisfiesRequires(option, traits)) {
        traits[traitName] = rerollTrait(traits, traitName, config, rng);
        changed = true;
      }
    }

    if (config.qualityGuards?.forbidEmptyLook && isEmptyLook(traits, config)) {
      traits.accessory = rerollTrait(traits, "accessory", config, rng, ["none"]);
      if (traits.accessory === "none") {
        traits.hair = rerollTrait(traits, "hair", config, rng, ["none"]);
      }
      changed = true;
    }

    if (!changed) break;
  }

  return traits;
}

export function generateTraitsFromConfig(seed, config) {
  const rng = createRng(seed);
  const traits = { seed };

  for (const traitName of config.generationOrder || []) {
    let options = getTraitOptions(config, traitName);
    options = applyPreselectionRules(traitName, options, traits, config);
    options = applyWeightModifiers(traitName, options, traits, config);

    if (!options.length) continue;
    traits[traitName] = pickWeighted(rng, options).id;
  }

  return applyPostRules(traits, config, rng);
}

export function renderTraitsToPixels(traits, config) {
  const grid = createGrid(
    config.canvas?.width || 32,
    config.canvas?.height || 32,
    config.canvas?.backgroundIndex || 0
  );

  const selectedOptions = Object.fromEntries(
    (config.generationOrder || [])
      .map((traitName) => [traitName, findOption(config, traitName, traits[traitName])])
      .filter(([, option]) => option)
  );

  const skinOption = selectedOptions.skin;
  const skinBindings = buildRoleBindings(config, skinOption);
  const skinColorIndex = resolveRoleIndex(skinOption?.fillRole || "skin_light", skinBindings);

  for (const layerId of config.renderOrder || []) {
    if (config.base?.layers?.[layerId]) {
      drawAbsolutePixels(grid, config.base.layers[layerId], skinColorIndex);
      continue;
    }

    const option = selectedOptions[layerId];
    if (!option) continue;

    const bindings = buildRoleBindings(config, option);
    let fallbackRole = null;

    if (option.colorRoleByBaseType) {
      fallbackRole = option.colorRoleByBaseType[traits.baseType];
    }

    drawOverlayPixels(grid, option.pixels, bindings, fallbackRole);
  }

  return grid;
}

export function resolvePreset(config, presetId) {
  const preset = (config.presets || []).find((entry) => entry.id === presetId);
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }

  return deepClone(preset.traits);
}

export function generateOrPreset(config, input = {}) {
  const { seed = Date.now(), presetId = null } = input;
  const traits = presetId ? resolvePreset(config, presetId) : generateTraitsFromConfig(seed, config);
  const pixels = renderTraitsToPixels(
    presetId ? { ...traits, seed, base: config.base?.id || "punk_master_human_profile_v1" } : traits,
    config
  );

  return {
    seed,
    traits: {
      base: config.base?.id || "punk_master_human_profile_v1",
      seed,
      ...traits,
    },
    pixels,
  };
}

export function buildDefaultPaletteFromConfig(config) {
  return Array.from({ length: config.palette?.size || 16 }, (_, index) => {
    const slot = config.palette?.slots?.[String(index)];
    return slot?.hex || "#000000";
  });
}
