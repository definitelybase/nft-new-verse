import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Frontend render error:", error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #282232 0%, #1c1825 44%, #14121a 100%)",
          color: "#E8E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: "100%",
            background: "rgba(18, 18, 26, 0.92)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div style={{ fontSize: 13, color: "#EF4444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Frontend Runtime Error
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            The app crashed during render.
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#B8B8C8",
            }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
