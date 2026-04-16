import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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
  terra: "#C86A3A",
  sage: "#6B9E85",
};

const FONTS = {
  display: "'Sora', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
};

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const submitLabel = useMemo(() => {
    if (loading) return "处理中... / Processing...";
    return mode === "login" ? "登录 Sign in" : "创建账户 Create account";
  }, [loading, mode]);

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: `1.5px solid ${C.frostDeep}`,
    background: C.white,
    fontSize: 14,
    outline: "none",
    color: C.slate,
    fontFamily: FONTS.body,
  };

  const onSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("密码至少 8 位 / Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码不一致 / Passwords do not match");
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSuccess("验证邮件已发送，请查收 ✓");
  };

  const onSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onAuthSuccess?.(data.user);
  };

  const onResetPassword = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail || email,
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSuccess("重置链接已发送，请查收邮件 ✓");
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        padding: "36px 24px",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
        fontFamily: FONTS.body,
      }}
    >
      <div
        style={{
          position: "fixed",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(circle, ${C.frostDeep}80, transparent 70%)`,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 58, animation: "floatIce 3s ease-in-out infinite" }}>
            🧊
          </div>
          <h1
            style={{
              fontFamily: FONTS.display,
              color: C.iceDeep,
              fontSize: 34,
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            Floe
          </h1>
          <p
            style={{
              color: C.mist,
              fontStyle: "italic",
              marginTop: 6,
            }}
          >
            漂流，但有方向。
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.frost,
            border: `1.5px solid ${C.frostDeep}`,
            borderRadius: 14,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {[
            { id: "login", label: "登录 Login" },
            { id: "signup", label: "注册 Sign up" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setError("");
                setSuccess("");
                setShowForgot(false);
              }}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 10,
                padding: "10px 8px",
                background: mode === m.id ? C.white : "transparent",
                color: mode === m.id ? C.slate : C.mist,
                fontWeight: mode === m.id ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={mode === "login" ? onSignIn : onSignUp}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = C.iceDeep;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = C.frostDeep;
              }}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = C.iceDeep;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = C.frostDeep;
              }}
              required
            />
            {mode === "signup" && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = C.iceDeep;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = C.frostDeep;
                }}
                required
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "14px",
              borderRadius: 16,
              border: "none",
              background: loading
                ? C.frostDeep
                : `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
              color: loading ? C.mist : "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {submitLabel}
          </button>
        </form>

        {mode === "login" && (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowForgot((s) => !s)}
              style={{
                background: "none",
                border: "none",
                color: C.iceDeep,
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
              }}
            >
              忘记密码？
            </button>
            {showForgot && (
              <div
                style={{
                  marginTop: 10,
                  background: C.frost,
                  border: `1.5px solid ${C.frostDeep}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={onResetPassword}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "12px",
                    borderRadius: 14,
                    border: "none",
                    background: loading
                      ? C.frostDeep
                      : `linear-gradient(135deg, ${C.iceDeep}, ${C.ice})`,
                    color: loading ? C.mist : "#fff",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  发送重置链接 Send reset link
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12, minHeight: 22 }}>
          {error ? (
            <p style={{ fontSize: 13, color: C.terra }}>{error}</p>
          ) : null}
          {success ? (
            <p style={{ fontSize: 13, color: C.sage }}>{success}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
