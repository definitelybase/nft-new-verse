import React, { useEffect, useState } from "react";

const FRAMES = [
  [
    "        .-=========-.        ",
    "      .'  .-===-.   '.      ",
    "     /   /  .-.  \\    \\     ",
    "    ;   |  (   )  |    ;    ",
    "    |   |   '-'   |    |    ",
    "    ;   |  .---.  |    ;    ",
    "     \\   \\  '-'  /    /     ",
    "      '.  '-===-'   .'      ",
    "        '-._____.-'        ",
  ],
  [
    "        .-=========-.        ",
    "      .'   .---.     '.      ",
    "     /   .' ___ '.     \\     ",
    "    ;   /  / _ \\  \\     ;    ",
    "    |   | | (_) | |     |    ",
    "    ;   \\  \\___/  /     ;    ",
    "     \\   '._____.'     /     ",
    "      '.    ___      .'      ",
    "        '-._____.-'        ",
  ],
];

export default function AsciiCd() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % FRAMES.length);
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <pre
      style={{
        margin: 0,
        color: "#cfd4ff",
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        fontSize: 9,
        lineHeight: 1.1,
        letterSpacing: 0.3,
        whiteSpace: "pre",
        textAlign: "center",
        userSelect: "none",
      }}
    >
      {FRAMES[frameIndex].join("\n")}
    </pre>
  );
}
