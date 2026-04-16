import { useState, useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";
import { getCBTResponse, generateJournalEntry } from "./lib/aiService";
import { safeGetItem, safeSetItem } from "./lib/safeStorage";
import { useLanguage } from "./context/LanguageContext.jsx";
import { useFloeSubscription } from "./context/SubscriptionContext.jsx";
import { supabase } from "./lib/supabase";
import Paywall from "./components/Paywall.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import { useUsage } from "./hooks/useUsage.js";
import { zh } from "./locales/zh";
import { en } from "./locales/en";

/* ═══════════════════════════════════════════════════════
   DESIGN TOKENS
   Frosted arctic meets warm cream — ice that drifts
   on a gentle current, never cold, always calm.
═══════════════════════════════════════════════════════ */
const C = {
  bg:         "#F4F1EC",
  bgWarm:     "#EDE9E2",
  frost:      "#EAF4F7",
  frostDeep:  "#D0E8F0",
  ice:        "#A8D4E2",
  iceDeep:    "#5BA8BC",
  slate:      "#1C2B30",
  slateLight: "#4A6670",
  mist:       "#8DAAB3",
  terra:      "#C86A3A",
  terraLight: "#E08055",
  sage:       "#6B9E85",
  gold:       "#C49B3C",
  blush:      "#E8A090",
  white:      "#FDFCFA",
};

// 不用 Google Fonts（@import 会阻塞首屏；部分地区访问 fonts.googleapis.com 会长时间挂起）
const FONTS = {
  display:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  body:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
};

/* ═══════════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════════ */
function Styles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; background: ${C.bg}; }
      body { font-family: ${FONTS.body}; color: ${C.slate}; -webkit-font-smoothing: antialiased; }
      input, textarea, button { font-family: inherit; }
      ::-webkit-scrollbar { width: 3px; }
      ::-webkit-scrollbar-thumb { background: ${C.frostDeep}; border-radius: 2px; }

      @keyframes floatIce {
        0%, 100% { transform: translateY(0px) rotate(-2deg); }
        50%       { transform: translateY(-6px) rotate(2deg); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes popIn {
        0%   { transform: scale(0.85); opacity: 0; }
        70%  { transform: scale(1.05); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes checkPop {
        0%   { transform: scale(0); }
        60%  { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      @keyframes particleBurst {
        0%   { transform: translate(0,0) scale(1); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      }
      @keyframes slideTab {
        from { opacity: 0; transform: translateX(6px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes breatheRing {
        0%, 100% { box-shadow: 0 0 0 0 ${C.iceDeep}33; }
        50%       { box-shadow: 0 0 0 12px ${C.iceDeep}00; }
      }
      @keyframes timerPulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.7; }
      }
      @keyframes dotBounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40%            { transform: scale(1); opacity: 1; }
      }
      @keyframes celebrationBounce {
        0%   { transform: scale(0) rotate(-10deg); }
        60%  { transform: scale(1.15) rotate(3deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes shimmer {
        0%   { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      @keyframes micPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(204,58,58,0.6); }
        50%       { box-shadow: 0 0 0 12px rgba(204,58,58,0); }
      }

      .page-enter { animation: slideTab 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
      .float-ice  { animation: floatIce 3.5s ease-in-out infinite; display: inline-block; }
      .btn-press:active { transform: scale(0.96); }
    `}</style>
  );
}

/* ═══════════════════════════════════════════════════════
   GLOBAL STATE (lightweight, no zustand needed for demo)
═══════════════════════════════════════════════════════ */
function isHiddenToday(task) {
  if (!task.showAfter) return false;
  const today = new Date().toISOString().split("T")[0];
  return task.showAfter > today;
}

const TAG_STYLE = {
  学业: { bg: "#DEEEFF", c: "#3A7BD5" },
  研究: { bg: "#D6F5E8", c: "#1A8C54" },
  项目: { bg: "#FFE9D8", c: "#C86A3A" },
  生活: { bg: "#EEE4FF", c: "#7B52CC" },
  健康: { bg: "#FFE0E0", c: "#CC3A3A" },
  inbox:{ bg: "#EBEBEB", c: "#666"    },
};

const ENERGY_DOT = { high: C.terra, medium: C.gold, low: C.sage };

/* ═══════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════ */

// 🧊 The Floe mascot
function FloeIce({ size = 32, style = {} }) {
  return (
    <span
      className="float-ice"
      style={{ fontSize: size, lineHeight: 1, display: "inline-block", ...style }}
    >
      🧊
    </span>
  );
}

// Particle burst on task complete
function Particles({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * 360;
    const rad   = (angle * Math.PI) / 180;
    const dist  = 28 + Math.random() * 20;
    return {
      tx: Math.cos(rad) * dist + "px",
      ty: Math.sin(rad) * dist + "px",
      color: [C.ice, C.iceDeep, C.gold, C.blush, C.sage][i % 5],
    };
  });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 6, height: 6,
            borderRadius: "50%",
            background: p.color,
            "--tx": p.tx,
            "--ty": p.ty,
            animation: `particleBurst 0.55s cubic-bezier(0.25,0.46,0.45,0.94) ${i * 0.03}s both`,
          }}
        />
      ))}
    </div>
  );
}

// Tag chip
function Tag({ label }) {
  const { t } = useLanguage();
  const s = TAG_STYLE[label] || TAG_STYLE.inbox;
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: "2px 8px",
      borderRadius: 99, background: s.bg, color: s.c,
      letterSpacing: "0.02em",
    }}>
      {t(`tags.${label}`)}
    </span>
  );
}

function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div
      title={t("lang.switchHint")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: C.white,
        border: `1.5px solid ${C.frostDeep}`,
        borderRadius: 20,
        padding: "4px 12px",
      }}
    >
      <button
        type="button"
        className="btn-press"
        onClick={() => setLang("zh")}
        style={{
          border: "none",
          background: lang === "zh" ? C.iceDeep : C.frostDeep,
          color: lang === "zh" ? "#fff" : C.mist,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 12px",
          borderRadius: 20,
          cursor: "pointer",
        }}
      >
        {t("lang.zh")}
      </button>
      <button
        type="button"
        className="btn-press"
        onClick={() => setLang("en")}
        style={{
          border: "none",
          background: lang === "en" ? C.iceDeep : C.frostDeep,
          color: lang === "en" ? "#fff" : C.mist,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 12px",
          borderRadius: 20,
          cursor: "pointer",
        }}
      >
        {t("lang.en")}
      </button>
    </div>
  );
}

// Energy dot
function EnergyDot({ level }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: ENERGY_DOT[level] || C.mist,
      display: "inline-block", flexShrink: 0,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 1 — 现在
═══════════════════════════════════════════════════════ */
const SpeechRecognitionAPI = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const supportsSpeech = !!SpeechRecognitionAPI;

function NowPage({ setTab, lang: _lang }) {
  const { t, lang, locale } = useLanguage();
  const [energy, setEnergy] = useState(() => {
    try {
      const savedDate = localStorage.getItem("floe-energy-date");
      const today = new Date().toISOString().split("T")[0];
      if (savedDate === today) {
        const v = localStorage.getItem("floe-energy");
        return v === "high" || v === "mid" || v === "low" ? v : null;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("floe-tasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showPostpone, setShowPostpone] = useState(null);
  const [showAll, setShowAll]     = useState(false);
  const [newText, setNewText]     = useState("");
  const [burst, setBurst]         = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [listening, setListening] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState("");
  const inputRef = useRef();
  const recognitionRef = useRef(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const tasksToday = tasks.filter((t) => !isHiddenToday(t));
  const isPostponedToday = (t) =>
    !!(t.postponedToday && t.postponedDate === todayStr);
  const mit = tasksToday.find((t) => !t.done && !isPostponedToday(t));
  const remainingNormal = tasksToday.filter(
    (t) => !t.done && !isPostponedToday(t) && t.id !== mit?.id,
  );
  const remainingPostponed = tasksToday.filter(
    (t) => !t.done && isPostponedToday(t),
  );
  const done = tasksToday.filter((t) => t.done).length;
  const total = tasksToday.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const postponeTask = (id, when) => {
    const day = new Date().toISOString().split("T")[0];
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        if (when === "later") {
          return { ...t, postponedToday: true, postponedDate: day };
        }
        if (when === "tomorrow") {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return {
            ...t,
            showAfter: tomorrow.toISOString().split("T")[0],
            postponedToday: false,
            postponedDate: undefined,
          };
        }
        return t;
      }),
    );
    setShowPostpone(null);
  };

  const toggleTask = useCallback((id) => {
    setTasks(ts => ts.map(t => {
      if (t.id !== id) return t;
      const nowDone = !t.done;
      if (nowDone) {
        posthog.capture("task_completed");
        setBurst(id);
        setTimeout(() => setBurst(null), 600);
        // Check if all done
        const allDone = ts.filter(x => x.id !== id).every(x => x.done);
        if (allDone) { setCelebrating(true); setTimeout(() => setCelebrating(false), 2800); }
      }
      return { ...t, done: nowDone };
    }));
  }, []);

  const addTask = () => {
    if (!newText.trim()) return;
    const newTask = {
      id: Date.now(),
      text: newText.trim(),
      done: false, energy: "medium", mins: 15, tag: "inbox",
    };
    setTasks(ts => [...ts, newTask]);
    posthog.capture("task_added", { energy: newTask.energy, tag: newTask.tag });
    setNewText("");
  };

  // Initialize recognition instance on mount and when language changes
  useEffect(() => {
    if (!supportsSpeech) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let r;
    try {
      r = new SR();
    } catch {
      return;
    }
    r.lang = lang === "en" ? "en-US" : "zh-CN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    recognitionRef.current = r;
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!supportsSpeech) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      console.warn("Web Speech API requires https:// or localhost. Plain http on non-localhost IP may fail.");
    }
    const r = recognitionRef.current;
    if (!r) return;
    // Toggle off if already listening
    if (listening) {
      r.stop?.();
      return;
    }
    setMicPermissionError("");
    r.onstart = () => setListening(true);
    r.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNewText(t => (t ? t + " " : "") + transcript);
      setListening(false);
    };
    r.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setMicPermissionError(
          lang === "en" ? "Please allow microphone access" : "请允许麦克风权限",
        );
      }
    };
    r.onend = () => setListening(false);
    try {
      r.start();
    } catch (e) {
      r.stop?.();
      setTimeout(() => r.start(), 200);
    }
  }, [listening]);

  useEffect(() => {
    try {
      localStorage.setItem("floe-tasks", JSON.stringify(tasks));
    } catch (e) {
      console.warn("Could not save tasks", e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem("floe-energy", energy || "");
      localStorage.setItem("floe-energy-date", today);
    } catch (e) {
      /* ignore */
    }
  }, [energy]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("now.greetingMorning");
    if (h < 18) return t("now.greetingAfternoon");
    return t("now.greetingEvening");
  })();

  const motivate = pct >= 80 ? t("now.motivateHigh")
                 : pct >= 40 ? t("now.motivateMid")
                 : t("now.motivateLow");

  if (!energy) {
    return (
      <div className="page-enter" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <LanguageToggle />
        </div>
        <FloeIce size={52} />
        <h2 style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, marginTop: 16 }}>
          {greeting} 👋
        </h2>
        <p style={{ color: C.slateLight, marginTop: 8, fontSize: 15 }}>
          {t("now.energyQuestion")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
          {[
            { key: "high", emoji: "⚡", label: t("now.energyHigh") },
            { key: "mid",  emoji: "😐", label: t("now.energyMid") },
            { key: "low",  emoji: "🪫", label: t("now.energyLow") },
          ].map(e => (
            <button
              key={e.key}
              className="btn-press"
              onClick={() => setEnergy(e.key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 8, padding: "20px 24px", borderRadius: 20,
                border: `2px solid ${C.frostDeep}`, background: C.white,
                cursor: "pointer", transition: "all 0.18s",
                boxShadow: "0 2px 12px rgba(28,43,48,0.07)",
              }}
            >
              <span style={{ fontSize: 28 }}>{e.emoji}</span>
              <span style={{ fontSize: 13, color: C.slateLight, fontWeight: 500 }}>{e.label}</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: C.mist }}>{t("now.energyHelper")}</p>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "28px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, color: C.mist, letterSpacing: "0.05em" }}>
            {new Date().toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, marginTop: 2 }}>
            {motivate}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LanguageToggle />
          <FloeIce size={28} />
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.mist }}>{t("now.progressToday")}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.iceDeep }}>{done}/{total}</span>
        </div>
        <div style={{ height: 5, background: C.frostDeep, borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 3,
            background: `linear-gradient(90deg, ${C.ice}, ${C.iceDeep})`,
            transition: "width 0.7s cubic-bezier(0.34,1.56,0.64,1)",
          }} />
        </div>
      </div>

      {/* Empty state — no tasks for today */}
      {total === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "40px 24px", textAlign: "center",
          animation: "fadeUp 0.4s ease",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "floatIce 3s ease-in-out infinite" }}>
            🧊
          </div>
          <p style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: C.slate, marginBottom: 8 }}>
            {t("now.emptyPromptTitle")}
          </p>
          <p style={{ fontSize: 14, color: C.mist, lineHeight: 1.7, marginBottom: 28 }}>
            {t("now.emptyPromptHint")}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            style={{
              padding: "13px 28px", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
              color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: FONTS.body,
              boxShadow: `0 4px 16px ${C.iceDeep}44`,
            }}
          >
            {t("now.emptyPromptCta")}
          </button>
        </div>
      )}

      {/* MIT Card */}
      {total > 0 && mit && (
        <div style={{ margin: "20px 24px 0" }}>
          <p style={{ fontSize: 11, color: C.mist, letterSpacing: "0.06em", fontWeight: 500, marginBottom: 8 }}>
            {t("now.mitTitle")}
          </p>
          <div style={{
            background: C.white, borderRadius: 20, padding: "20px",
            boxShadow: `0 4px 20px rgba(28,43,48,0.10)`,
            border: `1.5px solid ${C.frostDeep}`,
            position: "relative", overflow: "visible",
          }}>
            <div style={{
              position: "absolute", top: -20, right: -20,
              width: 80, height: 80, borderRadius: "50%",
              background: `radial-gradient(circle, ${C.frostDeep}80, transparent)`,
              pointerEvents: "none",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <EnergyDot level={mit.energy} />
              <Tag label={mit.tag} />
              <span style={{ fontSize: 12, color: C.mist }}>{mit.mins}m</span>
            </div>
            <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4, marginBottom: 18 }}>
              {mit.text}
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <button
                type="button"
                className="btn-press"
                onClick={() => { toggleTask(mit.id); setTab("focus"); }}
                style={{
                  flex: 1, padding: "12px", borderRadius: 14, border: "none",
                  background: `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: `0 4px 16px ${C.iceDeep}44`,
                }}
              >
                {t("now.startFocus")}
              </button>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-press"
                  onClick={() => setShowPostpone(showPostpone === mit.id ? null : mit.id)}
                  style={{
                    padding: "12px 16px", borderRadius: 14,
                    border: `1.5px solid ${C.frostDeep}`, background: "transparent",
                    color: C.mist, fontSize: 13, cursor: "pointer",
                    fontFamily: FONTS.body, position: "relative",
                  }}
                >
                  {t("now.postponeLater")}
                </button>
                {showPostpone === mit.id && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0,
                    background: C.white, borderRadius: 14, border: `1.5px solid ${C.frostDeep}`,
                    boxShadow: "0 4px 16px rgba(28,43,48,0.12)",
                    overflow: "hidden", zIndex: 50, minWidth: 160,
                    animation: "fadeUp 0.2s ease",
                  }}>
                    <button
                      type="button"
                      onClick={() => postponeTask(mit.id, "later")}
                      style={{
                        width: "100%", padding: "12px 16px", border: "none",
                        background: "transparent", textAlign: "left",
                        fontSize: 14, color: C.slate, cursor: "pointer",
                        borderBottom: `1px solid ${C.frostDeep}`,
                        fontFamily: FONTS.body,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.frost; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {t("now.postponeTonight")}
                    </button>
                    <button
                      type="button"
                      onClick={() => postponeTask(mit.id, "tomorrow")}
                      style={{
                        width: "100%", padding: "12px 16px", border: "none",
                        background: "transparent", textAlign: "left",
                        fontSize: 14, color: C.slate, cursor: "pointer",
                        fontFamily: FONTS.body,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.frost; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {t("now.postponeTomorrow")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rest of tasks (not MIT) */}
      {total > 0 && remainingNormal.length > 0 && (
        <div style={{ margin: "20px 24px 0" }}>
          <button
            type="button"
            onClick={() => setShowAll(s => !s)}
            style={{
              width: "100%", textAlign: "left", background: "none",
              border: "none", cursor: "pointer", fontSize: 12, color: C.mist,
              letterSpacing: "0.06em", fontWeight: 500, marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{ transition: "transform 0.2s", display: "inline-block", transform: showAll ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
            {t("now.moreTasks", { n: remainingNormal.length })}
          </button>

          {showAll && remainingNormal.map((taskRow, i) => (
            <TaskRow
              key={taskRow.id}
              task={taskRow}
              burst={burst === taskRow.id}
              delay={i * 0.04}
              onToggle={() => toggleTask(taskRow.id)}
              showPostpone={showPostpone}
              setShowPostpone={setShowPostpone}
              postponeTask={postponeTask}
              postponeMuted={false}
            />
          ))}
        </div>
      )}

      {/* Postponed to tonight — bottom, muted */}
      {total > 0 && remainingPostponed.length > 0 && (
        <div style={{ margin: "20px 24px 0" }}>
          <p style={{ fontSize: 11, color: C.mist, letterSpacing: "0.06em", fontWeight: 500, marginBottom: 10 }}>
            {t("now.postponedSection")}
          </p>
          {remainingPostponed.map((taskRow, i) => (
            <TaskRow
              key={taskRow.id}
              task={taskRow}
              burst={burst === taskRow.id}
              delay={i * 0.04}
              onToggle={() => toggleTask(taskRow.id)}
              showPostpone={showPostpone}
              setShowPostpone={setShowPostpone}
              postponeTask={postponeTask}
              postponeMuted
            />
          ))}
        </div>
      )}

      {/* Done tasks (collapsed) */}
      {total > 0 && done > 0 && (
        <div style={{ margin: "8px 24px 0" }}>
          {tasksToday.filter((x) => x.done).map((taskRow) => (
            <TaskRow
              key={taskRow.id}
              task={taskRow}
              burst={false}
              delay={0}
              onToggle={() => toggleTask(taskRow.id)}
              showPostpone={showPostpone}
              setShowPostpone={setShowPostpone}
              postponeTask={postponeTask}
              postponeMuted={false}
              doneOnly
            />
          ))}
        </div>
      )}

      {/* Add task */}
      <div style={{ margin: "16px 24px 0" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask()}
            placeholder={t("now.addTaskPlaceholder")}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 14,
              border: `1.5px solid ${C.frostDeep}`, background: C.white,
              fontSize: 14, outline: "none", color: C.slate,
              transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = C.iceDeep}
            onBlur={e => e.target.style.borderColor = C.frostDeep}
          />
          {supportsSpeech && (
            <>
              <button
                className="btn-press"
                onClick={startListening}
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  border: `1.5px solid ${C.frostDeep}`, background: C.white,
                  fontSize: 18, cursor: "pointer",
                  transition: "all 0.2s",
                  animation: listening ? "micPulse 1.5s ease-in-out infinite" : "none",
                }}
                title={listening ? t("now.micStop") : t("now.micStart")}
              >
                {listening ? "🔴" : "🎤"}
              </button>
            </>
          )}
          <button
            className="btn-press"
            onClick={addTask}
            style={{
              width: 48, height: 48, borderRadius: 14, border: "none",
              background: newText ? C.iceDeep : C.frostDeep,
              color: "#fff", fontSize: 20, cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            +
          </button>
        </div>
        {listening && (
          <p style={{ fontSize: 11, color: C.iceDeep, marginTop: 8, fontWeight: 500 }}>
            {t("now.listening")}
          </p>
        )}
        {micPermissionError && (
          <p style={{ fontSize: 11, color: C.blush, marginTop: 8 }}>
            {micPermissionError}
          </p>
        )}
      </div>

      {/* Celebration overlay */}
      {celebrating && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", zIndex: 200,
          background: "rgba(244,241,236,0.92)", backdropFilter: "blur(8px)",
        }}>
          <div style={{ animation: "celebrationBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both", fontSize: 72 }}>
            🧊
          </div>
          <p style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 700, marginTop: 16, color: C.iceDeep }}>
            {t("now.celebrateTitle")}
          </p>
          <p style={{ color: C.slateLight, marginTop: 8 }}>{t("now.celebrateSub")}</p>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  burst,
  delay,
  onToggle,
  showPostpone,
  setShowPostpone,
  postponeTask,
  postponeMuted,
  doneOnly,
}) {
  const { t } = useLanguage();
  const muted = postponeMuted && !task.done;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", background: task.done ? "transparent" : muted ? C.frost : C.white,
        borderRadius: 14, marginBottom: 8,
        border: `1.5px solid ${task.done ? "transparent" : C.frostDeep}`,
        opacity: task.done ? 0.5 : muted ? 0.88 : 1,
        animation: `fadeUp 0.3s ease ${delay}s both`,
        position: "relative", overflow: "visible",
        transition: "opacity 0.3s",
      }}
    >
      <Particles active={burst} />
      <div
        onClick={onToggle}
        style={{
          width: 24, height: 24, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
          border: `2px solid ${task.done ? C.sage : C.frostDeep}`,
          background: task.done ? C.sage : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s",
        }}
      >
        {task.done && (
          <span style={{ color: "#fff", fontSize: 12, animation: "checkPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            ✓
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onToggle}>
        <p style={{
          fontSize: 14, textDecoration: task.done ? "line-through" : "none",
          color: task.done ? C.mist : C.slate, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {task.text}
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          {muted && (
            <span style={{ fontSize: 10, color: C.mist, fontWeight: 500 }}>
              {t("now.postponeTonightBadge")}
            </span>
          )}
          <Tag label={task.tag} />
          <EnergyDot level={task.energy} />
          <span style={{ fontSize: 11, color: C.mist }}>{task.mins}m</span>
        </div>
      </div>
      {!task.done && !doneOnly && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowPostpone(showPostpone === task.id ? null : task.id)}
            style={{
              padding: "8px 10px", borderRadius: 12,
              border: `1.5px solid ${C.frostDeep}`, background: "transparent",
              color: C.mist, fontSize: 12, cursor: "pointer",
              fontFamily: FONTS.body,
            }}
          >
            {t("now.postponeLater")}
          </button>
          {showPostpone === task.id && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: C.white, borderRadius: 14, border: `1.5px solid ${C.frostDeep}`,
              boxShadow: "0 4px 16px rgba(28,43,48,0.12)",
              overflow: "hidden", zIndex: 50, minWidth: 160,
              animation: "fadeUp 0.2s ease",
            }}>
              <button
                type="button"
                onClick={() => postponeTask(task.id, "later")}
                style={{
                  width: "100%", padding: "12px 16px", border: "none",
                  background: "transparent", textAlign: "left",
                  fontSize: 14, color: C.slate, cursor: "pointer",
                  borderBottom: `1px solid ${C.frostDeep}`,
                  fontFamily: FONTS.body,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.frost; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {t("now.postponeTonight")}
              </button>
              <button
                type="button"
                onClick={() => postponeTask(task.id, "tomorrow")}
                style={{
                  width: "100%", padding: "12px 16px", border: "none",
                  background: "transparent", textAlign: "left",
                  fontSize: 14, color: C.slate, cursor: "pointer",
                  fontFamily: FONTS.body,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.frost; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {t("now.postponeTomorrow")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 2 — 专注
═══════════════════════════════════════════════════════ */
const FOCUS_MODES = [
  { id: "adhd",  mins: 15, color: C.gold,    emoji: "⚡" },
  { id: "focus", mins: 25, color: C.iceDeep, emoji: "🎯" },
  { id: "short", mins: 5,  color: C.sage,    emoji: "🌿" },
  { id: "long",  mins: 15, color: C.blush,   emoji: "☁️" },
];

function FocusPage({ lang: _lang }) {
  const { t, lang } = useLanguage();
  const [mode, setMode]       = useState(FOCUS_MODES[0]);
  const [secs, setSecs]       = useState(FOCUS_MODES[0].mins * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase]     = useState("idle"); // idle|running|completed
  const [skipNotice, setSkipNotice] = useState("");
  const lastPhaseRef = useRef("idle");
  const [sessions, setSessions] = useState(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const savedDate = localStorage.getItem("floe-sessions-date");
      if (savedDate === today) {
        return parseInt(localStorage.getItem("floe-sessions") || "0", 10) || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  });
  const intervalRef = useRef();

  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem("floe-sessions", String(sessions));
      localStorage.setItem("floe-sessions-date", today);
    } catch (e) {
      /* ignore */
    }
  }, [sessions]);

  const total    = mode.mins * 60;
  const pct      = ((total - secs) / total) * 100;
  const R        = 88;
  const circ     = 2 * Math.PI * R;
  const dashOff  = circ - (pct / 100) * circ;
  const fmt      = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setPhase("completed");
            if (mode.id === "focus" || mode.id === "adhd") setSessions(n => n + 1);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  useEffect(() => {
    if (phase === "completed" && lastPhaseRef.current !== "completed") {
      posthog.capture("pomodoro_completed", { mode: mode.id, mins: mode.mins });
    }
    lastPhaseRef.current = phase;
  }, [phase, mode.id, mode.mins]);

  const switchMode = (m) => {
    clearInterval(intervalRef.current);
    setMode(m);
    setSecs(m.mins * 60);
    setRunning(false);
    setPhase("idle");
    setSkipNotice("");
  };
  const toggle = () => {
    setRunning((r) => !r);
    if (phase === "idle") setPhase("running");
  };
  const reset = () => {
    setRunning(false);
    setSecs(mode.mins * 60);
    setPhase("idle");
    setSkipNotice("");
  };

  const skipCurrentTimer = () => {
    const elapsedRatio = mode.mins > 0 ? (mode.mins * 60 - secs) / (mode.mins * 60) : 0;
    setSecs(0);
    setRunning(false);
    setPhase("completed");
    if ((mode.id === "focus" || mode.id === "adhd") && elapsedRatio >= 0.3) {
      setSessions((n) => n + 1);
      setSkipNotice("");
      return;
    }
    setSkipNotice(
      lang === "en"
        ? "Note: skipping early won't count as a session"
        : "提示：跳过不会计入番茄数",
    );
    setTimeout(() => setSkipNotice(""), 2000);
  };

  const tipByMode = {
    adhd:  t("focus.tips.adhd"),
    focus: t("focus.tips.focus"),
    short: t("focus.tips.short"),
    long:  t("focus.tips.long"),
  };

  return (
    <div className="page-enter" style={{ padding: "28px 24px 100px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600 }}>{t("focus.title")}</h1>
          <p style={{ fontSize: 13, color: C.mist, marginTop: 3 }}>
            {t("focus.pomodorosToday", { n: sessions })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LanguageToggle />
          <FloeIce size={26} style={{ marginTop: 4 }} />
        </div>
      </div>

      {/* Mode Selector */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: 8, margin: "24px 0",
      }}>
        {FOCUS_MODES.map(m => (
          <button
            key={m.id}
            className="btn-press"
            onClick={() => switchMode(m)}
            style={{
              padding: "10px 4px", borderRadius: 14, cursor: "pointer",
              background: mode.id === m.id ? m.color : C.white,
              color: mode.id === m.id ? "#fff" : C.slateLight,
              boxShadow: mode.id === m.id ? `0 4px 14px ${m.color}55` : "none",
              border: mode.id === m.id ? "none" : `1.5px solid ${C.frostDeep}`,
              transition: "all 0.22s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>{m.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>
              {t(`focus.modes.${m.id}`)}
            </span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{m.mins}m</span>
          </button>
        ))}
      </div>

      {/* Timer Ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 210, height: 210 }}>
          {/* Glow */}
          {running && (
            <div style={{
              position: "absolute", inset: 20, borderRadius: "50%",
              background: `radial-gradient(circle, ${mode.color}22, transparent)`,
              animation: "breatheRing 2.5s ease-in-out infinite",
            }} />
          )}
          <svg width="210" height="210" style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
            {/* Track */}
            <circle cx="105" cy="105" r={R} fill="none" stroke={C.frostDeep} strokeWidth="9" />
            {/* Progress */}
            <circle
              cx="105" cy="105" r={R}
              fill="none"
              stroke={mode.color}
              strokeWidth="9"
              strokeDasharray={circ}
              strokeDashoffset={dashOff}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.95s linear", filter: `drop-shadow(0 0 6px ${mode.color}88)` }}
            />
          </svg>
          {/* Center text */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <span style={{
              fontFamily: FONTS.display, fontSize: 44, fontWeight: 700,
              color: mode.color, letterSpacing: "-0.02em",
              animation: running ? "timerPulse 2.5s ease-in-out infinite" : "none",
            }}>
              {fmt(secs)}
            </span>
            <span style={{ fontSize: 12, color: C.mist }}>{t(`focus.modes.${mode.id}`)}</span>
          </div>
        </div>

        {/* Done message */}
        {phase === "completed" && (
          <div style={{
            padding: "10px 24px", background: `${mode.color}18`, borderRadius: 20,
            border: `1.5px solid ${mode.color}44`, animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
            <span style={{ fontSize: 13, color: mode.color, fontWeight: 500 }}>
              {mode.id === "focus" || mode.id === "adhd" ? t("focus.doneWork") : t("focus.doneBreak")}
            </span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <button
              className="btn-press"
              onClick={reset}
              title={lang === "en" ? "Reset" : "重置"}
              style={{
                width: 48, height: 48, borderRadius: "50%",
                border: `2px solid ${C.frostDeep}`, background: C.white,
                fontSize: 18, cursor: "pointer", color: C.slateLight,
              }}
            >↺</button>
            <span style={{ fontSize: 10, color: C.mist }}>{lang === "en" ? "Reset" : "重置"}</span>
          </div>
          <button
            className="btn-press"
            onClick={toggle}
            style={{
              width: 76, height: 76, borderRadius: "50%", border: "none",
              background: `linear-gradient(135deg, ${mode.color}, ${mode.color}cc)`,
              color: "#fff", fontSize: 26, cursor: "pointer",
              boxShadow: `0 8px 28px ${mode.color}55`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            {running ? "⏸" : "▶"}
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <button
              className="btn-press"
              onClick={skipCurrentTimer}
              title={lang === "en" ? "Skip current timer" : "跳过当前计时"}
              style={{
                width: 48, height: 48, borderRadius: "50%",
                border: `2px solid ${C.frostDeep}`, background: C.white,
                fontSize: 16, cursor: "pointer", color: C.slateLight,
              }}
            >⏭</button>
            <span style={{ fontSize: 10, color: C.mist }}>{lang === "en" ? "Skip" : "跳过"}</span>
          </div>
        </div>
        {skipNotice && (
          <p style={{ fontSize: 12, color: C.mist, marginTop: 4, animation: "fadeUp 0.2s ease" }}>
            {skipNotice}
          </p>
        )}
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 28, padding: "16px", borderRadius: 16,
        background: C.white, border: `1.5px solid ${C.frostDeep}`,
        borderLeft: `3px solid ${mode.color}`,
      }}>
        <p style={{ fontSize: 12, color: mode.color, fontWeight: 600, marginBottom: 5 }}>
          {t("focus.floeTip")} {mode.emoji}
        </p>
        <p style={{ fontSize: 13, color: C.slateLight, lineHeight: 1.65 }}>
          {tipByMode[mode.id]}
        </p>
      </div>

      {/* Body Double */}
      <button
        className="btn-press"
        style={{
          width: "100%", marginTop: 12, padding: "13px",
          borderRadius: 16, border: `1.5px dashed ${C.frostDeep}`,
          background: "transparent", cursor: "pointer",
          fontSize: 13, color: C.mist,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <span>👥</span>
        <span>{t("focus.together")}</span>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 3 — 心情
═══════════════════════════════════════════════════════ */
const MOODS_BASE = [
  { emoji: "😩", color: "#E88080" },
  { emoji: "😔", color: "#D4A574" },
  { emoji: "😐", color: C.mist },
  { emoji: "😊", color: C.sage },
  { emoji: "✨", color: C.iceDeep },
];

function formatTime(d, locale) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function MonthCalendar({ allDaysData, onSelectDay, locale, weekDays, t }) {
  const [calMonth, setCalMonth] = useState(() => new Date());
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = calMonth.toLocaleDateString(locale, { year: "numeric", month: "long" });

  return (
    <div style={{ padding: "0 24px", animation: "fadeUp 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button
          className="btn-press"
          onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.slateLight, padding: "4px 8px" }}
        >‹</button>
        <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: C.slate }}>{monthLabel}</span>
        <button
          className="btn-press"
          onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.slateLight, padding: "4px 8px" }}
        >›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.mist, padding: "4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = allDaysData[dateKey];
          const hasEntries = dayData?.entries?.length > 0;
          const moodEmoji = dayData?.mood?.emoji;
          const isToday = dateKey === today;
          const isFuture = dateKey > today;
          return (
            <div
              key={i}
              onClick={() => !isFuture && hasEntries && onSelectDay(dateKey)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "6px 2px",
                borderRadius: 12,
                background: isToday ? C.frost : "transparent",
                border: isToday ? "1.5px solid " + C.ice : "1.5px solid transparent",
                cursor: hasEntries && !isFuture ? "pointer" : "default",
                opacity: isFuture ? 0.3 : 1,
                transition: "all 0.15s",
                minHeight: 52,
              }}
            >
              {moodEmoji ? (
                <span style={{ fontSize: 18 }}>{moodEmoji}</span>
              ) : (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: hasEntries ? C.iceDeep : "transparent",
                  border: hasEntries ? "none" : "1.5px solid " + C.frostDeep,
                }} />
              )}
              <span style={{
                fontSize: 11,
                color: isToday ? C.iceDeep : hasEntries ? C.slateLight : C.mist,
                fontWeight: isToday ? 600 : 400,
              }}>
                {day}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: C.mist, display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.iceDeep }} />
          {t("mood.calendarLegend")}
        </span>
        <span style={{ fontSize: 11, color: C.mist }}>{t("mood.calendarHint")}</span>
      </div>
    </div>
  );
}

function MoodPage({ lang: _lang }) {
  const { t, lang, locale } = useLanguage();
  const { user, isAIEnabled, setPaywallOpen, subLoading } = useFloeSubscription();
  const { canUse, remaining, increment, loading: usageLoading } = useUsage(user?.id);
  const levelLabels = lang === "en" ? en.mood.levels : zh.mood.levels;
  const weekDays = lang === "en" ? en.mood.weekDays : zh.mood.weekDays;

  const [selectedMood, setSelectedMood] = useState(() => {
    try {
      const savedDate = localStorage.getItem("floe-mood-date");
      const today = new Date().toISOString().split("T")[0];
      if (savedDate === today) {
        const saved = localStorage.getItem("floe-mood-index");
        if (saved === null || saved === "") return null;
        const n = JSON.parse(saved);
        if (n === null) return null;
        const idx = typeof n === "number" ? n : parseInt(String(n), 10);
        if (!Number.isFinite(idx) || idx < 0 || idx >= MOODS_BASE.length) return null;
        return idx;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [entries, setEntries] = useState(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const saved = localStorage.getItem("floe-entries-" + today);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [allDaysData, setAllDaysData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("floe-all-days") || "{}");
    } catch {
      return {};
    }
  });
  const [view, setView] = useState("today");
  const [selectedDay, setSelectedDay] = useState(null);
  const [inputText, setInputText] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [expandedChats, setExpandedChats] = useState({});
  const [generatingFromChat, setGeneratingFromChat] = useState(null);
  const [showSOS, setShowSOS] = useState(false);
  const [sosStep, setSOSStep] = useState(1);
  const [sosReason, setSOSReason] = useState(null);
  const [chatListening, setChatListening] = useState(false);
  const chatBottomRef = useRef();
  const chatRecognitionRef = useRef(null);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem("floe-mood-date", today);
      localStorage.setItem("floe-mood-index", JSON.stringify(selectedMood));
    } catch (e) {
      /* ignore */
    }
  }, [selectedMood]);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem("floe-entries-" + today, JSON.stringify(entries));

      const allDays = JSON.parse(localStorage.getItem("floe-all-days") || "{}");
      const todayMood =
        selectedMood !== null
          ? { ...MOODS_BASE[selectedMood], label: levelLabels[selectedMood] }
          : null;
      allDays[today] = { entries, mood: todayMood };
      localStorage.setItem("floe-all-days", JSON.stringify(allDays));
      setAllDaysData(allDays);
    } catch (e) {
      console.warn("Could not save entries", e);
    }
  }, [entries, selectedMood, lang, levelLabels]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, typing]);

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SR) return;
    let r;
    try {
      r = new SR();
    } catch {
      return;
    }
    r.lang = lang === "zh" ? "zh-CN" : "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onstart = () => setChatListening(true);
    r.onresult = (e) => {
      setChatInput((prev) => prev + e.results[0][0].transcript);
      setChatListening(false);
    };
    r.onerror = () => setChatListening(false);
    r.onend = () => setChatListening(false);
    chatRecognitionRef.current = r;
    return () => {
      r.abort?.();
      chatRecognitionRef.current = null;
    };
  }, [lang]);

  const saveNote = () => {
    if (!inputText.trim()) return;
    setEntries(e => [...e, {
      id: Date.now(),
      type: "note",
      createdAt: new Date(),
      content: inputText.trim(),
    }]);
    posthog.capture("journal_note_saved");
    setInputText("");
  };

  const saveChat = () => {
    const hasUserMsg = chatMessages.some(m => m.role === "user");
    if (!hasUserMsg) { setChatMessages([]); setShowChat(false); return; }
    setEntries(e => [...e, {
      id: Date.now(),
      type: "chat",
      createdAt: new Date(),
      messages: [...chatMessages],
    }]);
    setChatMessages([]);
    setShowChat(false);
  };

  const openChat = () => {
    if (subLoading) return;
    if (!isAIEnabled()) {
      setPaywallOpen(true);
      return;
    }
    setChatMessages([{ role: "ai", text: t("mood.chat.initial") }]);
    setShowChat(true);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    if (subLoading) return;
    if (!isAIEnabled()) {
      setPaywallOpen(true);
      return;
    }
    if (usageLoading) return;
    if (!canUse("ai_turns")) {
      setChatMessages((m) => [
        ...m,
        { role: "ai", text: t("mood.usageChatLimit") },
      ]);
      return;
    }
    await increment("ai_turns");
    posthog.capture("ai_chat_sent");
    const text = chatInput;
    setChatInput("");
    const updatedMessages = [...chatMessages, { role: "user", text }];
    setChatMessages(updatedMessages);
    setTyping(true);
    try {
      const moodContext = selectedMood !== null
        ? (lang === "en"
          ? `[User's current mood: ${levelLabels[selectedMood]} ${MOODS_BASE[selectedMood].emoji}. Acknowledge subtly if relevant.] `
          : `[用户当前心情：${levelLabels[selectedMood]} ${MOODS_BASE[selectedMood].emoji}。如相关则自然提及。] `)
        : "";
      const apiMessages = moodContext
        ? [...updatedMessages.slice(0, -1), { ...updatedMessages[updatedMessages.length - 1], text: moodContext + text }]
        : updatedMessages;
      const reply = await getCBTResponse(apiMessages, lang);
      setChatMessages(m => [...m, { role: "ai", text: reply }]);
    } catch (e) {
      console.error("AI error:", e);
      setChatMessages(m => [...m, { role: "ai", text: t("error.api", { msg: e.message }) }]);
    } finally {
      setTyping(false);
    }
  };

  const handleGenerateFromChat = async (entry) => {
    if (subLoading) return;
    if (!isAIEnabled()) {
      setPaywallOpen(true);
      return;
    }
    if (usageLoading) return;
    if (!canUse("journal_generates")) {
      alert(t("mood.usageJournalLimit"));
      return;
    }
    await increment("journal_generates");
    posthog.capture("journal_generated");
    setGeneratingFromChat(entry.id);
    try {
      const journalText = await generateJournalEntry(entry.messages, lang);
      setEntries(e => [...e, {
        id: Date.now(),
        type: "note",
        createdAt: new Date(),
        content: journalText,
      }]);
    } catch (e) {
      setEntries(e => [...e, {
        id: Date.now(),
        type: "note",
        createdAt: new Date(),
        content: t("mood.journalFail"),
      }]);
    } finally {
      setGeneratingFromChat(null);
    }
  };

  const sortedEntries = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const handleSelectDay = (dateKey) => {
    setSelectedDay(dateKey);
    setView("day");
  };

  const toggleChatMic = () => {
    const r = chatRecognitionRef.current;
    if (!r) return;
    if (chatListening) {
      r.stop?.();
      return;
    }
    try {
      r.start();
    } catch {
      /* already started */
    }
  };

  const SOS_REASON_OPTIONS = [
    {
      id: "too_big",
      labelZh: "😩 任务太大，不知从哪开始",
      labelEn: "😩 Task feels too big",
      actionZh: "打开文档，只看第一行。不用做，只是看。",
      actionEn: "Open the doc. Just read the first line. Don't do anything yet.",
    },
    {
      id: "anxious",
      labelZh: "😰 有点焦虑，静不下来",
      labelEn: "😰 Feeling anxious",
      actionZh: "把脑子里所有担心的事，花2分钟全写下来。写完就放下。",
      actionEn: "Spend 2 minutes writing down every worry. Then set it aside.",
    },
    {
      id: "blank",
      labelZh: "😶 脑子空白，什么都不想做",
      labelEn: "😶 Mind is blank",
      actionZh: "站起来，倒杯水，回来。就这一步。",
      actionEn: "Stand up, get water, come back. Just that.",
    },
    {
      id: "flow_lost",
      labelZh: "😤 被打断了，失去状态",
      labelEn: "😤 Lost my flow",
      actionZh: "关掉所有 tab，只留一个。设一个15分钟计时器。",
      actionEn: "Close all tabs, keep just one. Set a 15-minute timer.",
    },
  ];
  const selectedSOS = SOS_REASON_OPTIONS.find((x) => x.id === sosReason) || SOS_REASON_OPTIONS[0];
  const closeSOS = () => {
    setShowSOS(false);
    setSOSStep(1);
    setSOSReason(null);
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 72px)" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "28px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600 }}>{t("mood.pageTitle")}</h1>
            <p style={{ fontSize: 12, color: C.mist, marginTop: 4 }}>
              {new Date().toLocaleDateString(locale, { month: "numeric", day: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LanguageToggle />
            <button
              className="btn-press"
              onClick={() => setShowSOS(true)}
              style={{
                padding: "7px 14px", borderRadius: 20, border: "none",
                background: `${C.blush}33`, color: C.blush,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t("mood.stuck")}
            </button>
          </div>
        </div>
      </div>

      {/* Mood bar - only on today view */}
      {view === "today" && (
      <div style={{
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: C.mist, whiteSpace: "nowrap" }}>{t("mood.feelingNow")}</span>
        <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "space-between" }}>
          {MOODS_BASE.map((m, i) => {
            const isSelected = selectedMood === i;
            const label = levelLabels[i];
            return (
              <div
                key={i}
                onClick={() => {
                  setSelectedMood(i);
                  posthog.capture("mood_selected", { mood_index: i });
                }}
                className="btn-press"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: isSelected ? 38 : 30,
                  height: isSelected ? 38 : 30,
                  borderRadius: "50%",
                  background: isSelected ? m.color : "transparent",
                  border: `2px solid ${isSelected ? m.color : C.frostDeep}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isSelected ? 18 : 14,
                  transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  boxShadow: isSelected ? `0 4px 12px ${m.color}55` : "none",
                  animation: selectedMood === null ? `breatheRing 2.5s ease-in-out ${i * 0.15}s infinite` : "none",
                }}>
                  {m.emoji}
                </div>
                {isSelected && (
                  <span style={{
                    fontSize: 10,
                    color: m.color,
                    fontWeight: 600,
                    animation: "fadeUp 0.2s ease",
                  }}>
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* View toggle - hidden on day detail */}
      {view !== "day" && (
        <div style={{
          display: "flex",
          gap: 4,
          margin: "0 24px 12px",
          background: C.frostDeep,
          borderRadius: 12,
          padding: 3,
          flexShrink: 0,
        }}>
          {[["today", t("mood.viewToday")], ["calendar", t("mood.viewCalendar")]].map(([v, l]) => (
            <button
              key={v}
              className="btn-press"
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 10,
                border: "none",
                background: view === v ? C.white : "transparent",
                color: view === v ? C.slate : C.mist,
                fontSize: 13,
                fontWeight: view === v ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: FONTS.body,
                boxShadow: view === v ? "0 2px 8px rgba(28,43,48,0.08)" : "none",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
      {view === "today" && (
      <div style={{ padding: "16px 24px 24px" }}>
        {sortedEntries.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            color: C.mist,
            fontSize: 14,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 40, marginBottom: 16 }}>📝</span>
            <p>{t("mood.emptyTitle")}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{t("mood.emptyHint")}</p>
          </div>
        ) : (
          sortedEntries.map(entry =>
            entry.type === "note" ? (
              <div
                key={entry.id}
                style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1.5px solid " + C.frostDeep,
                  marginBottom: 10,
                  animation: "fadeUp 0.3s ease",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: C.mist, marginTop: 2, flexShrink: 0 }}>
                    {formatTime(entry.createdAt, locale)}
                  </span>
                  <p style={{ fontSize: 15, color: C.slate, lineHeight: 1.7, flex: 1, whiteSpace: "pre-line" }}>
                    {entry.content}
                  </p>
                </div>
              </div>
            ) : (
              <div
                key={entry.id}
                style={{
                  background: C.frost,
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1.5px solid " + C.frostDeep,
                  marginBottom: 10,
                  animation: "fadeUp 0.3s ease",
                }}
              >
                <div
                  style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedChats(s => ({ ...s, [entry.id]: !s[entry.id] }))}
                >
                  <span style={{ fontSize: 11, color: C.mist, flexShrink: 0 }}>{formatTime(entry.createdAt, locale)}</span>
                  <span style={{ fontSize: 16 }}>🧊</span>
                  <span style={{ fontSize: 14, color: C.slateLight, flex: 1 }}>
                    {t("mood.chatLine", { n: entry.messages.filter(m => m.role === "user").length })}
                  </span>
                  <span style={{
                    color: C.mist,
                    fontSize: 14,
                    transform: expandedChats[entry.id] ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}>›</span>
                </div>
                {expandedChats[entry.id] && (
                  <div style={{ marginTop: 12, borderTop: "1px solid " + C.frostDeep, paddingTop: 12 }}>
                    {entry.messages.map((m, i) => (
                      <div key={i} style={{
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                        marginBottom: 8,
                      }}>
                        <div style={{
                          maxWidth: "80%",
                          padding: "8px 12px",
                          fontSize: 13,
                          lineHeight: 1.6,
                          borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                          background: m.role === "user" ? C.iceDeep : C.white,
                          color: m.role === "user" ? "#fff" : C.slate,
                          border: m.role === "ai" ? "1px solid " + C.frostDeep : "none",
                          whiteSpace: "pre-line",
                        }}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    <button
                      className="btn-press"
                      onClick={() => handleGenerateFromChat(entry)}
                      disabled={generatingFromChat === entry.id}
                      style={{
                        width: "100%",
                        marginTop: 10,
                        padding: "10px",
                        borderRadius: 12,
                        border: "1.5px solid " + C.frostDeep,
                        background: C.white,
                        color: C.iceDeep,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: generatingFromChat === entry.id ? "wait" : "pointer",
                        fontFamily: FONTS.body,
                      }}
                    >
                      {generatingFromChat === entry.id ? t("mood.generating") : t("mood.journalSnippet")}
                    </button>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
      )}
      {view === "calendar" && (
        <MonthCalendar
          allDaysData={allDaysData}
          onSelectDay={handleSelectDay}
          locale={locale}
          weekDays={weekDays}
          t={t}
        />
      )}
      {view === "day" && selectedDay && (
        <div style={{ padding: "0 24px", animation: "fadeUp 0.3s ease" }}>
          <button
            onClick={() => { setView("calendar"); setSelectedDay(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.iceDeep,
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 16,
              fontFamily: FONTS.body,
              padding: 0,
            }}
          >
            {t("mood.backCalendar")}
          </button>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600 }}>
              {new Date(selectedDay + "T12:00:00").toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "long" })}
            </h2>
            {allDaysData[selectedDay]?.mood && (
              <span style={{ fontSize: 13, color: C.slateLight, marginTop: 4, display: "block" }}>
                {t("mood.dayMood")}{allDaysData[selectedDay].mood.emoji} {allDaysData[selectedDay].mood.label}
              </span>
            )}
          </div>
          {(allDaysData[selectedDay]?.entries || []).map((entry, i) => (
            <div key={i}>
              {entry.type === "note" ? (
                <div style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1.5px solid " + C.frostDeep,
                  marginBottom: 10,
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, color: C.mist, marginTop: 2, flexShrink: 0 }}>
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                    </span>
                    <p style={{ fontSize: 15, color: C.slate, lineHeight: 1.7, flex: 1, margin: 0 }}>
                      {entry.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: C.frost,
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1.5px solid " + C.frostDeep,
                  marginBottom: 10,
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mist }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}</span>
                    <span>🧊</span>
                    <span style={{ fontSize: 14, color: C.slateLight }}>
                      {t("mood.chatLine", { n: (entry.messages || []).filter(m => m.role === "user").length })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Bottom action bar - only on today view */}
      {view === "today" && !showChat && (
        <div style={{
          display: "flex",
          gap: 10,
          padding: "12px 24px 24px",
          background: C.bg,
          flexShrink: 0,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0))",
        }}>
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveNote()}
            placeholder={t("mood.emptyHint")}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 16,
              border: "1.5px solid " + C.frostDeep,
              background: C.white,
              fontSize: 14,
              outline: "none",
              fontFamily: FONTS.body,
              color: C.slate,
            }}
            onFocus={e => e.target.style.borderColor = C.iceDeep}
            onBlur={e => e.target.style.borderColor = C.frostDeep}
          />
          <button
            className="btn-press"
            onClick={saveNote}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "none",
              background: inputText.trim() ? C.iceDeep : C.frostDeep,
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >✓</button>
          <button
            className="btn-press"
            onClick={openChat}
            style={{
              height: 46,
              padding: "0 16px",
              borderRadius: 14,
              border: "1.5px solid " + C.frostDeep,
              background: C.frost,
              color: C.iceDeep,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: FONTS.body,
            }}
          >
            {t("mood.chatWithFloe")}
          </button>
        </div>
      )}

      {/* Chat panel (slide up) */}
      {showChat && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 140,
              background: "rgba(28,43,48,0.35)",
              backdropFilter: "blur(4px)",
              animation: "fadeUp 0.25s ease",
            }}
            onClick={saveChat}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 430,
              height: "65vh",
              zIndex: 150,
              background: C.white,
              borderRadius: "24px 24px 0 0",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -8px 32px rgba(28,43,48,0.15)",
              animation: "fadeUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid " + C.frostDeep,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
              flexShrink: 0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600 }}>{t("mood.chatTitle")}</h3>
                {remaining("ai_turns") <= 6 && (
                  <span style={{ fontSize: 11, color: C.mist, display: "block", marginTop: 4 }}>
                    {t("mood.usageRemainingHint", { n: remaining("ai_turns") })}
                  </span>
                )}
              </div>
              <button
                className="btn-press"
                onClick={saveChat}
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: C.iceDeep,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONTS.body,
                  flexShrink: 0,
                }}
              >
                {t("mood.chatDone")}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                    background: m.role === "user"
                      ? `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`
                      : C.frost,
                    color: m.role === "user" ? "#fff" : C.slate,
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-line",
                    border: m.role === "ai" ? "1px solid " + C.frostDeep : "none",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    padding: "10px 14px",
                    background: C.frost,
                    borderRadius: "4px 16px 16px 16px",
                    border: "1px solid " + C.frostDeep,
                    display: "flex",
                    gap: 5,
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: C.ice,
                        animation: `dotBounce 1.2s ease ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} style={{ height: 8 }} />
            </div>
            <div style={{
              flexShrink: 0,
              padding: "12px 24px 20px",
              borderTop: "1px solid " + C.frostDeep,
              display: "flex",
              gap: 10,
            }}>
              {supportsSpeech && (
                <button
                  type="button"
                  className="btn-press"
                  onClick={toggleChatMic}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "none",
                    background: chatListening ? "#FF6B6B" : C.frostDeep,
                    boxShadow: chatListening ? "0 0 0 6px rgba(255,107,107,0.2)" : "none",
                    animation: chatListening ? "micPulse 1.5s ease-in-out infinite" : "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    alignSelf: "center",
                  }}
                  title={lang === "en" ? "Voice input" : "语音输入"}
                >
                  {chatListening ? "🔴" : "🎤"}
                </button>
              )}
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder={t("mood.chatPlaceholder")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 16,
                  border: "1.5px solid " + C.frostDeep,
                  background: C.white,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: FONTS.body,
                  color: C.slate,
                }}
                onFocus={e => e.target.style.borderColor = C.iceDeep}
                onBlur={e => e.target.style.borderColor = C.frostDeep}
              />
              <button
                className="btn-press"
                onClick={sendChat}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  border: "none",
                  background: chatInput.trim() ? C.iceDeep : C.frostDeep,
                  color: "#fff",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >↑</button>
            </div>
          </div>
        </>
      )}

      {showSOS && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 155,
              background: "rgba(28,43,48,0.35)",
              backdropFilter: "blur(4px)",
              animation: "fadeUp 0.2s ease",
            }}
            onClick={closeSOS}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 430,
              height: "65vh",
              zIndex: 160,
              background: C.white,
              borderRadius: "24px 24px 0 0",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -8px 32px rgba(28,43,48,0.15)",
              animation: "fadeUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              padding: "18px 24px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: sosStep === step ? C.iceDeep : C.frostDeep,
                  }}
                />
              ))}
            </div>

            {sosStep === 1 && (
              <>
                <h3 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: C.slate, marginBottom: 8 }}>
                  {lang === "en" ? "It's okay. Take a breath first 🧊" : "没关系，先深呼吸 🧊"}
                </h3>
                <p style={{ fontSize: 14, color: C.slateLight, marginBottom: 16 }}>
                  {lang === "en" ? "Tell me - where are you stuck?" : "告诉我，你现在卡在哪里了？"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SOS_REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="btn-press"
                      onClick={() => {
                        setSOSReason(opt.id);
                        setSOSStep(2);
                      }}
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        borderRadius: 14,
                        border: `1.5px solid ${C.frostDeep}`,
                        background: C.frost,
                        color: C.slate,
                        fontSize: 13,
                        lineHeight: 1.45,
                        cursor: "pointer",
                      }}
                    >
                      {lang === "en" ? opt.labelEn : opt.labelZh}
                    </button>
                  ))}
                </div>
              </>
            )}

            {sosStep === 2 && (
              <>
                <h3 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: C.slate, marginBottom: 10 }}>
                  {lang === "en" ? "Okay. Just one thing." : "好。就做一件事。"}
                </h3>
                <div
                  style={{
                    background: C.frost,
                    border: `1.5px solid ${C.frostDeep}`,
                    borderRadius: 16,
                    padding: "14px 14px",
                    color: C.slate,
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 16,
                  }}
                >
                  {lang === "en" ? selectedSOS.actionEn : selectedSOS.actionZh}
                </div>
                <button
                  type="button"
                  className="btn-press"
                  onClick={() => setSOSStep(3)}
                  style={{
                    width: "100%",
                    marginTop: "auto",
                    padding: "14px",
                    borderRadius: 16,
                    border: "none",
                    background: `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {lang === "en" ? "✓ I'll do this one thing" : "✓ 我去做这一件事"}
                </button>
              </>
            )}

            {sosStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: 12, height: "100%" }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>🧊</div>
                <p style={{ fontSize: 18, fontWeight: 600, color: C.slate, marginBottom: 8 }}>
                  {lang === "en" ? "Good. You started. That's enough." : "好。你开始了，这就够了。"}
                </p>
                <p style={{ fontSize: 13, color: C.mist, marginBottom: 20 }}>
                  {lang === "en" ? "Come back and tell me how it went." : "做完回来，告诉我怎么样了。"}
                </p>
                <button
                  type="button"
                  className="btn-press"
                  onClick={closeSOS}
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    padding: "13px",
                    borderRadius: 14,
                    border: "none",
                    background: C.iceDeep,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {lang === "en" ? "Close" : "关闭"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 4 — 我
═══════════════════════════════════════════════════════ */
const WEEK_FOCUS = [3, 1, 4, 2, 5, 3, 0];

function getCompletedHistory() {
  try {
    const allDays = JSON.parse(localStorage.getItem("floe-all-days") || "{}");
    const tasks = JSON.parse(localStorage.getItem("floe-tasks") || "[]");
    const todayKey = new Date().toISOString().split("T")[0];
    const todayCompleted = tasks.filter((t) => t.done);
    return {
      ...allDays,
      [todayKey]: { ...(allDays[todayKey] || {}), completedTasks: todayCompleted },
    };
  } catch {
    return {};
  }
}

function BottomModal({ title, onClose, children }) {
  const { t } = useLanguage();
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(28,43,48,0.4)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 430, margin: "0 auto",
          background: C.white, borderRadius: "24px 24px 0 0",
          padding: "24px 24px 48px",
          animation: "fadeUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.frostDeep, margin: "0 auto 20px" }} />
        <h3 style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{title}</h3>
        {children}
        <button onClick={onClose} style={{
          width: "100%", marginTop: 20, padding: "13px", borderRadius: 16,
          border: "none", background: C.frostDeep, color: C.slateLight,
          fontSize: 14, cursor: "pointer", fontFamily: FONTS.body,
        }}>{t("me.close")}</button>
      </div>
    </div>
  );
}

function MePage({ lang: _lang, user, onSignOut }) {
  const { t, lang } = useLanguage();
  const maxFocus = Math.max(...WEEK_FOCUS);
  const [streak] = useState(5);
  const [activeModal, setActiveModal] = useState(null); // null | 'pomodoro' | 'adhd' | 'notify' | 'partner'
  const [expandedHistoryDate, setExpandedHistoryDate] = useState(null);
  const weekDayLabels = lang === "en" ? en.me.weekDays : zh.me.weekDays;
  const historyMap = getCompletedHistory();
  const todayKey = new Date().toISOString().split("T")[0];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const dayInfo = historyMap[key] || {};
    const completedTasks = dayInfo.completedTasks || [];
    return { key, date: d, dayInfo, completedTasks };
  });
  const streakMessage =
    streak >= 7
      ? lang === "en"
        ? "🔥 Over one week — amazing!"
        : "🔥 超过一周了，了不起！"
      : streak >= 3
        ? lang === "en"
          ? "✨ Keep it up, you got this!"
          : "✨ 保持住，你做到了！"
        : streak === 0
          ? lang === "en"
            ? "Finish one task today to start streak"
            : "今天完成一件事即可打卡"
          : lang === "en"
            ? "🌱 Great start!"
            : "🌱 好的开始！";
  const streakPlant = streak >= 14 ? "🌳" : streak >= 7 ? "🌲" : streak >= 3 ? "🌱" : streak > 0 ? "🌿" : "🪴";

  return (
    <div className="page-enter" style={{ padding: "28px 24px 100px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: C.mist }}>
          {lang === "en" ? "Me" : "我"}
        </p>
        <LanguageToggle />
      </div>
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.frostDeep}, ${C.ice})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
          border: `2px solid ${C.white}`, boxShadow: `0 0 0 3px ${C.frostDeep}`,
        }}>🧊</div>
        <div>
          <h2 style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600 }}>{t("me.hello")}</h2>
          <p style={{ fontSize: 13, color: C.mist, marginTop: 2 }}>{t("me.subtitle")}</p>
          <p style={{ fontSize: 12, color: C.mist, marginTop: 4 }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { n: "18", label: t("me.statPomodoro"), icon: "🍅" },
          { n: "24", label: t("me.statDone"), icon: "✅" },
        ].map(s => (
          <div key={s.label} style={{
            background: C.white, borderRadius: 16, padding: "14px 12px", textAlign: "center",
            border: `1.5px solid ${C.frostDeep}`,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <p style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: C.iceDeep, margin: "4px 0 2px" }}>
              {s.n}
            </p>
            <p style={{ fontSize: 11, color: C.mist }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{
        background: streak > 0 ? `linear-gradient(135deg, ${C.gold}22, ${C.gold}11)` : C.bg,
        border: `1.5px solid ${streak > 0 ? `${C.gold}44` : C.frostDeep}`,
        borderRadius: 18,
        padding: "16px 20px",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 11, color: C.mist, marginBottom: 4 }}>
            {lang === "en" ? "Streak" : "连续打卡"}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: FONTS.display, fontSize: 32, fontWeight: 700, color: C.gold }}>{streak}</span>
            <span style={{ fontSize: 14, color: C.slateLight }}>{lang === "en" ? "days" : "天"}</span>
          </div>
          <p style={{ fontSize: 12, color: C.mist, marginTop: 4 }}>{streakMessage}</p>
        </div>
        <div style={{ fontSize: streak > 0 ? 44 : 32 }}>{streakPlant}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 18 }}>
        {last7Days.slice().reverse().map((day) => {
          const isToday = day.key === todayKey;
          const completed = day.completedTasks.length > 0;
          return (
            <div key={day.key} style={{ textAlign: "center" }}>
              <div style={{
                width: 20,
                height: 20,
                margin: "0 auto 4px",
                borderRadius: "50%",
                border: completed ? "none" : `1.5px solid ${isToday ? C.iceDeep : C.frostDeep}`,
                background: completed ? C.gold : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: completed ? "#fff" : C.mist,
                fontSize: 10,
                fontWeight: 700,
              }}>
                {completed ? "✓" : ""}
              </div>
              <span style={{ fontSize: 10, color: C.mist }}>
                {day.date.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", { weekday: "narrow" })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Focus chart */}
      <div style={{
        background: C.white, borderRadius: 18, padding: "18px",
        border: `1.5px solid ${C.frostDeep}`, marginBottom: 14,
      }}>
        <p style={{ fontSize: 12, color: C.mist, fontWeight: 500, letterSpacing: "0.04em", marginBottom: 14 }}>
          {t("me.weekFocus")}
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 72 }}>
          {WEEK_FOCUS.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: "100%",
                height: maxFocus ? `${(v / maxFocus) * 56}px` : "4px",
                minHeight: 4,
                borderRadius: "6px 6px 3px 3px",
                background: v === maxFocus
                  ? `linear-gradient(180deg, ${C.iceDeep}, ${C.ice})`
                  : `linear-gradient(180deg, ${C.frostDeep}, ${C.frostDeep})`,
                transition: "height 0.7s cubic-bezier(0.34,1.56,0.64,1)",
              }} />
              <span style={{ fontSize: 10, color: v === maxFocus ? C.iceDeep : C.mist, fontWeight: v === maxFocus ? 600 : 400 }}>
                {weekDayLabels[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: C.white,
        borderRadius: 18,
        padding: "16px",
        border: `1.5px solid ${C.frostDeep}`,
        marginBottom: 14,
      }}>
        <p style={{ fontSize: 12, color: C.mist, fontWeight: 500, letterSpacing: "0.04em", marginBottom: 12 }}>
          {lang === "en" ? "Last 7 days" : "最近7天"}
        </p>
        {last7Days.map((day) => {
          const hasDone = day.completedTasks.length > 0;
          const isToday = day.key === todayKey;
          const isExpanded = expandedHistoryDate === day.key;
          return (
            <div key={day.key} style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="btn-press"
                onClick={() => setExpandedHistoryDate((prev) => (prev === day.key ? null : day.key))}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: isToday ? C.frost : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  color: hasDone ? C.slate : C.mist,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>
                    {day.date.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", { month: "numeric", day: "numeric" })}
                  </span>
                  {hasDone && day.dayInfo?.mood?.emoji && (
                    <span style={{ fontSize: 14 }}>{day.dayInfo.mood.emoji}</span>
                  )}
                </div>
                <span style={{ fontSize: 12 }}>
                  {lang === "en" ? `Done ${day.completedTasks.length}` : `完成 ${day.completedTasks.length} 件`}
                </span>
              </button>
              {isExpanded && day.completedTasks.length > 0 && (
                <div style={{ padding: "8px 12px 2px", color: C.slateLight }}>
                  {day.completedTasks.map((task) => (
                    <p key={task.id} style={{ fontSize: 12, lineHeight: 1.6 }}>
                      • {task.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Insight */}
      <div style={{
        background: `linear-gradient(135deg, ${C.frost}, ${C.frostDeep}88)`,
        borderRadius: 18, padding: "18px",
        border: `1.5px solid ${C.ice}55`, marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🧊</span>
          <div>
            <p style={{ fontSize: 12, color: C.iceDeep, fontWeight: 600, marginBottom: 6 }}>{t("me.insightTitle")}</p>
            <p style={{ fontSize: 13, color: C.slateLight, lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {t("me.insightBody")}
            </p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div style={{ background: C.white, borderRadius: 18, border: `1.5px solid ${C.frostDeep}`, overflow: "hidden" }}>
        {[
          { icon: "⏱", label: t("me.settingsPomodoro"), value: t("me.settingsPomodoroVal"), modal: "pomodoro" },
          { icon: "⚡", label: t("me.settingsAdhd"), value: t("me.settingsAdhdVal"), modal: "adhd" },
          { icon: "🔔", label: t("me.settingsNotify"), value: t("me.settingsNotifyVal"), modal: "notify" },
          { icon: "👥", label: t("me.settingsPartner"), value: t("me.settingsPartnerVal"), modal: "partner" },
        ].map((item, i, arr) => (
          <button
            key={item.label}
            className="btn-press"
            onClick={() => setActiveModal(item.modal)}
            style={{
              width: "100%", padding: "15px 18px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.frostDeep}` : "none",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 14, color: C.slate }}>{item.label}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.mist }}>{item.value}</span>
              <span style={{ color: C.mist, fontSize: 14 }}>›</span>
            </div>
          </button>
        ))}
        <button
          onClick={onSignOut}
          style={{
            width: "100%", marginTop: 8, padding: "15px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "none", border: "none", cursor: "pointer",
            borderTop: "1px solid " + C.frostDeep,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>👋</span>
            <span style={{ fontSize: 14, color: C.mist }}>退出登录 Sign out</span>
          </div>
        </button>
      </div>

      {activeModal === "pomodoro" && (
        <BottomModal title={t("me.modalPomodoroTitle")} onClose={() => setActiveModal(null)}>
          {[
            { label: t("me.modalFocusLen"), key: "focus", default: 25 },
            { label: t("me.modalShortLen"), key: "short", default: 5 },
            { label: t("me.modalLongLen"), key: "long", default: 15 },
          ].map(item => (
            <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: C.slate }}>{item.label}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {[5, 10, 15, 20, 25, 30, 45, 60].map(m => (
                  <button key={m} style={{
                    width: 36, height: 36, borderRadius: 10, border: "none",
                    background: m === item.default ? C.iceDeep : C.frostDeep,
                    color: m === item.default ? "#fff" : C.slateLight,
                    fontSize: 12, cursor: "pointer",
                  }}>{m}</button>
                ))}
              </div>
            </div>
          ))}
        </BottomModal>
      )}

      {activeModal === "adhd" && (
        <BottomModal title={t("me.modalAdhdTitle")} onClose={() => setActiveModal(null)}>
          <p style={{ fontSize: 14, color: C.slateLight, lineHeight: 1.7, marginBottom: 16 }}>
            {t("me.modalAdhdDesc")}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.frost, borderRadius: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{t("me.modalAdhdToggle")}</span>
            <div style={{
              width: 48, height: 28, borderRadius: 14,
              background: C.iceDeep, cursor: "pointer",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: 4, right: 4,
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
              }} />
            </div>
          </div>
        </BottomModal>
      )}

      {activeModal === "notify" && (
        <BottomModal title={t("me.modalNotifyTitle")} onClose={() => setActiveModal(null)}>
          {[
            { label: t("me.notifyPomodoro"), on: true },
            { label: t("me.notifyEvening"), on: true },
            { label: t("me.notifyMorning"), on: false },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 14px", background: C.frost, borderRadius: 14 }}>
              <span style={{ fontSize: 14, color: C.slate }}>{item.label}</span>
              <div style={{
                width: 44, height: 26, borderRadius: 13, cursor: "pointer",
                background: item.on ? C.iceDeep : C.frostDeep, position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 3,
                  left: item.on ? "auto" : 3, right: item.on ? 3 : "auto",
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  transition: "all 0.2s",
                }} />
              </div>
            </div>
          ))}
        </BottomModal>
      )}

      {activeModal === "partner" && (
        <BottomModal title={t("me.modalPartnerTitle")} onClose={() => setActiveModal(null)}>
          <p style={{ fontSize: 14, color: C.slateLight, lineHeight: 1.7, marginBottom: 20 }}>
            {t("me.modalPartnerDesc")}
          </p>
          <input placeholder={t("me.partnerPlaceholder")} style={{
            width: "100%", padding: "13px 16px", borderRadius: 14,
            border: "1.5px solid " + C.frostDeep, background: C.white,
            fontSize: 14, outline: "none", marginBottom: 12,
            fontFamily: FONTS.body, color: C.slate,
          }} />
          <button style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "none",
            background: C.iceDeep, color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: FONTS.body,
          }}>{t("me.partnerSend")}</button>
        </BottomModal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════ */
const TAB_DEFS = [
  { id: "now",    icon: "☀️" },
  { id: "focus",  icon: "⏱" },
  { id: "mood",   icon: "🌿" },
  { id: "me",     icon: "✦"  },
];

function BottomNav({ active, setActive }) {
  const { t } = useLanguage();
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430,
      background: "rgba(244,241,236,0.88)", backdropFilter: "blur(16px)",
      borderTop: `1px solid ${C.frostDeep}`,
      display: "flex", zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom, 8px)",
    }}>
      {TAB_DEFS.map(tab => (
        <button
          key={tab.id}
          onClick={() => {
            setActive(tab.id);
            posthog.capture("tab_switched", { tab: tab.id });
          }}
          style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, padding: "10px 0 6px", transition: "all 0.2s",
          }}
        >
          <span style={{
            fontSize: active === tab.id ? 22 : 20,
            transition: "font-size 0.2s, transform 0.2s",
            transform: active === tab.id ? "translateY(-2px)" : "none",
            display: "inline-block",
          }}>
            {tab.icon}
          </span>
          <span style={{
            fontSize: 11, fontWeight: active === tab.id ? 600 : 400,
            color: active === tab.id ? C.iceDeep : C.mist,
            letterSpacing: "0.01em", transition: "color 0.2s",
          }}>
            {t(`nav.${tab.id}`)}
          </span>
          {active === tab.id && (
            <div style={{
              position: "absolute", bottom: "env(safe-area-inset-bottom, 8px)",
              width: 4, height: 4, borderRadius: "50%",
              background: C.iceDeep, animation: "popIn 0.2s ease",
            }} />
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState("now");
  const { lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { paywallOpen, setPaywallOpen, trialDaysLeft, isTrialExpired } =
    useFloeSubscription();

  useEffect(() => {
    const syncPosthogIdentity = (session) => {
      if (session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          created_at: session.user.created_at,
        });
      } else {
        posthog.reset();
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      syncPosthogIdentity(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        syncPosthogIdentity(session);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <>
        <Styles />
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          background: "#F4F1EC",
        }}>
          <span style={{ fontSize: 52, animation: "floatIce 2s ease-in-out infinite" }}>
            🧊
          </span>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Styles />
        <AuthScreen onAuthSuccess={(u) => setUser(u)} />
      </>
    );
  }

  const pages = { now: NowPage, focus: FocusPage, mood: MoodPage, me: MePage };
  const Page  = pages[tab] || NowPage;

  return (
    <>
      {paywallOpen && (
        <Paywall
          onClose={() => setPaywallOpen(false)}
          daysLeft={trialDaysLeft()}
          isExpired={isTrialExpired()}
        />
      )}
      <Styles />
      <div style={{
        maxWidth: 430, margin: "0 auto", minHeight: "100dvh",
        background: C.bg, position: "relative",
        // Ambient frost blob
        overflow: "hidden",
      }}>
        {/* Ambient blobs */}
        <div style={{
          position: "fixed", top: -60, right: -60, width: 220, height: 220,
          borderRadius: "50%", pointerEvents: "none", zIndex: 0,
          background: `radial-gradient(circle, ${C.frostDeep}80, transparent 70%)`,
        }} />
        <div style={{
          position: "fixed", bottom: 100, left: -80, width: 260, height: 260,
          borderRadius: "50%", pointerEvents: "none", zIndex: 0,
          background: `radial-gradient(circle, ${C.ice}30, transparent 70%)`,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <Page
            key={tab}
            setTab={setTab}
            lang={lang}
            user={user}
            onSignOut={() => supabase.auth.signOut()}
          />
        </div>

        <BottomNav active={tab} setActive={setTab} />
      </div>
    </>
  );
}
