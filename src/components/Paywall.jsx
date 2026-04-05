import { useState } from "react";

const C = {
  bg: "#F4F1EC",
  frost: "#EAF4F7",
  frostDeep: "#D0E8F0",
  ice: "#A8D4E2",
  iceDeep: "#5BA8BC",
  slate: "#1C2B30",
  slateLight: "#4A6670",
  mist: "#8DAAB3",
  white: "#FDFCFA",
  sage: "#6B9E85",
};

const FONTS = {
  display:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
  body:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
};

const PLANS = [
  { id: "monthly", label: "月订阅", price: "$3.99", sub: "随时取消" },
];

export default function Paywall({ onClose, daysLeft, isExpired }) {
  const [selected] = useState("monthly");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    setTimeout(() => {
      alert("支付功能即将上线！目前仍在内测期间，感谢你的支持 🧊");
      setLoading(false);
    }, 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(28,43,48,0.5)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          background: C.white,
          borderRadius: "28px 28px 0 0",
          padding: "28px 24px 48px",
          animation: "fadeUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: C.frostDeep,
            margin: "0 auto 24px",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 52,
              marginBottom: 12,
              animation: "floatIce 3s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            🧊
          </div>
          <h2
            style={{
              fontFamily: FONTS.display,
              fontSize: 22,
              fontWeight: 700,
              color: C.slate,
              marginBottom: 8,
            }}
          >
            {isExpired ? "试用已结束" : `还有 ${daysLeft} 天试用`}
          </h2>
          <p style={{ fontSize: 14, color: C.slateLight, lineHeight: 1.6 }}>
            {isExpired
              ? "订阅 Floe，继续和 AI 一起记录、成长。"
              : "订阅后继续享受 AI 陪伴日记、CBT 对话和日记生成。"}
          </p>
        </div>

        <div
          style={{
            background: C.frost,
            borderRadius: 16,
            padding: "16px",
            marginBottom: 20,
          }}
        >
          {[
            ["🧊", "和 Floe 无限 AI 对话"],
            ["✨", "一键整理今日日记"],
            ["📅", "永久日历历史记录"],
            ["🆓", "任务/番茄/手写日记永久免费"],
          ].map(([icon, text]) => (
            <div
              key={text}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 14, color: C.slateLight }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              style={{
                flex: 1,
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 16,
                border:
                  selected === plan.id
                    ? `2px solid ${C.iceDeep}`
                    : `1.5px solid ${C.frostDeep}`,
                background: selected === plan.id ? `${C.ice}22` : C.white,
                cursor: "pointer",
                fontFamily: FONTS.body,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.slate,
                  marginBottom: 4,
                }}
              >
                {plan.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: C.iceDeep,
                  marginBottom: 2,
                }}
              >
                {plan.price}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.mist,
                    marginLeft: 4,
                  }}
                >
                  /月
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.sage }}>{plan.sub}</div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-press"
          disabled={loading}
          onClick={handleSubscribe}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 16,
            border: "none",
            background: `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            fontFamily: FONTS.body,
            marginBottom: 12,
            boxShadow: `0 8px 24px ${C.iceDeep}44`,
          }}
        >
          {loading ? "…" : `订阅 ${PLANS[0].price}/月`}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            background: "transparent",
            color: C.mist,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: FONTS.body,
          }}
        >
          {isExpired ? "稍后再说" : "稍后再订阅"}
        </button>
      </div>
    </div>
  );
}
