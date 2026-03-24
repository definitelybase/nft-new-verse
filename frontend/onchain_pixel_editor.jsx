import { useState, useRef, useCallback, useEffect } from "react";

const GRID = 32;
const CELL = 14;
const GAP = 1;

// Default 16-color palette (CryptoPunks-inspired + extras)
const DEFAULT_PALETTE = [
  "#000000", "#ffffff", "#ff0000", "#00ff00",
  "#0066ff", "#ffcc00", "#ff6600", "#9933ff",
  "#00cccc", "#ff3399", "#336633", "#663300",
  "#cccccc", "#666666", "#ffccaa", "#3399ff",
];

function hexToBytes3(hex) {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

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

function generateRandomAgent() {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  
  // Background
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      grid[y][x] = 0;

  // Body (symmetric)
  const bodyColor = Math.floor(Math.random() * 6) + 2;
  const skinColor = 14;
  const eyeColor = 1;
  
  // Head
  for (let y = 8; y < 16; y++)
    for (let x = 11; x < 21; x++)
      grid[y][x] = skinColor;

  // Eyes
  grid[11][13] = eyeColor;
  grid[11][14] = bodyColor;
  grid[11][18] = eyeColor;
  grid[11][19] = bodyColor;

  // Mouth
  for (let x = 14; x < 19; x++) grid[14][x] = 3;

  // Body
  for (let y = 16; y < 26; y++)
    for (let x = 10; x < 22; x++)
      grid[y][x] = bodyColor;

  // Arms
  for (let y = 17; y < 23; y++) {
    grid[y][8] = bodyColor;
    grid[y][9] = bodyColor;
    grid[y][22] = bodyColor;
    grid[y][23] = bodyColor;
  }

  // Legs
  for (let y = 26; y < 31; y++) {
    grid[y][12] = 11;
    grid[y][13] = 11;
    grid[y][18] = 11;
    grid[y][19] = 11;
  }

  // Random accessory
  const acc = Math.floor(Math.random() * 4);
  if (acc === 0) { // Hat
    for (let x = 10; x < 22; x++) grid[7][x] = 4;
    for (let x = 12; x < 20; x++) grid[6][x] = 4;
  } else if (acc === 1) { // Mohawk
    for (let y = 3; y < 8; y++) grid[y][15] = 2;
    for (let y = 3; y < 8; y++) grid[y][16] = 2;
  } else if (acc === 2) { // Crown
    for (let x = 11; x < 21; x++) grid[7][x] = 5;
    grid[6][12] = 5; grid[6][16] = 5; grid[6][20] = 5;
  }

  return grid;
}

const templates = {
  blank: () => Array.from({ length: GRID }, () => Array(GRID).fill(0)),
  agent: generateRandomAgent,
  heart: () => {
    const g = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    const h = [
      [0,0,1,1,0,0,0,1,1,0],
      [0,1,2,2,1,0,1,2,2,1],
      [1,2,2,2,2,1,2,2,2,1],
      [1,2,2,2,2,2,2,2,2,1],
      [0,1,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0],
    ];
    const ox = 11, oy = 12;
    h.forEach((row, dy) => row.forEach((v, dx) => {
      if (v && oy + dy < GRID && ox + dx < GRID) g[oy + dy][ox + dx] = v;
    }));
    return g;
  },
};

export default function OnChainPixelEditor() {
  const [grid, setGrid] = useState(templates.blank);
  const [selectedColor, setSelectedColor] = useState(1);
  const [palette, setPalette] = useState([...DEFAULT_PALETTE]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("draw"); // draw, erase, fill, eyedrop
  const [showCode, setShowCode] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [editingPalette, setEditingPalette] = useState(null);
  const [history, setHistory] = useState([]);
  const canvasRef = useRef(null);

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
    if (tool === "eyedrop") {
      setSelectedColor(grid[y][x]);
      setTool("draw");
      return;
    }
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
    const color = tool === "erase" ? 0 : selectedColor;
    setGrid(g => {
      if (g[y][x] === color) return g;
      const ng = g.map(r => [...r]);
      ng[y][x] = color;
      return ng;
    });
  }, [tool, selectedColor, grid, pushHistory]);

  const handleMouseDown = (x, y) => {
    if (tool !== "fill" && tool !== "eyedrop") pushHistory();
    setIsDrawing(true);
    paint(x, y);
  };
  const handleMouseMove = (x, y) => { if (isDrawing) paint(x, y); };
  const handleMouseUp = () => setIsDrawing(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  // Calculate stats
  const packedHex = packPixelsToHex(grid);
  const bytesUsed = 512;
  const usedColors = new Set(grid.flat()).size;
  const nonEmptyPixels = grid.flat().filter(c => c !== 0).length;

  // Rough gas estimate
  const estimatedGasL1 = 180000;
  const estimatedCostL1 = ((estimatedGasL1 * 30 * 2000) / 1e9).toFixed(2);
  const estimatedCostBase = ((estimatedGasL1 * 0.01 * 2000) / 1e9 * 1000).toFixed(3);

  const exportSVG = () => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * 10} ${GRID * 10}" shape-rendering="crispEdges">`;
    for (let ci = 0; ci < 16; ci++) {
      let rects = "";
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (grid[y][x] === ci)
            rects += `<rect x="${x * 10}" y="${y * 10}" width="10" height="10"/>`;
      if (rects) svg += `<g fill="${palette[ci]}">${rects}</g>`;
    }
    svg += "</svg>";
    return svg;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e0e0e0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "20px",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 800,
          background: "linear-gradient(135deg, #00ff88 0%, #00ccff 50%, #9966ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          margin: 0,
          letterSpacing: "0.05em",
        }}>
          ON-CHAIN PIXEL NFT
        </h1>
        <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
          SSTORE2 · 16-color palette · 512 bytes per NFT · ~$0.03 on Base
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
        {/* Canvas */}
        <div>
          <div
            ref={canvasRef}
            onMouseLeave={() => setIsDrawing(false)}
            onMouseUp={handleMouseUp}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`,
              gap: GAP,
              background: "#111118",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #222",
              cursor: tool === "eyedrop" ? "crosshair" : tool === "fill" ? "cell" : "pointer",
            }}
          >
            {grid.map((row, y) =>
              row.map((colorIdx, x) => (
                <div
                  key={`${x}-${y}`}
                  onMouseDown={() => handleMouseDown(x, y)}
                  onMouseMove={() => handleMouseMove(x, y)}
                  style={{
                    width: CELL,
                    height: CELL,
                    background: palette[colorIdx],
                    borderRadius: 1,
                    transition: "background 0.05s",
                  }}
                />
              ))
            )}
          </div>

          {/* Tools */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "center" }}>
            {[
              { id: "draw", label: "✏️ Draw", key: "D" },
              { id: "erase", label: "🧹 Erase", key: "E" },
              { id: "fill", label: "🪣 Fill", key: "F" },
              { id: "eyedrop", label: "💧 Pick", key: "I" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  background: tool === t.id ? "#00ff8833" : "#1a1a24",
                  border: tool === t.id ? "1px solid #00ff88" : "1px solid #333",
                  borderRadius: 6,
                  color: tool === t.id ? "#00ff88" : "#888",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={undo}
              style={{
                padding: "6px 12px", fontSize: 11,
                background: "#1a1a24", border: "1px solid #333",
                borderRadius: 6, color: "#888", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↩ Undo
            </button>
          </div>

          {/* Templates */}
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: "#555", lineHeight: "28px" }}>Templates:</span>
            {[
              { id: "blank", label: "Clear" },
              { id: "agent", label: "Random Agent" },
              { id: "heart", label: "Heart" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { pushHistory(); setGrid(templates[t.id]()); }}
                style={{
                  padding: "4px 10px", fontSize: 10,
                  background: "#1a1a24", border: "1px solid #333",
                  borderRadius: 4, color: "#aaa", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 260 }}>
          {/* Palette */}
          <div style={{
            background: "#111118", borderRadius: 8,
            padding: 12, border: "1px solid #222", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Palette (16 colors · on-chain)
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
            }}>
              {palette.map((color, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div
                    onClick={() => setSelectedColor(i)}
                    onDoubleClick={() => setEditingPalette(i)}
                    style={{
                      width: 28, height: 28, background: color,
                      borderRadius: 4, cursor: "pointer",
                      border: selectedColor === i ? "2px solid #00ff88" : "2px solid transparent",
                      boxShadow: selectedColor === i ? "0 0 8px #00ff8844" : "none",
                      transition: "all 0.15s",
                    }}
                  />
                  <span style={{
                    position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
                    fontSize: 7, color: "#444",
                  }}>{i}</span>
                </div>
              ))}
            </div>
            {editingPalette !== null && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="color"
                  value={palette[editingPalette]}
                  onChange={(e) => {
                    const np = [...palette];
                    np[editingPalette] = e.target.value;
                    setPalette(np);
                  }}
                  style={{ width: 40, height: 30, border: "none", background: "none", cursor: "pointer" }}
                />
                <span style={{ fontSize: 10, color: "#888" }}>
                  Editing color #{editingPalette}
                </span>
                <button
                  onClick={() => setEditingPalette(null)}
                  style={{
                    marginLeft: "auto", padding: "2px 8px", fontSize: 10,
                    background: "#222", border: "1px solid #444", borderRadius: 3,
                    color: "#aaa", cursor: "pointer",
                  }}
                >done</button>
              </div>
            )}
          </div>

          {/* Stats */}
          {showStats && (
            <div style={{
              background: "#111118", borderRadius: 8,
              padding: 12, border: "1px solid #222", marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                On-Chain Stats
              </div>
              {[
                { label: "Data size", value: `${bytesUsed} bytes`, highlight: true },
                { label: "Storage method", value: "SSTORE2" },
                { label: "Pixels drawn", value: `${nonEmptyPixels} / 1024` },
                { label: "Colors used", value: `${usedColors} / 16` },
                { label: "Gas (ETH L1)", value: `~${estimatedGasL1.toLocaleString()} gas` },
                { label: "Cost ETH L1", value: `~$${estimatedCostL1}` },
                { label: "Cost Base L2", value: `~$${estimatedCostBase}`, highlight: true },
              ].map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "3px 0", fontSize: 11,
                  borderBottom: "1px solid #1a1a24",
                }}>
                  <span style={{ color: "#666" }}>{s.label}</span>
                  <span style={{
                    color: s.highlight ? "#00ff88" : "#ccc",
                    fontWeight: s.highlight ? 700 : 400,
                  }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div style={{
            background: "#111118", borderRadius: 8,
            padding: 12, border: "1px solid #222", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              NFT Preview (rendered from data)
            </div>
            <div
              style={{ width: "100%", aspectRatio: "1", borderRadius: 4, overflow: "hidden" }}
              dangerouslySetInnerHTML={{ __html: exportSVG() }}
            />
          </div>

          {/* Export */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setShowCode(!showCode)}
              style={{
                flex: 1, padding: "8px", fontSize: 11,
                background: showCode ? "#00ff8822" : "#1a1a24",
                border: showCode ? "1px solid #00ff88" : "1px solid #333",
                borderRadius: 6, color: showCode ? "#00ff88" : "#aaa",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {showCode ? "Hide" : "Show"} Calldata
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(packedHex);
              }}
              style={{
                flex: 1, padding: "8px", fontSize: 11,
                background: "#1a1a24", border: "1px solid #333",
                borderRadius: 6, color: "#aaa", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Copy Hex
            </button>
          </div>
        </div>
      </div>

      {/* Calldata display */}
      {showCode && (
        <div style={{
          maxWidth: 820, margin: "16px auto 0",
          background: "#111118", borderRadius: 8,
          padding: 16, border: "1px solid #222",
        }}>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Packed Calldata (512 bytes · ready for mint)
          </div>
          <div style={{
            fontSize: 9, wordBreak: "break-all", color: "#00ff88",
            lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace",
            background: "#0a0a12", padding: 12, borderRadius: 4,
            maxHeight: 120, overflow: "auto",
          }}>
            {packedHex}
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: "#666" }}>
            <div style={{ marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Solidity mint call:
            </div>
            <code style={{
              fontSize: 9, color: "#9966ff", display: "block",
              background: "#0a0a12", padding: 8, borderRadius: 4,
              wordBreak: "break-all",
            }}>
              {`contract.mint(msg.sender, ${packedHex.slice(0, 40)}..., "MyAgent")`}
            </code>
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: "#666" }}>
            <div style={{ marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Palette as bytes3[16]:
            </div>
            <code style={{
              fontSize: 9, color: "#ffcc00", display: "block",
              background: "#0a0a12", padding: 8, borderRadius: 4,
              wordBreak: "break-all",
            }}>
              [{palette.map(c => `0x${c.replace("#", "")}`).join(", ")}]
            </code>
          </div>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 9, color: "#333", marginTop: 20 }}>
        Double-click palette color to edit · Ctrl+Z to undo · 32×32 grid · 4-bit per pixel
      </p>
    </div>
  );
}
