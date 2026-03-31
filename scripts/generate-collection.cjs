/**
 * Dwellers — Site Collection Generator
 *
 * 16x16 front-facing pixel characters, 4-bit color depth (16 colors).
 * Deterministic: seed (tokenId) -> always the same character.
 *
 * Usage:
 *   node scripts/generate-collection.cjs [count] [startId]
 *   node scripts/generate-collection.cjs 1000 0
 *
 * Output:
 *   frontend/public/collection/images/*.svg
 *   frontend/public/collection/metadata/*.json
 *   frontend/public/collection/summary.json
 *   frontend/src/utils/generatedCollection.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC_COLLECTION_DIR = path.join(ROOT, "frontend", "public", "collection");
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_COLLECTION_DIR, "images");
const PUBLIC_METADATA_DIR = path.join(PUBLIC_COLLECTION_DIR, "metadata");
const PUBLIC_PAYLOADS_DIR = path.join(PUBLIC_COLLECTION_DIR, "payloads");
const GENERATED_COLLECTION_MODULE = path.join(ROOT, "frontend", "src", "utils", "generatedCollection.js");

// ══════════════════════════════════════════════
//  SEEDED RNG
// ══════════════════════════════════════════════

function rng(seed) {
  let h = (seed * 7919 + 1) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
}

function pick(rand, options) {
  const total = options.reduce((s, o) => s + o.w, 0);
  let r = rand() * total;
  for (const o of options) {
    r -= o.w;
    if (r <= 0) return o;
  }
  return options[options.length - 1];
}

// ══════════════════════════════════════════════
//  COLOR MATH
// ══════════════════════════════════════════════

function hexC(r, g, b) {
  return "#" + [r, g, b]
    .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
    .join("");
}

function parseHex(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function darken(h, amount = 30) {
  const [r, g, b] = parseHex(h);
  return hexC(r - amount, g - amount, b - amount);
}

function lighten(h, amount = 25) {
  const [r, g, b] = parseHex(h);
  return hexC(r + amount, g + amount, b + amount);
}

// ══════════════════════════════════════════════
//  TRAIT TABLES (expanded for 10K)
// ══════════════════════════════════════════════

const BASE_TYPES = [
  { i: "human_light",  w: 28, sk: "#DFB888" },
  { i: "human_tan",    w: 22, sk: "#C89868" },
  { i: "human_dark",   w: 18, sk: "#7B4B31" },
  { i: "human_pale",   w: 9,  sk: "#F0D8C8" },
  { i: "alien_green",  w: 5,  sk: "#60C878" },
  { i: "alien_blue",   w: 4,  sk: "#70A0D8" },
  { i: "zombie",       w: 5,  sk: "#607B42" },
  { i: "demon",        w: 4,  sk: "#584068" },
  { i: "robot",        w: 3,  sk: "#A8B0C0" },
  { i: "gold",         w: 2,  sk: "#D8B060" },
];

const BACKGROUNDS = [
  { i: "crimson",   w: 15, c: "#C84040" },
  { i: "navy",      w: 15, c: "#1A2840" },
  { i: "forest",    w: 12, c: "#1C3020" },
  { i: "purple",    w: 12, c: "#2A1838" },
  { i: "gold",      w: 10, c: "#B89030" },
  { i: "ice",       w: 10, c: "#A0C8E0" },
  { i: "midnight",  w: 14, c: "#101420" },
  { i: "slate",     w: 12, c: "#484858" },
];

const HAIR_STYLES = [
  { i: "short",     w: 20, rows: 2 },
  { i: "tall",      w: 12, rows: 3 },
  { i: "flat",      w: 15, rows: 1 },
  { i: "mohawk",    w: 8,  rows: 3, narrow: true },
  { i: "long",      w: 8,  rows: 2, sides: true },
  { i: "bald",      w: 7,  rows: 0 },
  { i: "beanie",    w: 10, rows: 2, beanie: true },
  { i: "spiky",     w: 6,  rows: 3, spiky: true },
  { i: "afro",      w: 5,  rows: 3, wide: true },
  { i: "side_part", w: 4,  rows: 2, part: true },
  { i: "ponytail",  w: 3,  rows: 2, tail: true },
  { i: "buzz",      w: 2,  rows: 1, buzz: true },
];

const HAIR_COLORS = [
  { i: "black",    w: 22, c: "#181818" },
  { i: "brown",    w: 20, c: "#6A3A20" },
  { i: "red",      w: 12, c: "#A03030" },
  { i: "blonde",   w: 10, c: "#D0A040" },
  { i: "white",    w: 7,  c: "#E0E0F0" },
  { i: "blue",     w: 7,  c: "#4070C0" },
  { i: "pink",     w: 6,  c: "#D060A0" },
  { i: "purple",   w: 5,  c: "#8040C0" },
  { i: "green",    w: 4,  c: "#40A060" },
  { i: "orange",   w: 3,  c: "#D07030" },
  { i: "silver",   w: 2,  c: "#B0B8C8" },
  { i: "teal",     w: 2,  c: "#40A0A0" },
];

const EYE_TYPES = [
  { i: "normal",    w: 30, c: null },
  { i: "green",     w: 12, c: "#2A6830" },
  { i: "blue",      w: 12, c: "#3060B0" },
  { i: "red",       w: 5,  c: "#D03030" },
  { i: "yellow",    w: 5,  c: "#D0C030" },
  { i: "cyan",      w: 8,  c: "#40A8C0" },
  { i: "shades",    w: 10, c: "#222230" },
  { i: "visor",     w: 5,  c: "#40D8E8" },
  { i: "laser",     w: 3,  c: "#FF3030" },
  { i: "closed",    w: 10, c: null },
];

const MOUTH_TYPES = [
  { i: "neutral",  w: 25 },
  { i: "smile",    w: 20 },
  { i: "teeth",    w: 12 },
  { i: "fangs",    w: 5 },
  { i: "open",     w: 12 },
  { i: "small",    w: 10 },
  { i: "grin",     w: 8 },
  { i: "frown",    w: 8 },
];

const SHIRT_STYLES = [
  { i: "tee",      w: 22 },
  { i: "hoodie",   w: 16 },
  { i: "suit",     w: 8 },
  { i: "tank",     w: 12 },
  { i: "collar",   w: 12 },
  { i: "none",     w: 8 },
  { i: "vneck",    w: 10 },
  { i: "turtleneck", w: 12 },
];

const SHIRT_COLORS = [
  { i: "white",   w: 16, c: "#F0F0F0" },
  { i: "black",   w: 14, c: "#282830" },
  { i: "blue",    w: 12, c: "#5874D8" },
  { i: "red",     w: 10, c: "#C84040" },
  { i: "yellow",  w: 8,  c: "#E8C040" },
  { i: "purple",  w: 7,  c: "#7F5AD8" },
  { i: "green",   w: 8,  c: "#40A060" },
  { i: "grey",    w: 8,  c: "#707880" },
  { i: "orange",  w: 5,  c: "#D07838" },
  { i: "pink",    w: 4,  c: "#D870A0" },
];

const ACCESSORIES = [
  { i: "none",      w: 30 },
  { i: "earring_gold",  w: 10 },
  { i: "earring_silver", w: 8 },
  { i: "chain",     w: 7 },
  { i: "scar",      w: 6 },
  { i: "blush",     w: 8 },
  { i: "crown",     w: 2 },
  { i: "mask",      w: 5 },
  { i: "tattoo",    w: 4 },
  { i: "bandaid",   w: 6 },
  { i: "nose_ring", w: 4 },
  { i: "monocle",   w: 3 },
];

// ══════════════════════════════════════════════
//  PIXEL RENDERER
// ══════════════════════════════════════════════

function generate(seed) {
  const rand = rng(seed);
  const grid = new Array(256).fill("#000000");

  const set = (x, y, c) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) grid[y * 16 + x] = c;
  };
  const fill = (x1, y1, x2, y2, c) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++) set(x, y, c);
  };

  // ── Pick all traits ──
  const base = pick(rand, BASE_TYPES);
  const bg = pick(rand, BACKGROUNDS);
  const hairStyle = pick(rand, HAIR_STYLES);
  const hairColor = pick(rand, HAIR_COLORS);
  const eyeType = pick(rand, EYE_TYPES);
  const mouthType = pick(rand, MOUTH_TYPES);
  const shirtStyle = pick(rand, SHIRT_STYLES);
  const shirtColor = pick(rand, SHIRT_COLORS);
  const accessory = pick(rand, ACCESSORIES);

  const sk = base.sk;
  const skD = darken(sk, 32);
  const skL = lighten(sk, 25);
  const hr = hairColor.c;
  const hrD = darken(hr, 25);
  const hrL = lighten(hr, 20);
  const sh = shirtColor.c;
  const shD = darken(sh, 30);
  const shL = lighten(sh, 20);

  // ── Background ──
  fill(0, 0, 15, 15, bg.c);

  // ── Hair ──
  const ht = hairStyle.rows === 0 ? 4 : Math.max(1, 4 - hairStyle.rows);
  if (hairStyle.rows > 0) {
    const hL = hairStyle.narrow ? 6 : (hairStyle.wide ? 1 : 3);
    const hR = hairStyle.narrow ? 9 : (hairStyle.wide ? 14 : 12);
    for (let y = ht; y < 4; y++) {
      const inset = y === ht && !hairStyle.wide ? 1 : 0;
      for (let x = hL + inset; x <= hR - inset; x++) {
        set(x, y, (x + y) % 3 === 0 ? hrL : ((x + y) % 5 === 0 ? hrD : hr));
      }
    }
    if (hairStyle.spiky) {
      for (const x of [4, 7, 10, 13]) set(x, ht - 1, hr);
      for (const x of [5, 8, 11]) set(x, ht - 1, hrL);
    }
    if (hairStyle.sides) {
      for (let y = 4; y <= 8; y++) {
        set(2, y, hr); set(13, y, hr);
        if (y <= 6) { set(1, y, hrD); set(14, y, hrD); }
      }
    }
    if (hairStyle.part) {
      set(6, ht, skL); set(6, ht + 1, skL);
    }
    if (hairStyle.tail) {
      set(13, 4, hr); set(14, 5, hr); set(14, 6, hr); set(14, 7, hrD); set(14, 8, hrD);
    }
    if (hairStyle.beanie) {
      for (let x = 3; x <= 12; x++) {
        set(x, 1, hrD);
        set(x, 2, x % 2 === 0 ? hrL : hr);
        set(x, 3, hr);
      }
    }
    if (hairStyle.buzz) {
      for (let x = 3; x <= 12; x++) set(x, 3, (x % 2 === 0) ? hrD : darken(sk, 10));
    }
  }

  // ── Face ──
  fill(3, 4, 12, 10, sk);
  set(2, 5, sk); set(2, 6, skD); set(2, 7, sk);
  set(13, 5, sk); set(13, 6, skD); set(13, 7, sk);
  for (let x = 4; x <= 11; x++) set(x, 4, skL);
  set(3, 4, sk); set(12, 4, sk);
  set(3, 10, skD); set(12, 10, skD);
  set(5, 10, skD); set(6, 10, skD); set(9, 10, skD); set(10, 10, skD);

  // ── Eyes ──
  const ec = eyeType.c || (base.i.includes("alien") ? "#D0D030" : "#2A4828");
  if (eyeType.i === "shades") {
    fill(4, 6, 11, 7, "#222230");
    set(5, 6, "#333845"); set(10, 6, "#333845");
  } else if (eyeType.i === "visor") {
    fill(3, 6, 12, 7, ec);
    set(4, 6, lighten(ec, 40)); set(11, 6, lighten(ec, 40));
  } else if (eyeType.i === "laser") {
    set(5, 6, ec); set(6, 6, ec); set(9, 6, ec); set(10, 6, ec);
    set(5, 7, ec); set(6, 7, ec); set(9, 7, ec); set(10, 7, ec);
    for (let x = 12; x <= 15; x++) { set(x, 6, ec); set(x, 7, lighten(ec, 30)); }
  } else if (eyeType.i === "closed") {
    set(5, 7, skD); set(6, 7, skD); set(9, 7, skD); set(10, 7, skD);
    set(5, 5, skD); set(6, 5, skD); set(9, 5, skD); set(10, 5, skD);
  } else {
    set(4, 6, skD); set(5, 6, "#FFF"); set(6, 6, ec); set(7, 6, sk);
    set(4, 7, skD); set(5, 7, "#FFF"); set(6, 7, ec); set(7, 7, sk);
    set(8, 6, skD); set(9, 6, ec); set(10, 6, "#FFF"); set(11, 6, skD);
    set(8, 7, skD); set(9, 7, ec); set(10, 7, "#FFF"); set(11, 7, skD);
    set(5, 5, skD); set(6, 5, skD); set(9, 5, skD); set(10, 5, skD);
  }

  // ── Nose ──
  set(7, 8, skD); set(8, 8, skD);

  // ── Mouth ──
  const mc = base.i === "zombie" ? "#3A4A28" :
             base.i === "demon" ? "#C848C8" :
             base.i === "robot" ? "#40A0D0" :
             darken(bg.c, -20);
  const mcD = darken(mc, 20);

  if (mouthType.i === "teeth" || mouthType.i === "fangs") {
    set(5, 9, mcD); set(6, 9, mc); set(7, 9, "#F0F0F0"); set(8, 9, "#F0F0F0"); set(9, 9, mc); set(10, 9, mcD);
    if (mouthType.i === "fangs") { set(6, 9, "#F0F0F0"); set(9, 9, "#F0F0F0"); }
  } else if (mouthType.i === "grin") {
    set(5, 9, skD); set(6, 9, mc); set(7, 9, "#F0F0F0"); set(8, 9, "#F0F0F0"); set(9, 9, mc); set(10, 9, skD);
    set(5, 10, skD); set(10, 10, skD);
  } else if (mouthType.i === "frown") {
    set(6, 9, mc); set(7, 9, mc); set(8, 9, mc); set(9, 9, mc);
    set(5, 8, skD); set(10, 8, skD);
  } else if (mouthType.i === "smile") {
    for (let x = 5; x <= 10; x++) set(x, 9, x === 5 || x === 10 ? skD : mc);
    set(6, 10, skD); set(9, 10, skD);
  } else if (mouthType.i === "open") {
    set(6, 9, mc); set(7, 9, darken(mc, 30)); set(8, 9, darken(mc, 30)); set(9, 9, mc);
  } else if (mouthType.i === "small") {
    set(7, 9, mc); set(8, 9, mc);
  } else {
    for (let x = 5; x <= 10; x++) set(x, 9, x === 5 || x === 10 ? mcD : mc);
  }

  // ── Neck ──
  for (let x = 5; x <= 10; x++) set(x, 11, x === 5 || x === 10 ? skD : sk);

  // ── Shirt ──
  if (shirtStyle.i !== "none") {
    fill(2, 12, 13, 15, sh);
    for (let y = 12; y <= 15; y++) { set(2, y, shD); set(13, y, shD); }
    fill(3, 15, 12, 15, shD);
    set(7, 11, shD); set(8, 11, shD);
    if (shirtStyle.i === "hoodie") {
      set(7, 12, shD); set(8, 12, shD); set(6, 12, shL); set(9, 12, shL);
    } else if (shirtStyle.i === "collar") {
      set(5, 12, shL); set(6, 12, shL); set(9, 12, shL); set(10, 12, shL);
    } else if (shirtStyle.i === "suit") {
      set(5, 12, shD); set(10, 12, shD);
      set(7, 12, "#C84040"); set(8, 12, "#C84040");
      set(7, 13, "#C84040"); set(8, 13, "#C84040");
    } else if (shirtStyle.i === "tank") {
      set(3, 12, sk); set(4, 12, sk); set(11, 12, sk); set(12, 12, sk);
      set(3, 13, sk); set(12, 13, sk);
    } else if (shirtStyle.i === "vneck") {
      set(6, 12, sk); set(7, 12, sk); set(8, 12, sk); set(9, 12, sk);
      set(7, 13, sk); set(8, 13, sk);
    } else if (shirtStyle.i === "turtleneck") {
      fill(5, 11, 10, 12, sh);
      set(5, 11, shD); set(10, 11, shD);
    }
    if (rand() > 0.5) { set(7, 14, shD); set(8, 14, shD); }
  } else {
    fill(2, 12, 13, 15, sk);
    for (let y = 12; y <= 15; y++) { set(2, y, skD); set(13, y, skD); }
  }

  // ── Accessories ──
  if (accessory.i === "earring_gold") {
    set(2, 8, "#D9AC3F"); set(2, 9, "#E8C050");
  } else if (accessory.i === "earring_silver") {
    set(2, 8, "#B0B8C8"); set(2, 9, "#D0D4E0");
  } else if (accessory.i === "chain") {
    for (let x = 4; x <= 11; x++) set(x, 13, x % 2 === 0 ? "#D9AC3F" : "#E8C050");
    for (let x = 5; x <= 10; x++) set(x, 14, x % 2 === 0 ? "#E8C050" : "#D9AC3F");
  } else if (accessory.i === "scar") {
    set(10, 7, "#C08080"); set(11, 8, "#C08080"); set(11, 9, "#C08080");
  } else if (accessory.i === "blush") {
    set(4, 8, "#E0A0A0"); set(11, 8, "#E0A0A0");
    set(4, 9, "#E0A0A0"); set(11, 9, "#E0A0A0");
  } else if (accessory.i === "crown") {
    for (let x = 5; x <= 10; x++) set(x, ht - 1, "#D9AC3F");
    for (const x of [5, 7, 9]) set(x, ht - 2, "#D9AC3F");
    set(6, ht - 2, "#D14F4F"); set(8, ht - 2, "#5874D8");
  } else if (accessory.i === "mask") {
    for (let x = 4; x <= 11; x++) {
      set(x, 8, "#282830"); set(x, 9, "#282830"); set(x, 10, "#282830");
    }
  } else if (accessory.i === "tattoo") {
    set(3, 8, "#4A6880"); set(3, 9, "#4A6880"); set(4, 9, "#4A6880");
  } else if (accessory.i === "bandaid") {
    set(10, 8, "#E8D0A0"); set(11, 8, "#E8D0A0"); set(10, 9, "#E8D0A0"); set(11, 9, "#E8D0A0");
  } else if (accessory.i === "nose_ring") {
    set(8, 9, "#D9AC3F");
  } else if (accessory.i === "monocle") {
    set(8, 5, "#D9AC3F"); set(9, 5, "#D9AC3F"); set(10, 5, "#D9AC3F"); set(11, 5, "#D9AC3F");
    set(8, 8, "#D9AC3F"); set(11, 8, "#D9AC3F");
    set(11, 9, "#D9AC3F"); set(11, 10, "#D9AC3F"); set(11, 11, "#D9AC3F");
  }

  // ── Build trait key (for uniqueness) ──
  const traitKey = [
    base.i, bg.i, hairStyle.i, hairColor.i,
    eyeType.i, mouthType.i, shirtStyle.i, shirtColor.i, accessory.i
  ].join("|");

  const traits = {
    base: base.i.replace(/_/g, " "),
    background: bg.i,
    hair: hairStyle.i + " " + hairColor.i,
    eyes: eyeType.i,
    mouth: mouthType.i,
    shirt: shirtStyle.i !== "none" ? shirtColor.i + " " + shirtStyle.i : "none",
    accessory: accessory.i.replace(/_/g, " "),
  };

  const tier = base.w <= 3 ? "Legendary" :
               base.w <= 5 ? "Epic" :
               base.w <= 10 ? "Rare" :
               base.w <= 20 ? "Uncommon" : "Common";

  return { grid, traits, traitKey, tier };
}

// ══════════════════════════════════════════════
//  ON-CHAIN PAYLOAD (4-bit packed, 128 bytes)
// ══════════════════════════════════════════════

const CONTRACT_PALETTE = [
  [0x00,0x00,0x00], [0xFF,0x00,0x00], [0x00,0xFF,0x00], [0x00,0x00,0xFF],
  [0xFF,0xFF,0x00], [0xFF,0x00,0xFF], [0x00,0xFF,0xFF], [0xFF,0xFF,0xFF],
  [0x80,0x00,0x00], [0x00,0x80,0x00], [0x00,0x00,0x80], [0x80,0x80,0x00],
  [0x80,0x00,0x80], [0x00,0x80,0x80], [0x80,0x80,0x80], [0xC0,0xC0,0xC0],
];

function nearestPaletteIndex(hexColor) {
  const [r, g, b] = parseHex(hexColor);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < CONTRACT_PALETTE.length; i++) {
    const [pr, pg, pb] = CONTRACT_PALETTE[i];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Convert a 256-element hex grid into a 128-byte packed 4-bit payload (hex string). */
function toPayload(grid) {
  const indices = grid.map(nearestPaletteIndex);
  const bytes = [];
  for (let i = 0; i < 256; i += 2) {
    bytes.push((indices[i] << 4) | indices[i + 1]);
  }
  return "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ══════════════════════════════════════════════
//  SVG EXPORT
// ══════════════════════════════════════════════

function toSVG(grid) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 16 16" style="image-rendering:pixelated;shape-rendering:crispEdges">';
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${grid[y * 16 + x]}"/>`;
  return svg + "</svg>";
}

// ══════════════════════════════════════════════
//  METADATA (ERC-721 compatible)
// ══════════════════════════════════════════════

function toMetadata(tokenId, traits, tier) {
  return {
    name: `Dwellers #${tokenId}`,
    description: "Fully on-chain pixel art. No IPFS. No servers. Forever.",
    image: `images/${tokenId}.svg`,
    attributes: [
      { trait_type: "Base", value: traits.base },
      { trait_type: "Background", value: traits.background },
      { trait_type: "Hair", value: traits.hair },
      { trait_type: "Eyes", value: traits.eyes },
      { trait_type: "Mouth", value: traits.mouth },
      { trait_type: "Shirt", value: traits.shirt },
      { trait_type: "Accessory", value: traits.accessory },
      { trait_type: "Tier", value: tier },
    ],
  };
}

function writeGeneratedCollectionModule(collection) {
  const featured = collection.slice(0, Math.min(4, collection.length)).map((item) => item.id);
  const file = [
    `export const COLLECTION_SUPPLY = ${collection.length};`,
    `export const FEATURED_COLLECTION_IDS = ${JSON.stringify(featured)};`,
    "",
    `export const GENERATED_COLLECTION = ${JSON.stringify(collection, null, 2)};`,
    "",
  ].join("\n");

  fs.writeFileSync(GENERATED_COLLECTION_MODULE, file);
}

function resetOutputDirectory(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

// ══════════════════════════════════════════════
//  BATCH GENERATOR
// ══════════════════════════════════════════════

function generateCollection(count = 1000, startId = 0) {
  resetOutputDirectory(PUBLIC_IMAGES_DIR);
  resetOutputDirectory(PUBLIC_METADATA_DIR);
  resetOutputDirectory(PUBLIC_PAYLOADS_DIR);

  const seen = new Set();
  const traitStats = {};
  const generatedCollection = [];
  let dupes = 0;
  let generated = 0;
  let seed = startId;

  console.log(`Generating ${count} unique NFTs starting from seed ${startId}...`);
  const t0 = Date.now();

  while (generated < count) {
    const result = generate(seed);

    if (seen.has(result.traitKey)) {
      dupes++;
      seed++;
      continue;
    }

    seen.add(result.traitKey);
    const tokenId = startId + generated;

    // Write SVG
    fs.writeFileSync(path.join(PUBLIC_IMAGES_DIR, `${tokenId}.svg`), toSVG(result.grid));

    // Write metadata
    const meta = toMetadata(tokenId, result.traits, result.tier);
    fs.writeFileSync(path.join(PUBLIC_METADATA_DIR, `${tokenId}.json`), JSON.stringify(meta, null, 2));

    // Write on-chain payload (4-bit packed, 128 bytes)
    const payload = toPayload(result.grid);
    fs.writeFileSync(path.join(PUBLIC_PAYLOADS_DIR, `${tokenId}.txt`), payload);

    generatedCollection.push({
      id: tokenId,
      name: meta.name,
      ...result.traits,
      tier: result.tier,
    });

    // Track stats
    for (const [category, value] of Object.entries(result.traits)) {
      if (!traitStats[category]) traitStats[category] = {};
      traitStats[category][value] = (traitStats[category][value] || 0) + 1;
    }

    generated++;
    seed++;

    if (generated % 1000 === 0) {
      console.log(`  ${generated} / ${count} (${dupes} dupes skipped)`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Write summary
  const summary = {
    total: count,
    duplicatesSkipped: dupes,
    seedRange: [startId, seed - 1],
    generatedAt: new Date().toISOString(),
    elapsedSeconds: parseFloat(elapsed),
    traitDistribution: traitStats,
  };

  fs.writeFileSync(path.join(PUBLIC_COLLECTION_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  // Write combined payloads for batch-mint script
  const allPayloads = {};
  for (let i = startId; i < startId + count; i++) {
    allPayloads[i] = fs.readFileSync(path.join(PUBLIC_PAYLOADS_DIR, `${i}.txt`), "utf8");
  }
  fs.writeFileSync(path.join(PUBLIC_COLLECTION_DIR, "payloads.json"), JSON.stringify(allPayloads, null, 2));

  writeGeneratedCollectionModule(generatedCollection);

  console.log(`\nDone in ${elapsed}s`);
  console.log(`  ${count} unique NFTs -> frontend/public/collection/`);
  console.log(`  ${dupes} duplicates skipped`);
  console.log(`  Trait distribution -> frontend/public/collection/summary.json`);
  console.log(`  Generated collection module -> frontend/src/utils/generatedCollection.js`);

  return summary;
}

// ══════════════════════════════════════════════
//  CLI
// ══════════════════════════════════════════════

if (require.main === module) {
  const count = parseInt(process.argv[2]) || 1000;
  const startId = parseInt(process.argv[3]) || 0;
  generateCollection(count, startId);
}

module.exports = { generate, toSVG, toMetadata, generateCollection, toPayload };
