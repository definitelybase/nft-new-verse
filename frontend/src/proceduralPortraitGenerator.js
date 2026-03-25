const GRID = 32;

const PALETTES = [
  { name: "candy", bg: 1, skin: 14, dark: 13, mid: 15, accent: 9, accent2: 8 },
  { name: "mint", bg: 1, skin: 14, dark: 13, mid: 10, accent: 3, accent2: 6 },
  { name: "sunset", bg: 12, skin: 14, dark: 13, mid: 11, accent: 6, accent2: 5 },
  { name: "cyber", bg: 1, skin: 14, dark: 13, mid: 4, accent: 7, accent2: 8 },
  { name: "forest", bg: 12, skin: 11, dark: 13, mid: 10, accent: 6, accent2: 3 },
  { name: "mono-red", bg: 1, skin: 14, dark: 13, mid: 11, accent: 2, accent2: 15 },
];

function createRng(seed = Date.now()) {
  let state = Number(seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, options) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = rng() * total;

  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.id;
  }

  return options[options.length - 1].id;
}

function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function chance(rng, probability) {
  return rng() < probability;
}

function createGrid(size = GRID, fill = 1) {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

function setPixel(grid, x, y, color) {
  if (x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return;
  grid[y][x] = color;
}

function fillRect(grid, x1, y1, x2, y2, color) {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      setPixel(grid, x, y, color);
    }
  }
}

function clearRect(grid, x1, y1, x2, y2, background) {
  fillRect(grid, x1, y1, x2, y2, background);
}

function fillEllipse(grid, x1, y1, x2, y2, color) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.max(1, (x2 - x1) / 2);
  const ry = Math.max(1, (y2 - y1) / 2);

  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if ((dx * dx) + (dy * dy) <= 1) {
        setPixel(grid, x, y, color);
      }
    }
  }
}

function fillRoundedRect(grid, x1, y1, x2, y2, radius, color, background) {
  fillRect(grid, x1, y1, x2, y2, color);
  for (let dy = 0; dy < radius; dy += 1) {
    for (let dx = 0; dx < radius; dx += 1) {
      if ((dx * dx) + (dy * dy) < (radius - 1) * (radius - 1)) continue;
      setPixel(grid, x1 + dx, y1 + dy, background);
      setPixel(grid, x2 - dx, y1 + dy, background);
      setPixel(grid, x1 + dx, y2 - dy, background);
      setPixel(grid, x2 - dx, y2 - dy, background);
    }
  }
}

function drawLine(grid, x1, y1, x2, y2, color) {
  let dx = Math.abs(x2 - x1);
  let dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let x = x1;
  let y = y1;

  while (true) {
    setPixel(grid, x, y, color);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawPointCloud(grid, rng, x1, y1, x2, y2, count, color) {
  for (let i = 0; i < count; i += 1) {
    setPixel(grid, int(rng, x1, x2), int(rng, y1, y2), color);
  }
}

function weightedChoice(rng, items) {
  return pickWeighted(rng, items);
}

function stableSignature(traits) {
  return [
    traits.palette,
    traits.face_shape,
    traits.hair_type,
    traits.eyes_type,
    traits.mouth_type,
    traits.outfit_type,
    traits.accessory,
    traits.beard_type,
    traits.hair_color_kind,
    traits.eye_wear,
  ].join("|");
}

function pickPaletteByName(name) {
  return PALETTES.find((entry) => entry.name === name) || PALETTES[0];
}

function makeTraits(rng) {
  return {
    palette: PALETTES[int(rng, 0, PALETTES.length - 1)].name,
    face_shape: weightedChoice(rng, [
      { id: "oval", weight: 4.0 },
      { id: "round", weight: 3.0 },
      { id: "long", weight: 2.0 },
      { id: "square", weight: 1.5 },
    ]),
    hair_type: weightedChoice(rng, [
      { id: "short", weight: 3.0 },
      { id: "spiky", weight: 1.4 },
      { id: "long", weight: 1.8 },
      { id: "fringe", weight: 2.2 },
      { id: "buzz", weight: 1.1 },
      { id: "bald", weight: 0.8 },
      { id: "bun", weight: 0.7 },
    ]),
    eyes_type: weightedChoice(rng, [
      { id: "dots", weight: 2.0 },
      { id: "sleepy", weight: 1.7 },
      { id: "bar", weight: 2.0 },
      { id: "wide", weight: 1.2 },
      { id: "angry", weight: 1.0 },
    ]),
    mouth_type: weightedChoice(rng, [
      { id: "flat", weight: 2.4 },
      { id: "smirk", weight: 1.5 },
      { id: "open", weight: 0.8 },
      { id: "sad", weight: 0.7 },
    ]),
    outfit_type: weightedChoice(rng, [
      { id: "tee", weight: 2.5 },
      { id: "hoodie", weight: 1.6 },
      { id: "jacket", weight: 1.3 },
      { id: "robe", weight: 0.7 },
    ]),
    accessory: weightedChoice(rng, [
      { id: "none", weight: 4.0 },
      { id: "earring", weight: 1.0 },
      { id: "chain", weight: 1.0 },
      { id: "vr", weight: 0.9 },
      { id: "cap", weight: 1.1 },
      { id: "horns", weight: 0.4 },
      { id: "halo", weight: 0.25 },
    ]),
    beard_type: weightedChoice(rng, [
      { id: "none", weight: 4.0 },
      { id: "stubble", weight: 1.2 },
      { id: "goatee", weight: 0.9 },
      { id: "full", weight: 0.8 },
      { id: "moustache", weight: 0.7 },
    ]),
    hair_color_kind: weightedChoice(rng, [
      { id: "dark", weight: 3.5 },
      { id: "mid", weight: 2.0 },
      { id: "accent", weight: 1.2 },
      { id: "accent2", weight: 1.0 },
    ]),
    eye_wear: weightedChoice(rng, [
      { id: "none", weight: 4.2 },
      { id: "glasses", weight: 1.2 },
      { id: "shades", weight: 0.8 },
    ]),
  };
}

function getHairColor(kind, palette) {
  if (kind === "mid") return palette.mid;
  if (kind === "accent") return palette.accent;
  if (kind === "accent2") return palette.accent2;
  return palette.dark;
}

function drawBlobFace(grid, rng, skin, shape, background) {
  const cx = 16 + int(rng, -1, 1);
  const y0 = 5 + int(rng, -1, 1);
  let width;
  let height;

  if (shape === "oval") {
    width = int(rng, 10, 12);
    height = int(rng, 13, 15);
  } else if (shape === "round") {
    width = int(rng, 11, 13);
    height = int(rng, 12, 14);
  } else if (shape === "long") {
    width = int(rng, 9, 11);
    height = int(rng, 14, 16);
  } else {
    width = int(rng, 11, 13);
    height = int(rng, 12, 14);
  }

  const x0 = cx - Math.floor(width / 2);
  const x1 = cx + Math.floor(width / 2);
  const y1 = y0 + height;

  if (shape === "square") {
    fillRoundedRect(grid, x0, y0, x1, y1, 2, skin, background);
  } else {
    fillEllipse(grid, x0, y0, x1, y1, skin);
  }

  fillRect(grid, cx - 2, y1 - 1, cx + 2, y1 + 3, skin);

  return { x0, y0, x1, y1, cx };
}

function drawOutfit(grid, rng, traits, palette, faceBox) {
  const { y1 } = faceBox;
  const dark = palette.dark;
  const mid = palette.mid;
  const accent = palette.accent;

  if (traits.outfit_type === "tee") {
    const points = [
      [7, 28], [10, 20], [22, 20], [25, 28],
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
      drawLine(grid, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], dark);
    }
    fillRect(grid, 10, 21, 22, 31, dark);
    clearRect(grid, 13, 20, 19, 24, palette.bg);
  } else if (traits.outfit_type === "hoodie") {
    fillRoundedRect(grid, 6, 20, 26, 31, 2, mid, palette.bg);
    drawLine(grid, 12, 22, 10, 29, dark);
    drawLine(grid, 20, 22, 22, 29, dark);
  } else if (traits.outfit_type === "jacket") {
    fillRoundedRect(grid, 6, 20, 26, 31, 2, dark, palette.bg);
    fillRect(grid, 14, 20, 17, 31, accent);
    drawLine(grid, 13, 20, 16, 24, palette.bg);
    drawLine(grid, 18, 20, 16, 24, palette.bg);
  } else {
    drawLine(grid, 8, 31, 9, 20, mid);
    drawLine(grid, 24, 31, 23, 20, mid);
    fillRect(grid, 9, 20, 23, 31, mid);
    for (let y = 22; y <= 30; y += 2) {
      drawLine(grid, 11, y, 21, y, dark);
    }
  }

  if (traits.accessory === "chain") {
    for (let x = 11; x <= 21; x += 2) {
      setPixel(grid, x, y1 + 4, accent);
      setPixel(grid, x + 1, y1 + 5, accent);
    }
  }

  if (traits.accessory === "earring") {
    setPixel(grid, faceBox.x1 + 1, faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) / 2), accent);
  }
}

function drawHair(grid, rng, traits, faceBox, palette) {
  const hairColor = getHairColor(traits.hair_color_kind, palette);
  const { x0, y0, x1, y1, cx } = faceBox;

  if (traits.hair_type === "bald") {
    drawPointCloud(grid, rng, x0 + 1, y0, x1 - 1, y0 + 4, int(rng, 6, 14), hairColor);
    return;
  }

  if (traits.hair_type === "buzz") {
    drawPointCloud(grid, rng, x0, y0 - 1, x1, y0 + 4, int(rng, 20, 34), hairColor);
    return;
  }

  if (traits.hair_type === "short") {
    fillEllipse(grid, x0 - 1, y0 - 3, x1 + 1, y0 + 5, hairColor);
  } else if (traits.hair_type === "fringe") {
    fillEllipse(grid, x0 - 1, y0 - 3, x1 + 1, y0 + 5, hairColor);
    for (let x = x0 + 1; x < x1 - 1; x += 2) {
      drawLine(grid, x, y0 + 2, x + 1, y0 + int(rng, 4, 6), hairColor);
    }
  } else if (traits.hair_type === "long") {
    fillEllipse(grid, x0 - 1, y0 - 3, x1 + 1, y0 + 5, hairColor);
    fillRect(grid, x0 - 1, y0 + 4, x0 + 1, y1 + 3, hairColor);
    fillRect(grid, x1 - 1, y0 + 4, x1 + 1, y1 + 3, hairColor);
  } else if (traits.hair_type === "spiky") {
    for (let x = x0; x <= x1; x += 2) {
      drawLine(grid, x, y0 + 2, x + 1, y0 - int(rng, 1, 4), hairColor);
    }
  } else if (traits.hair_type === "bun") {
    fillEllipse(grid, x0 - 1, y0 - 3, x1 + 1, y0 + 5, hairColor);
    const bunX = cx + int(rng, -1, 1);
    fillEllipse(grid, bunX - 2, y0 - 5, bunX + 2, y0 - 1, hairColor);
  }

  drawPointCloud(
    grid,
    rng,
    Math.max(0, x0 - 1),
    Math.max(0, y0 - 3),
    Math.min(GRID - 1, x1 + 1),
    Math.min(GRID - 1, y1 + 2),
    int(rng, 4, 12),
    hairColor
  );
}

function drawEyes(grid, rng, traits, faceBox, dark) {
  const cx = faceBox.cx;
  const eyeY = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.45);
  const spacing = int(rng, 2, 3);

  if (traits.eyes_type === "dots") {
    fillRect(grid, cx - spacing - 1, eyeY, cx - spacing, eyeY + 1, dark);
    fillRect(grid, cx + spacing, eyeY, cx + spacing + 1, eyeY + 1, dark);
  } else if (traits.eyes_type === "sleepy") {
    drawLine(grid, cx - spacing - 2, eyeY + 1, cx - spacing, eyeY, dark);
    drawLine(grid, cx + spacing, eyeY, cx + spacing + 2, eyeY + 1, dark);
  } else if (traits.eyes_type === "wide") {
    fillRect(grid, cx - spacing - 1, eyeY - 1, cx - spacing, eyeY + 1, dark);
    fillRect(grid, cx + spacing, eyeY - 1, cx + spacing + 1, eyeY + 1, dark);
  } else if (traits.eyes_type === "angry") {
    drawLine(grid, cx - spacing - 2, eyeY, cx - spacing, eyeY + 1, dark);
    drawLine(grid, cx + spacing, eyeY + 1, cx + spacing + 2, eyeY, dark);
  } else {
    fillRect(grid, cx - spacing - 2, eyeY, cx - spacing, eyeY, dark);
    fillRect(grid, cx + spacing, eyeY, cx + spacing + 2, eyeY, dark);
  }

  return { cx, eyeY, spacing };
}

function drawMouth(grid, traits, faceBox, dark) {
  const mx = faceBox.cx;
  const my = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.72);

  if (traits.mouth_type === "flat") {
    drawLine(grid, mx - 2, my, mx + 2, my, dark);
  } else if (traits.mouth_type === "smirk") {
    drawLine(grid, mx - 2, my, mx + 1, my, dark);
    setPixel(grid, mx + 2, my - 1, dark);
  } else if (traits.mouth_type === "sad") {
    setPixel(grid, mx - 2, my, dark);
    drawLine(grid, mx - 1, my - 1, mx + 1, my - 1, dark);
    setPixel(grid, mx + 2, my, dark);
  } else {
    fillEllipse(grid, mx - 1, my - 1, mx + 1, my + 1, dark);
  }
}

function drawNose(grid, rng, faceBox, dark) {
  const nx = faceBox.cx + int(rng, -1, 1);
  const ny = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.57);
  drawLine(grid, nx, ny - 1, nx - 1, ny + 1, dark);
}

function drawBeard(grid, rng, traits, faceBox, palette) {
  if (traits.beard_type === "none") return;

  const bc = palette.dark;
  const cx = faceBox.cx;

  if (traits.beard_type === "stubble") {
    drawPointCloud(grid, rng, faceBox.x0 + 2, faceBox.y0 + 8, faceBox.x1 - 2, faceBox.y1, int(rng, 16, 28), bc);
  } else if (traits.beard_type === "goatee") {
    drawLine(grid, cx - 2, faceBox.y1 - 2, cx, faceBox.y1 + 2, bc);
    drawLine(grid, cx + 2, faceBox.y1 - 2, cx, faceBox.y1 + 2, bc);
  } else if (traits.beard_type === "moustache") {
    const y = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.66);
    drawLine(grid, cx - 4, y, cx - 1, y + 1, bc);
    drawLine(grid, cx + 1, y + 1, cx + 4, y, bc);
  } else {
    fillRect(grid, faceBox.x0 + 2, faceBox.y1 - 3, faceBox.x1 - 2, faceBox.y1 + 3, bc);
    drawPointCloud(grid, rng, faceBox.x0 + 1, faceBox.y1 - 2, faceBox.x1 - 1, faceBox.y1 + 4, int(rng, 8, 16), bc);
  }
}

function drawGlasses(grid, rng, traits, faceBox, palette) {
  if (traits.eye_wear === "none" || traits.accessory === "vr") return;

  const dark = palette.dark;
  const fill = traits.eye_wear === "shades" ? palette.accent2 : null;
  const cx = faceBox.cx;
  const ey = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.45);
  const spacing = int(rng, 2, 3);

  const leftX0 = cx - spacing - 4;
  const leftX1 = cx - spacing;
  const rightX0 = cx + spacing;
  const rightX1 = cx + spacing + 4;

  fillRect(grid, leftX0, ey - 1, leftX1, ey + 1, fill || palette.bg);
  fillRect(grid, rightX0, ey - 1, rightX1, ey + 1, fill || palette.bg);
  drawLine(grid, leftX0, ey - 1, leftX1, ey - 1, dark);
  drawLine(grid, leftX0, ey + 1, leftX1, ey + 1, dark);
  drawLine(grid, leftX0, ey - 1, leftX0, ey + 1, dark);
  drawLine(grid, leftX1, ey - 1, leftX1, ey + 1, dark);
  drawLine(grid, rightX0, ey - 1, rightX1, ey - 1, dark);
  drawLine(grid, rightX0, ey + 1, rightX1, ey + 1, dark);
  drawLine(grid, rightX0, ey - 1, rightX0, ey + 1, dark);
  drawLine(grid, rightX1, ey - 1, rightX1, ey + 1, dark);
  drawLine(grid, cx - 1, ey, cx + 1, ey, dark);
}

function drawAccessory(grid, rng, traits, faceBox, palette) {
  const dark = palette.dark;
  const accent = palette.accent;
  const accent2 = palette.accent2;
  const cx = faceBox.cx;

  if (traits.accessory === "vr") {
    const vy = faceBox.y0 + Math.floor((faceBox.y1 - faceBox.y0) * 0.45);
    const width = int(rng, 8, 10);
    const height = int(rng, 3, 4);
    const x0 = cx - Math.floor(width / 2);
    const x1 = cx + Math.floor(width / 2);
    const y0 = vy - Math.floor(height / 2);
    const y1 = vy + Math.floor(height / 2);
    fillRoundedRect(grid, x0, y0, x1, y1, 1, accent2, palette.bg);
    if (chance(rng, 0.6)) {
      drawLine(grid, x0 + 1, y0 + 1, x1 - 1, y0 + 1, accent);
      drawLine(grid, x0 + 1, y1 - 1, x1 - 1, y1 - 1, accent);
    }
    drawLine(grid, x0, vy, faceBox.x0 - 1, vy - 1, dark);
    drawLine(grid, x1, vy, faceBox.x1 + 1, vy - 1, dark);
    drawPointCloud(grid, rng, x0, y0, x1, y1, int(rng, 3, 8), accent);
  } else if (traits.accessory === "cap") {
    const top = faceBox.y0 - 2;
    fillRoundedRect(grid, faceBox.x0, top, faceBox.x1, faceBox.y0 + 2, 1, accent, palette.bg);
    fillRect(grid, cx - 4, faceBox.y0 + 2, cx + 3, faceBox.y0 + 3, dark);
  } else if (traits.accessory === "horns") {
    drawLine(grid, faceBox.x0 + 3, faceBox.y0 + 1, faceBox.x0 + 1, faceBox.y0 - 4, accent);
    drawLine(grid, faceBox.x1 - 3, faceBox.y0 + 1, faceBox.x1 - 1, faceBox.y0 - 4, accent);
  } else if (traits.accessory === "halo") {
    fillEllipse(grid, cx - 5, faceBox.y0 - 5, cx + 5, faceBox.y0 - 3, accent2);
    clearRect(grid, cx - 4, faceBox.y0 - 5, cx + 4, faceBox.y0 - 3, palette.bg);
  }
}

function addNoise(grid, rng, palette, strength = 36) {
  const colors = [palette.dark, palette.mid, palette.accent, palette.accent2];
  for (let i = 0; i < strength; i += 1) {
    const x = int(rng, 0, GRID - 1);
    const y = int(rng, 0, GRID - 1);
    if (!chance(rng, 0.76)) continue;
    setPixel(grid, x, y, colors[int(rng, 0, colors.length - 1)]);
  }
}

function calculateCoverage(grid, background) {
  const total = grid.length * grid[0].length;
  let filled = 0;

  for (const row of grid) {
    for (const value of row) {
      if (value !== background) filled += 1;
    }
  }

  return Math.round((filled / total) * 100);
}

function hashGrid(grid) {
  return grid.map((row) => row.join("")).join("|");
}

export function generateProceduralPortrait(seed = Date.now(), size = GRID) {
  const rng = createRng(seed);
  const traits = makeTraits(rng);
  const palette = pickPaletteByName(traits.palette);
  const grid = createGrid(size, palette.bg);
  const faceBox = drawBlobFace(grid, rng, palette.skin, traits.face_shape, palette.bg);
  const dark = palette.dark;

  drawOutfit(grid, rng, traits, palette, faceBox);
  drawHair(grid, rng, traits, faceBox, palette);
  drawAccessory(grid, rng, traits, faceBox, palette);
  drawEyes(grid, rng, traits, faceBox, dark);
  drawGlasses(grid, rng, traits, faceBox, palette);
  drawNose(grid, rng, faceBox, dark);
  drawMouth(grid, traits, faceBox, dark);
  drawBeard(grid, rng, traits, faceBox, palette);
  addNoise(grid, rng, palette, int(rng, 18, 46));

  return {
    grid,
    meta: {
      mode: "procedural_1of1",
      seed,
      type: "color_normie",
      coverage: `${calculateCoverage(grid, palette.bg)}%`,
      silhouette: "head_and_shoulders",
      face: traits.face_shape,
      brow: traits.eye_wear === "shades" ? "covered" : "standard",
      nose: "classic",
      hair: traits.hair_type,
      eyes: traits.eyes_type,
      mouth: traits.mouth_type,
      clothing: traits.outfit_type,
      artifacts: traits.accessory,
      palette: traits.palette,
      eyewear: traits.eye_wear,
      beard: traits.beard_type,
      signature: stableSignature(traits),
      gridHash: hashGrid(grid),
    },
  };
}

export function generateProceduralBatch(count = 8, baseSeed = Date.now(), size = GRID) {
  const seen = new Set();
  const batch = [];
  let attempts = 0;

  while (batch.length < count && attempts < count * 40) {
    const candidate = generateProceduralPortrait(baseSeed + attempts * 9973, size);
    const key = `${candidate.meta.signature}:${candidate.meta.gridHash}`;
    attempts += 1;
    if (seen.has(key) && Math.random() < 0.8) continue;
    seen.add(key);
    batch.push(candidate);
  }

  return batch;
}
