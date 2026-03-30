import React, { useState, useRef, useCallback, useEffect } from "react";
import { COLORS, fonts, fontDisplay, MINT_PAYLOAD_STORAGE_KEY } from "./utils/constants";
import { FrostCard, Eyebrow } from "./components/ui";
import { MetalButton } from "./MetalButton";
import { ThemeSwitch } from "./ThemeSwitch";
import { isValidMintPayload } from "./utils/helpers";

const GRID = 16;
const CELL = 22;
const GAP = 1;

const PIXEL_BG_COLORS = [
  "#e03c3c", "#3c7ee0", "#2eb872", "#f5a623", "#9b59b6", "#00bcd4",
  "#f8c8dc", "#a8d8ea", "#c5e1a5", "#fff3b0", "#d1a3ff", "#ffb074",
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD",
  "#87CEEB", "#98D8C8", "#F7DC6F", "#BB8FCE",
];

function PixelBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pxSize = 18;
    const dpr = window.devicePixelRatio || 1;

    function draw() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cols = Math.ceil(w / pxSize);
      const rows = Math.ceil(h / pxSize);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rand = Math.random();
          if (rand < 0.82) {
            // mostly transparent — keep it sparse
            continue;
          }
          const color = PIXEL_BG_COLORS[Math.floor(Math.random() * PIXEL_BG_COLORS.length)];
          ctx.globalAlpha = 0.08 + Math.random() * 0.14;
          ctx.fillStyle = color;
          ctx.fillRect(c * pxSize, r * pxSize, pxSize - 1, pxSize - 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

const DEFAULT_PALETTE = [
  "#000000", "#ffffff", "#e03c3c", "#3c7ee0",
  "#2eb872", "#f5a623", "#9b59b6", "#00bcd4",
  "#f8c8dc", "#a8d8ea", "#c5e1a5", "#fff3b0",
  "#d1a3ff", "#ffb074", "#b0b0b0", "#5c3d2e",
];

function packPixelsToHex(grid) {
  let hex = "0x";
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x += 2) {
      const hi = grid[y][x] & 0x0f;
      const lo = grid[y][x + 1] & 0x0f;
      const byte = (hi << 4) | lo;
      hex += byte.toString(16).padStart(2, "0");
    }
  }
  return hex;
}

const TWITTER_HANDLE = "@pixel_dwallers";
const TWITTER_POST = "https://x.com/OnChainPixel/status/XXXXXXXXX";

function StepCard({ number, title, children, done, onToggle }) {
  return (
    <FrostCard style={{
      padding: "20px 24px",
      display: "flex",
      alignItems: "flex-start",
      gap: 16,
      opacity: done ? 0.6 : 1,
      transition: "opacity 0.2s",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: done ? COLORS.greenSoft : COLORS.purpleSoft,
        border: `1px solid ${done ? COLORS.green : COLORS.purple}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fonts, fontSize: 12, fontWeight: 700,
        color: done ? COLORS.green : COLORS.purple,
        flexShrink: 0,
      }}>
        {done ? "✓" : `0${number}`}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: fontDisplay, fontSize: 20, fontWeight: 700,
          color: COLORS.text, marginBottom: 6,
        }}>
          {title}
        </div>
        {children}
      </div>
      <div
        onClick={onToggle}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: `2px solid ${done ? COLORS.green : COLORS.border}`,
          background: done ? COLORS.greenSoft : "transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
          flexShrink: 0,
          marginTop: 4,
        }}
      >
        {done && <span style={{ color: COLORS.green, fontSize: 16 }}>✓</span>}
      </div>
    </FrostCard>
  );
}

function MiniPixelEditor({ onHexChange }) {
  const [grid, setGrid] = useState(() => Array.from({ length: GRID }, () => Array(GRID).fill(0)));
  const [selectedColor, setSelectedColor] = useState(1);
  const [palette] = useState([...DEFAULT_PALETTE]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("draw");
  const [history, setHistory] = useState([]);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-20), grid.map(r => [...r])]);
  }, [grid]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setGrid(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  }, [history]);

  const paint = useCallback((x, y) => {
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
    if (tool === "fill") {
      pushHistory();
      const target = grid[y][x];
      if (target === selectedColor) return;
      const newGrid = grid.map(r => [...r]);
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) continue;
        if (newGrid[cy][cx] !== target) continue;
        newGrid[cy][cx] = selectedColor;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      setGrid(newGrid);
      return;
    }
    setGrid(g => {
      if (g[y][x] === selectedColor) return g;
      const ng = g.map(r => [...r]);
      ng[y][x] = selectedColor;
      return ng;
    });
  }, [tool, selectedColor, grid, pushHistory]);

  const handleMouseDown = (x, y) => { if (tool !== "fill") pushHistory(); setIsDrawing(true); paint(x, y); };
  const handleMouseMove = (x, y) => { if (isDrawing) paint(x, y); };

  const packedHex = packPixelsToHex(grid);
  const nonEmpty = grid.flat().filter(c => c !== 0).length;

  useEffect(() => { onHexChange(packedHex, nonEmpty); }, [packedHex, nonEmpty, onHexChange]);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div
          onMouseLeave={() => setIsDrawing(false)}
          onMouseUp={() => setIsDrawing(false)}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`,
            gap: GAP,
            background: COLORS.surfaceStrong,
            padding: 6,
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            cursor: tool === "fill" ? "cell" : "pointer",
          }}
        >
          {grid.map((row, y) =>
            row.map((colorIdx, x) => (
              <div
                key={`${x}-${y}`}
                onMouseDown={() => handleMouseDown(x, y)}
                onMouseMove={() => handleMouseMove(x, y)}
                style={{
                  width: CELL, height: CELL,
                  background: palette[colorIdx],
                  borderRadius: 1,
                }}
              />
            ))
          )}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>
          {[
            { id: "draw", label: "Draw" },
            { id: "fill", label: "Fill" },
          ].map(t => (
            <MetalButton
              key={t.id}
              onClick={() => setTool(t.id)}
              tone={tool === t.id ? "accent" : "ghost"}
              size="xs"
              style={{ minHeight: 28, padding: "4px 10px" }}
            >
              {t.label}
            </MetalButton>
          ))}
          <MetalButton onClick={undo} tone="ghost" size="xs" style={{ minHeight: 28, padding: "4px 10px" }}>Undo</MetalButton>
          <MetalButton onClick={() => { pushHistory(); setGrid(Array.from({ length: GRID }, () => Array(GRID).fill(0))); }} tone="ghost" size="xs" style={{ minHeight: 28, padding: "4px 10px" }}>Clear</MetalButton>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
          {palette.map((color, i) => (
            <div
              key={i}
              onClick={() => setSelectedColor(i)}
              style={{
                width: 24, height: 24, background: color,
                borderRadius: 4, cursor: "pointer",
                border: selectedColor === i ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              }}
            />
          ))}
        </div>
        <div style={{
          marginTop: 8, color: COLORS.textMuted,
          fontFamily: fonts, fontSize: 10,
        }}>
          {nonEmpty} / {GRID * GRID} pixels drawn
        </div>
      </div>
    </div>
  );
}

export default function OnChainPixelEditor({ themeMode, onToggleTheme }) {
  const [steps, setSteps] = useState({ 1: false, 2: false, 3: false, 4: false });
  const [artHex, setArtHex] = useState("");
  const [artPixels, setArtPixels] = useState(0);
  const [walletInput, setWalletInput] = useState("");
  const [hexInput, setHexInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [pending, setPending] = useState({});

  const openAndMark = (n, url) => {
    if (steps[n] || pending[n]) return;
    window.open(url, "_blank");
    setPending(p => ({ ...p, [n]: true }));
    setTimeout(() => {
      setSteps(s => ({ ...s, [n]: true }));
      setPending(p => ({ ...p, [n]: false }));
    }, 5000);
  };

  const isValidWallet = /^0x[a-fA-F0-9]{40}$/.test(walletInput);
  const payloadValid = isValidMintPayload(hexInput);
  const allDone = steps[1] && steps[2] && isValidWallet && payloadValid;

  const handleHexChange = useCallback((hex, pixels) => {
    setArtHex(hex);
    setArtPixels(pixels);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !artHex) return;
    window.localStorage.setItem(MINT_PAYLOAD_STORAGE_KEY, artHex);
  }, [artHex]);

  return (
    <>
    <PixelBackground />
    <div style={{
      position: "relative",
      zIndex: 1,
      width: "calc(100vw - 24px)",
      maxWidth: 720,
      margin: "0 auto",
      padding: "32px 12px 80px",
      fontFamily: fonts,
    }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <ThemeSwitch themeMode={themeMode} onToggle={onToggleTheme} size="md" />
      </div>

      <Eyebrow>Allowlist entry</Eyebrow>
      <h1 style={{
        fontFamily: fontDisplay,
        fontSize: "clamp(36px, 6vw, 56px)",
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: -1.5,
        margin: "12px 0 0",
      }}>
        {(() => {
          const text = "Submit your allowlist entry";
          const isLight = themeMode === "light";
          const clrs = isLight
            ? ["#7E57C2","#E91E63","#F57C00","#2E7D32","#1565C0","#9C27B0","#00838F","#E64A19"]
            : ["#B39DDB","#F48FB1","#FFCC80","#A5D6A7","#90CAF9","#CE93D8","#80DEEA","#FFAB91"];
          return text.split("").map((ch, i) => (
            <span key={i} style={{ color: ch === " " ? "transparent" : clrs[i % clrs.length] }}>
              {ch === " " ? "\u00A0" : ch}
            </span>
          ));
        })()}
      </h1>
      <p style={{
        color: COLORS.textMuted, fontSize: 14, lineHeight: 1.7,
        margin: "12px 0 24px", maxWidth: 520,
      }}>
        Open the required social links, add your wallet, and attach the payload from the pixel editor. Social steps are reviewed manually after submission.
      </p>

      <MetalButton
        tone="accent"
        size="sm"
        onClick={() => window.open(TWITTER_POST, "_blank")}
        style={{ marginBottom: 12 }}
      >
        Open raffle post ↗
      </MetalButton>

      <div style={{
        borderTop: `1px dashed ${COLORS.border}`,
        margin: "0 0 24px",
      }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StepCard number={1} title="Open the X profile" done={steps[1]} onToggle={() => openAndMark(1, `https://x.com/${TWITTER_HANDLE.replace("@", "")}`)}>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "0 0 8px", lineHeight: 1.6 }}>
            Open <span style={{ color: COLORS.purple, fontWeight: 600 }}>{TWITTER_HANDLE}</span> on X. Follow status is checked manually after form review.
          </p>
          <a
            onClick={(e) => { e.preventDefault(); openAndMark(1, `https://x.com/${TWITTER_HANDLE.replace("@", "")}`); }}
            href={`https://x.com/${TWITTER_HANDLE.replace("@", "")}`}
            style={{ color: steps[1] ? COLORS.green : COLORS.green, fontSize: 12, textDecoration: "none", cursor: "pointer" }}
          >
            {steps[1] ? "Marked complete" : pending[1] ? "Opening..." : "Open profile ↗"}
          </a>
        </StepCard>

        <StepCard number={2} title="Open the raffle task" done={steps[2]} onToggle={() => openAndMark(2, TWITTER_POST)}>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "0 0 8px", lineHeight: 1.6 }}>
            Open the raffle post and complete the required X actions there. Repost and like are checked manually after submission.
          </p>
          <a
            onClick={(e) => { e.preventDefault(); openAndMark(2, TWITTER_POST); }}
            href={TWITTER_POST}
            style={{ color: COLORS.green, fontSize: 12, textDecoration: "none", cursor: "pointer" }}
          >
            {steps[2] ? "Marked complete" : pending[2] ? "Opening..." : "Open post ↗"}
          </a>
        </StepCard>

        <StepCard number={3} title="Wallet address" done={isValidWallet} onToggle={() => {}}>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "0 0 10px", lineHeight: 1.6 }}>
            Paste the wallet you want attached to this entry.
          </p>
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value.trim())}
            placeholder="0x..."
            spellCheck={false}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${isValidWallet ? COLORS.green : COLORS.border}`,
              background: COLORS.surfaceStrong,
              color: COLORS.text,
              fontFamily: fonts,
              fontSize: 12,
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />
          <div style={{ marginTop: 6, color: isValidWallet ? COLORS.green : COLORS.textDim, fontSize: 10 }}>
            {isValidWallet
              ? "Valid address"
              : walletInput.length > 0
              ? "Invalid — expected 0x + 40 hex characters"
              : "Use the address that should receive allowlist access."}
          </div>
        </StepCard>

        <StepCard number={4} title="Attach the pixel payload" done={payloadValid} onToggle={() => {}}>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "0 0 12px", lineHeight: 1.6 }}>
            Use the editor below to draw a 16×16 piece, then copy the payload into the submission field.
          </p>
          <MiniPixelEditor onHexChange={handleHexChange} />
          <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <MetalButton
              tone="ghost"
              size="xs"
              onClick={() => {
                navigator.clipboard?.writeText(artHex);
                setHexInput(artHex);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(MINT_PAYLOAD_STORAGE_KEY, artHex);
                }
              }}
              style={{ minHeight: 28, padding: "4px 10px" }}
            >
              Copy payload
            </MetalButton>
            <span style={{ color: COLORS.textDim, fontSize: 10 }}>
              {artPixels > 0 ? `${(GRID * GRID / 2)} bytes packed` : "Draw before copying"}
            </span>
          </div>
        </StepCard>
      </div>

      <div style={{
        borderTop: `1px dashed ${COLORS.border}`,
        margin: "28px 0 24px",
      }} />

      <FrostCard style={{ padding: "20px 24px" }}>
        <div style={{
          fontFamily: fontDisplay, fontSize: 18, fontWeight: 700,
          color: COLORS.text, marginBottom: 12,
        }}>
          Payload field
        </div>
        <textarea
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value.trim())}
          placeholder="0x... (paste the payload from the editor above)"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 72,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceStrong,
            color: COLORS.text,
            fontFamily: fonts,
            fontSize: 11,
            resize: "vertical",
            outline: "none",
            wordBreak: "break-all",
          }}
        />
        <div style={{ marginTop: 6, color: COLORS.textDim, fontSize: 10 }}>
          {payloadValid
            ? `Valid payload (128 bytes)`
            : hexInput.length > 0
            ? `Invalid — expected 0x + 256 hex chars (got ${hexInput.length})`
            : "Draw pixel art above, then click 'Copy payload'"}
        </div>
      </FrostCard>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <MetalButton
          tone={allDone && !submitted ? "accent" : "ghost"}
          size="md"
          onClick={() => { if (allDone) setSubmitted(true); }}
          style={{
            minWidth: 240,
            opacity: allDone ? 1 : 0.4,
            pointerEvents: allDone ? "auto" : "none",
          }}
        >
          {submitted ? "Entry submitted" : "Submit entry"}
        </MetalButton>
        {!allDone && (
          <p style={{ color: COLORS.textDim, fontSize: 11, marginTop: 8 }}>
            Open both social links, enter your wallet, and attach the payload before submitting.
          </p>
        )}
        {submitted && (
          <p style={{ color: COLORS.green, fontSize: 12, marginTop: 8 }}>
            Entry received. Social steps will be reviewed manually before allowlist selection.
          </p>
        )}
      </div>
    </div>
    </>
  );
}
