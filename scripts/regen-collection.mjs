// Legacy helper: regenerates a separate 32x32 portrait collection using proceduralPortraitGenerator
// Run: node scripts/regen-collection.mjs

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IMAGES_DIR = join(ROOT, "frontend/public/collection/images");
const META_DIR = join(ROOT, "frontend/public/collection/metadata");
const TOTAL = 500;

// ── inline the generator (ESM-friendly copy) ────────────────────────────────
const GRID = 32;
const PALETTES = [
  { name: "candy", bg: 1, skin: 14, dark: 13, mid: 15, accent: 9, accent2: 8 },
  { name: "mint",  bg: 1, skin: 14, dark: 13, mid: 10, accent: 3, accent2: 6 },
  { name: "sunset",bg:12, skin: 14, dark: 13, mid: 11, accent: 6, accent2: 5 },
  { name: "cyber", bg: 1, skin: 14, dark: 13, mid:  4, accent: 7, accent2: 8 },
  { name: "forest",bg:12, skin: 11, dark: 13, mid: 10, accent: 6, accent2: 3 },
  { name: "mono-red",bg:1,skin:14, dark:13, mid:11, accent:2, accent2:15 },
];

// Palette hex colours (index = palette slot)
const HEX = [
  "#0d0d1a","#f2f2f2","#d14f4f","#52c86b","#5874d8","#d9ac3f",
  "#c3763b","#7f5ad8","#53bdd0","#cf62ae","#607b42","#7b4b31",
  "#d7ccb0","#555b72","#dfb187","#9bbde3",
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
  const total = options.reduce((s, o) => s + o.weight, 0);
  let cursor = rng() * total;
  for (const o of options) { cursor -= o.weight; if (cursor <= 0) return o.id; }
  return options[options.length - 1].id;
}
function int(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function chance(rng, p) { return rng() < p; }
function createGrid(size, fill) { return Array.from({length:size}, () => Array(size).fill(fill)); }
function setPixel(g, x, y, c) { if (x>=0&&x<g[0].length&&y>=0&&y<g.length) g[y][x]=c; }
function fillRect(g,x1,y1,x2,y2,c) { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) setPixel(g,x,y,c); }
function clearRect(g,x1,y1,x2,y2,bg) { fillRect(g,x1,y1,x2,y2,bg); }
function fillEllipse(g,x1,y1,x2,y2,c) {
  const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.max(1,(x2-x1)/2),ry=Math.max(1,(y2-y1)/2);
  for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) {
    const dx=(x-cx)/rx,dy=(y-cy)/ry;
    if(dx*dx+dy*dy<=1) setPixel(g,x,y,c);
  }
}
function fillRoundedRect(g,x1,y1,x2,y2,r,c,bg) {
  fillRect(g,x1,y1,x2,y2,c);
  for(let dy=0;dy<r;dy++) for(let dx=0;dx<r;dx++) {
    if(dx*dx+dy*dy<(r-1)*(r-1)) continue;
    setPixel(g,x1+dx,y1+dy,bg); setPixel(g,x2-dx,y1+dy,bg);
    setPixel(g,x1+dx,y2-dy,bg); setPixel(g,x2-dx,y2-dy,bg);
  }
}
function drawLine(g,x1,y1,x2,y2,c) {
  let dx=Math.abs(x2-x1),dy=-Math.abs(y2-y1),sx=x1<x2?1:-1,sy=y1<y2?1:-1,err=dx+dy,x=x1,y=y1;
  while(true){setPixel(g,x,y,c);if(x===x2&&y===y2)break;const e2=2*err;if(e2>=dy){err+=dy;x+=sx;}if(e2<=dx){err+=dx;y+=sy;}}
}
function drawPointCloud(g,rng,x1,y1,x2,y2,n,c){for(let i=0;i<n;i++)setPixel(g,int(rng,x1,x2),int(rng,y1,y2),c);}
function weightedChoice(rng,items){return pickWeighted(rng,items);}
function pickPaletteByName(n){return PALETTES.find(p=>p.name===n)||PALETTES[0];}

function makeTraits(rng){
  return {
    palette: PALETTES[int(rng,0,PALETTES.length-1)].name,
    face_shape: weightedChoice(rng,[{id:"oval",weight:4},{id:"round",weight:3},{id:"long",weight:2},{id:"square",weight:1.5}]),
    hair_type: weightedChoice(rng,[{id:"short",weight:3},{id:"spiky",weight:1.4},{id:"long",weight:1.8},{id:"fringe",weight:2.2},{id:"buzz",weight:1.1},{id:"bald",weight:0.8},{id:"bun",weight:0.7}]),
    eyes_type: weightedChoice(rng,[{id:"dots",weight:2},{id:"sleepy",weight:1.7},{id:"bar",weight:2},{id:"wide",weight:1.2},{id:"angry",weight:1}]),
    mouth_type: weightedChoice(rng,[{id:"flat",weight:2.4},{id:"smirk",weight:1.5},{id:"open",weight:0.8},{id:"sad",weight:0.7}]),
    outfit_type: weightedChoice(rng,[{id:"tee",weight:2.5},{id:"hoodie",weight:1.6},{id:"jacket",weight:1.3},{id:"robe",weight:0.7}]),
    accessory: weightedChoice(rng,[{id:"none",weight:4},{id:"earring",weight:1},{id:"chain",weight:1},{id:"vr",weight:0.9},{id:"cap",weight:1.1},{id:"horns",weight:0.4},{id:"halo",weight:0.25}]),
    beard_type: weightedChoice(rng,[{id:"none",weight:4},{id:"stubble",weight:1.2},{id:"goatee",weight:0.9},{id:"full",weight:0.8},{id:"moustache",weight:0.7}]),
    hair_color_kind: weightedChoice(rng,[{id:"dark",weight:3.5},{id:"mid",weight:2},{id:"accent",weight:1.2},{id:"accent2",weight:1}]),
    eye_wear: weightedChoice(rng,[{id:"none",weight:4.2},{id:"glasses",weight:1.2},{id:"shades",weight:0.8}]),
  };
}
function getHairColor(kind,p){if(kind==="mid")return p.mid;if(kind==="accent")return p.accent;if(kind==="accent2")return p.accent2;return p.dark;}

function drawBlobFace(g,rng,skin,shape,bg){
  const cx=16+int(rng,-1,1),y0=5+int(rng,-1,1);
  let w,h;
  if(shape==="oval"){w=int(rng,10,12);h=int(rng,13,15);}
  else if(shape==="round"){w=int(rng,11,13);h=int(rng,12,14);}
  else if(shape==="long"){w=int(rng,9,11);h=int(rng,14,16);}
  else{w=int(rng,11,13);h=int(rng,12,14);}
  const x0=cx-Math.floor(w/2),x1=cx+Math.floor(w/2),y1=y0+h;
  if(shape==="square") fillRoundedRect(g,x0,y0,x1,y1,2,skin,bg);
  else fillEllipse(g,x0,y0,x1,y1,skin);
  fillRect(g,cx-2,y1-1,cx+2,y1+3,skin);
  return {x0,y0,x1,y1,cx};
}

function drawOutfit(g,rng,traits,p,fb){
  const {y1}=fb,dark=p.dark,mid=p.mid,accent=p.accent;
  if(traits.outfit_type==="tee"){
    const pts=[[7,28],[10,20],[22,20],[25,28]];
    for(let i=0;i<pts.length-1;i++) drawLine(g,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],dark);
    fillRect(g,10,21,22,31,dark);
    clearRect(g,13,20,19,24,p.bg);
  } else if(traits.outfit_type==="hoodie"){
    fillRoundedRect(g,6,20,26,31,2,mid,p.bg);
    drawLine(g,12,22,10,29,dark);
    drawLine(g,20,22,22,29,dark);
  } else if(traits.outfit_type==="jacket"){
    fillRoundedRect(g,6,20,26,31,2,dark,p.bg);
    fillRect(g,14,20,17,31,accent);
    drawLine(g,13,20,16,24,p.bg);
    drawLine(g,18,20,16,24,p.bg);
  } else {
    fillRoundedRect(g,7,20,25,31,3,mid,p.bg);
    for(let y=21;y<=30;y+=2) drawLine(g,10,y,22,y,dark);
  }
  // neck
  fillRect(g,fb.cx-2,y1,fb.cx+2,Math.min(y1+3,19),p.skin||dark);
}

function drawHair(g,rng,traits,fb,p){
  const hc=HEX[getHairColor(traits.hair_color_kind,p)];
  const ci=getHairColor(traits.hair_color_kind,p);
  const {x0,y0,x1,cx}=fb;
  if(traits.hair_type==="bald") return;
  if(traits.hair_type==="short"){
    fillRect(g,x0,y0-1,x1,y0+2,ci);
  } else if(traits.hair_type==="spiky"){
    fillRect(g,x0,y0-1,x1,y0+1,ci);
    for(let x=x0;x<=x1;x+=3) setPixel(g,x,y0-2,ci);
    for(let x=x0+1;x<=x1;x+=3) setPixel(g,x,y0-3,ci);
  } else if(traits.hair_type==="long"){
    fillRect(g,x0,y0-1,x1,y0+3,ci);
    for(let y=y0+3;y<=fb.y1-2;y++) { setPixel(g,x0,y,ci); setPixel(g,x0+1,y,ci); }
  } else if(traits.hair_type==="fringe"){
    fillRect(g,x0,y0-1,x1,y0+2,ci);
    for(let x=x0;x<=x0+4;x++) setPixel(g,x,y0+3,ci);
  } else if(traits.hair_type==="buzz"){
    for(let x=x0;x<=x1;x++) setPixel(g,x,y0,ci);
  } else if(traits.hair_type==="bun"){
    fillRect(g,x0,y0-1,x1,y0+1,ci);
    fillEllipse(g,cx-2,y0-4,cx+2,y0-1,ci);
  }
}

function drawEyes(g,rng,traits,fb,dark){
  const {x0,y0,x1,y1,cx}=fb;
  const ey=y0+Math.floor((y1-y0)*0.38);
  const ex1=cx-3,ex2=cx+1;
  if(traits.eyes_type==="dots"){
    setPixel(g,ex1,ey,dark); setPixel(g,ex2,ey,dark);
  } else if(traits.eyes_type==="sleepy"){
    fillRect(g,ex1-1,ey,ex1+1,ey,dark); fillRect(g,ex2-1,ey,ex2+1,ey,dark);
    setPixel(g,ex1,ey+1,dark); setPixel(g,ex2,ey+1,dark);
  } else if(traits.eyes_type==="bar"){
    fillRect(g,ex1-1,ey,ex2+1,ey,dark);
  } else if(traits.eyes_type==="wide"){
    fillRect(g,ex1-1,ey-1,ex1+1,ey+1,dark); fillRect(g,ex2-1,ey-1,ex2+1,ey+1,dark);
  } else if(traits.eyes_type==="angry"){
    setPixel(g,ex1,ey,dark); setPixel(g,ex2,ey,dark);
    setPixel(g,ex1-1,ey-1,dark); setPixel(g,ex2+1,ey-1,dark);
  }
}

function drawGlasses(g,rng,traits,fb,p){
  if(traits.eye_wear==="none") return;
  const {x0,y0,x1,y1,cx}=fb;
  const ey=y0+Math.floor((y1-y0)*0.38);
  const gc=traits.eye_wear==="shades"?p.dark:p.accent;
  fillRect(g,cx-5,ey-1,cx+3,ey+1,gc);
}

function drawNose(g,rng,fb,dark){
  const {cx,y0,y1}=fb;
  const ny=y0+Math.floor((y1-y0)*0.55);
  setPixel(g,cx,ny,dark); setPixel(g,cx+1,ny+1,dark); setPixel(g,cx-1,ny+1,dark);
}

function drawMouth(g,traits,fb,dark){
  const {cx,y0,y1}=fb;
  const my=y0+Math.floor((y1-y0)*0.72);
  if(traits.mouth_type==="flat"){
    fillRect(g,cx-2,my,cx+2,my,dark);
  } else if(traits.mouth_type==="smirk"){
    fillRect(g,cx-1,my,cx+2,my,dark); setPixel(g,cx+2,my-1,dark);
  } else if(traits.mouth_type==="open"){
    fillRect(g,cx-2,my,cx+2,my,dark); fillRect(g,cx-1,my+1,cx+1,my+1,dark);
  } else if(traits.mouth_type==="sad"){
    fillRect(g,cx-2,my,cx+2,my,dark); setPixel(g,cx-2,my-1,dark); setPixel(g,cx+2,my-1,dark);
  }
}

function drawBeard(g,rng,traits,fb,p){
  if(traits.beard_type==="none") return;
  const {cx,y0,y1}=fb;
  const by=y0+Math.floor((y1-y0)*0.78);
  const bc=p.dark;
  if(traits.beard_type==="stubble"){
    drawPointCloud(g,rng,cx-3,by,cx+3,y1-1,int(rng,6,10),bc);
  } else if(traits.beard_type==="goatee"){
    fillRect(g,cx-1,by,cx+1,y1,bc);
  } else if(traits.beard_type==="full"){
    fillRect(g,cx-3,by,cx+3,y1,bc);
  } else if(traits.beard_type==="moustache"){
    fillRect(g,cx-2,by,cx+2,by,bc);
  }
}

function drawAccessory(g,rng,traits,fb,p){
  const {x0,y0,x1,cx}=fb;
  if(traits.accessory==="earring"){
    setPixel(g,x0-1,y0+6,p.accent); setPixel(g,x0-1,y0+7,p.accent);
  } else if(traits.accessory==="chain"){
    for(let x=cx-4;x<=cx+4;x+=2) setPixel(g,x,fb.y1+2,p.accent);
  } else if(traits.accessory==="vr"){
    fillRect(g,x0+1,y0+3,x1-1,y0+6,p.mid);
  } else if(traits.accessory==="cap"){
    fillRect(g,x0-1,y0-2,x1+1,y0,p.mid);
    fillRect(g,x0-2,y0-1,x0,y0-1,p.mid);
  } else if(traits.accessory==="horns"){
    setPixel(g,x0+1,y0-2,p.accent); setPixel(g,x1-1,y0-2,p.accent);
    setPixel(g,x0+1,y0-3,p.accent); setPixel(g,x1-1,y0-3,p.accent);
  } else if(traits.accessory==="halo"){
    for(let x=cx-3;x<=cx+3;x++) setPixel(g,x,y0-3,p.accent);
  }
}

function addNoise(g,rng,p,n){
  const size=g.length;
  for(let i=0;i<n;i++){
    const x=int(rng,0,size-1),y=int(rng,0,size-1);
    const cur=g[y][x];
    if(cur===p.bg) setPixel(g,x,y,p.bg===1?0:1);
  }
}

function generatePortrait(seed){
  const rng=createRng(seed);
  const traits=makeTraits(rng);
  const palette=pickPaletteByName(traits.palette);
  const g=createGrid(GRID,palette.bg);
  const fb=drawBlobFace(g,rng,palette.skin,traits.face_shape,palette.bg);
  drawOutfit(g,rng,traits,palette,fb);
  drawHair(g,rng,traits,fb,palette);
  drawAccessory(g,rng,traits,fb,palette);
  drawEyes(g,rng,traits,fb,palette.dark);
  drawGlasses(g,rng,traits,fb,palette);
  drawNose(g,rng,fb,palette.dark);
  drawMouth(g,traits,fb,palette.dark);
  drawBeard(g,rng,traits,fb,palette);
  addNoise(g,rng,palette,int(rng,18,46));
  return {g,palette};
}

function gridToSVG(g,palette){
  const size=g.length;
  const rects=[];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const ci=g[y][x];
    const hex=HEX[ci]||"#000000";
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 ${size} ${size}" style="image-rendering:pixelated;shape-rendering:crispEdges">${rects.join("")}</svg>`;
}

// ── main ─────────────────────────────────────────────────────────────────────
let fixed = 0;
for(let id=0;id<TOTAL;id++){
  const seed = id * 9973 + 1; // same seed formula as before
  const {g,palette} = generatePortrait(seed);
  const svg = gridToSVG(g,palette);
  writeFileSync(join(IMAGES_DIR,`${id}.svg`), svg);
  fixed++;
  if(fixed % 50 === 0) process.stdout.write(`${fixed}/${TOTAL}...\n`);
}
console.log(`Done. Regenerated  legacy 32×32 portraits.`);
