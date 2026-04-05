import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";

class RootErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            padding: 24,
            maxWidth: 420,
            margin: "0 auto",
            fontFamily: "system-ui, sans-serif",
            color: "#1c2b30",
            background: "#f4f1ec",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 12 }}>Floe 无法渲染界面</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#4a6670", marginBottom: 16 }}>
            请打开浏览器的开发者工具（F12 或 ⌥⌘I）查看 Console 里的红色报错，并把内容发给我。
          </p>
          <pre
            style={{
              fontSize: 12,
              overflow: "auto",
              padding: 12,
              borderRadius: 12,
              background: "rgba(255,255,255,0.85)",
              border: "1px solid #d0e8f0",
            }}
          >
            {String(
              (this.state.err && this.state.err.message) || this.state.err || "",
            )}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const el = document.getElementById("root");
if (!el) {
  document.body.innerHTML =
    "<p style=\"font-family:system-ui;padding:24px\">找不到 #root，请确认 index.html 未被改动。</p>";
} else {
  createRoot(el).render(
    <StrictMode>
      <LanguageProvider>
        <SubscriptionProvider>
          <RootErrorBoundary>
            <App />
          </RootErrorBoundary>
        </SubscriptionProvider>
      </LanguageProvider>
    </StrictMode>,
  );
}
