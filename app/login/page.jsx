"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";


export default function Login() {
  const { dark } = useTheme();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail || !loginPassword) { setLoginError("Please fill in all fields."); return; }
    setLoginLoading(true);
    try {
      const res = await signIn("credentials", { email: loginEmail, password: loginPassword });
      if (res.status !== 200) throw new Error("Login failed");
      console.log("Login successful, session:", res);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

useEffect(() => {
  if (status === "loading") return; // wait for session

  if (session?.user && status === "authenticated") {
    if (session.user.role === "admin") {
      console.log("Admin logged in, redirecting to admin dashboard...");
      router.push("/admin");
    } else {
      console.log("User logged in, redirecting to homepage...");
      router.push("/");
    }
  }
}, [session, status, router]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm) { setSignupError("Please fill in all fields."); return; }
    if (signupPassword !== signupConfirm) { setSignupError("Passwords do not match."); return; }
    if (signupPassword.length < 6) { setSignupError("Password must be at least 6 characters."); return; }
    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      setSignupSuccess(true);
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const pwStrength = (pw) => {
    if (!pw) return 0;
    if (pw.length < 6) return 1;
    if (pw.length < 10) return 2;
    return 3;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg:          #07080f;
          --bg2:         #0d0e18;
          --glass:       rgba(255,255,255,0.045);
          --glass-bdr:   rgba(255,255,255,0.10);
          --glass-shine: rgba(255,255,255,0.06);
          --heading:     #f0f0ff;
          --body:        rgba(240,240,255,0.65);
          --muted:       rgba(240,240,255,0.35);
          --dot:         rgba(255,255,255,0.028);
          --input-bg:    rgba(255,255,255,0.055);
          --input-bdr:   rgba(255,255,255,0.1);
          --input-clr:   #f0f0ff;
          --input-ph:    rgba(240,240,255,0.25);
          --card-glow:   rgba(7,166,38,0.12);
          --tab-active:  rgba(7,166,38,0.08);
        }
        [data-theme="light"] {
          --bg:          #eef0f7;
          --bg2:         #e8eaf3;
          --glass:       rgba(255,255,255,0.65);
          --glass-bdr:   rgba(255,255,255,0.9);
          --glass-shine: rgba(255,255,255,0.8);
          --heading:     #0c0c1a;
          --body:        rgba(12,12,26,0.65);
          --muted:       rgba(12,12,26,0.38);
          --dot:         rgba(0,0,0,0.03);
          --input-bg:    rgba(255,255,255,0.75);
          --input-bdr:   rgba(0,0,0,0.10);
          --input-clr:   #0c0c1a;
          --input-ph:    rgba(12,12,26,0.28);
          --card-glow:   rgba(7,166,38,0.08);
          --tab-active:  rgba(7,166,38,0.06);
        }

        .auth-page {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', sans-serif;
          display: flex; flex-direction: column;
          transition: background 0.4s;
          position: relative; overflow: hidden;
        }

        /* ── Background ── */
        .auth-bg-mesh {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* Animated gradient orbs */
        .orb {
          position: fixed; border-radius: 50%;
          pointer-events: none; z-index: 0;
          filter: blur(1px);
        }
        .orb-1 {
          width: 520px; height: 520px;
          top: -180px; left: 50%;
          transform: translateX(-50%);
          background: radial-gradient(ellipse, rgba(7,166,38,0.18) 0%, transparent 65%);
          animation: orb-float 8s ease-in-out infinite;
        }
        .orb-2 {
          width: 380px; height: 380px;
          bottom: -120px; right: -80px;
          background: radial-gradient(ellipse, rgba(7,166,38,0.10) 0%, transparent 65%);
          animation: orb-float 11s ease-in-out infinite reverse;
        }
        .orb-3 {
          width: 260px; height: 260px;
          top: 40%; left: -60px;
          background: radial-gradient(ellipse, rgba(7,166,38,0.07) 0%, transparent 65%);
          animation: orb-float 13s ease-in-out infinite 2s;
        }
        [data-theme="light"] .orb-1 { background: radial-gradient(ellipse, rgba(7,166,38,0.10) 0%, transparent 65%); }
        [data-theme="light"] .orb-2 { background: radial-gradient(ellipse, rgba(7,166,38,0.06) 0%, transparent 65%); }
        [data-theme="light"] .orb-3 { display: none; }

        @keyframes orb-float {
          0%,100% { transform: translateX(-50%) translateY(0) scale(1); }
          33%      { transform: translateX(-50%) translateY(-18px) scale(1.04); }
          66%      { transform: translateX(-50%) translateY(10px) scale(0.97); }
        }

        /* ── Layout ── */
        .auth-center {
          position: relative; z-index: 1;
          flex: 1; display: flex;
          align-items: center; justify-content: center;
          padding: 100px 20px 60px;
        }

        /* ── Glass card ── */
        .auth-card {
          width: 100%; max-width: 400px;
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          /* Layered glass effect */
          background: var(--glass);
          border: 1px solid var(--glass-bdr);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 32px 80px rgba(0,0,0,0.28),
            0 0 60px var(--card-glow);
        }
        [data-theme="light"] .auth-card {
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.7) inset,
            0 20px 60px rgba(0,0,0,0.10),
            0 0 40px var(--card-glow);
        }

        /* Top shimmer line */
        .auth-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
          background: linear-gradient(90deg, transparent 0%, rgba(7,166,38,0.6) 30%, #4ade80 50%, rgba(7,166,38,0.6) 70%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3.5s linear infinite;
          z-index: 2;
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }

        /* Inner shine overlay */
        .auth-card::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(180deg, var(--glass-shine) 0%, transparent 100%);
          pointer-events: none; border-radius: 24px 24px 0 0;
          z-index: 1;
        }

        /* ── Logo / Header ── */
        .auth-header {
          position: relative; z-index: 3;
          padding: 28px 28px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          border-bottom: 1px solid var(--glass-bdr);
          text-align: center;
        }
        .auth-logo-wrap {
          margin-bottom: 6px;
        }
        .auth-title {
          font-size: 18px; font-weight: 800;
          color: var(--heading); letter-spacing: -0.4px;
        }
        .auth-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--muted); line-height: 1.5;
          max-width: 260px;
        }

        /* ── Tabs ── */
        .auth-tabs {
          position: relative; z-index: 3;
          display: grid; grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid var(--glass-bdr);
        }
        .auth-tab {
          padding: 13px 0;
          background: none; border: none;
          font-family: 'Sora', sans-serif;
          font-size: 12.5px; font-weight: 700;
          color: var(--muted); cursor: pointer;
          transition: color 0.2s, background 0.2s;
          position: relative;
          letter-spacing: 0.1px;
        }
        .auth-tab::after {
          content: '';
          position: absolute; bottom: -1px; left: 18%; right: 18%;
          height: 2px;
          background: linear-gradient(90deg, #07A626, #4ade80);
          border-radius: 2px;
          transform: scaleX(0); transform-origin: center;
          transition: transform 0.3s cubic-bezier(.22,1,.36,1);
        }
        .auth-tab.active { color: var(--heading); background: var(--tab-active); }
        .auth-tab.active::after { transform: scaleX(1); }

        /* ── Form body ── */
        .auth-body {
          position: relative; z-index: 3;
          padding: 22px 24px 24px;
          display: flex; flex-direction: column; gap: 0;
        }

        .input-group { margin-bottom: 13px; }
        .input-label {
          display: block;
          font-size: 10.5px; font-weight: 700;
          color: var(--muted); text-transform: uppercase;
          letter-spacing: 0.6px; margin-bottom: 5px;
        }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon {
          position: absolute; left: 11px;
          color: var(--muted); pointer-events: none;
        }
        .auth-input {
          width: 100%;
          padding: 10px 13px 10px 36px;
          background: var(--input-bg);
          border: 1px solid var(--input-bdr);
          border-radius: 11px;
          font-family: 'Sora', sans-serif;
          font-size: 12.5px; font-weight: 500;
          color: var(--input-clr); outline: none;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          caret-color: #07A626;
        }
        .auth-input::placeholder { color: var(--input-ph); }
        .auth-input:focus {
          border-color: rgba(7,166,38,0.6);
          box-shadow: 0 0 0 3px rgba(7,166,38,0.10), 0 0 0 1px rgba(7,166,38,0.3) inset;
          background: rgba(255,255,255,0.07);
        }
        [data-theme="light"] .auth-input:focus { background: rgba(255,255,255,0.9); }

        .pw-toggle {
          position: absolute; right: 10px;
          background: none; border: none; cursor: pointer;
          color: var(--muted); display: flex; align-items: center;
          padding: 3px; transition: color 0.2s;
        }
        .pw-toggle:hover { color: var(--body); }

        /* Strength bar */
        .pw-strength { display: flex; gap: 4px; margin-top: 6px; }
        .pw-bar { height: 2.5px; flex: 1; border-radius: 2px; background: var(--input-bdr); transition: background 0.3s; }
        .pw-bar.weak   { background: #ef4444; }
        .pw-bar.medium { background: #f59e0b; }
        .pw-bar.strong { background: #07A626; }

        /* Error */
        .auth-error {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.20);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: #f87171;
          margin-bottom: 14px;
          backdrop-filter: blur(6px);
          animation: slide-in .2s cubic-bezier(.22,1,.36,1);
        }
        @keyframes slide-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }

        /* Terms */
        .terms-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; margin-top: 2px; }
        .terms-check { width: 14px; height: 14px; margin-top: 1px; flex-shrink: 0; accent-color: #07A626; cursor: pointer; }
        .terms-text { font-size: 11px; color: var(--muted); font-family: 'DM Sans', sans-serif; line-height: 1.5; }
        .terms-text a { color: #07A626; text-decoration: none; font-weight: 600; }
        .terms-text a:hover { text-decoration: underline; }

        /* Submit button */
        .auth-btn {
          width: 100%; padding: 11.5px;
          border: none; border-radius: 11px; cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          background: linear-gradient(135deg, #07A626 0%, #059c1f 50%, #07b82b 100%);
          background-size: 200% 100%;
          color: #fff;
          box-shadow: 0 4px 20px rgba(7,166,38,0.40), 0 1px 0 rgba(255,255,255,0.15) inset;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s, background-position 0.4s;
          letter-spacing: 0.1px;
        }
        .auth-btn:hover:not(:disabled) {
          opacity: 0.92; transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(7,166,38,0.50), 0 1px 0 rgba(255,255,255,0.15) inset;
          background-position: 100% 0;
        }
        .auth-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Footer */
        .auth-footer {
          position: relative; z-index: 3;
          text-align: center;
          padding: 0 24px 22px;
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: var(--muted);
        }
        .auth-footer a { color: #07A626; font-weight: 700; text-decoration: none; }
        .auth-footer a:hover { text-decoration: underline; }

        /* Success */
        .signup-success {
          position: relative; z-index: 3;
          padding: 32px 24px;
          display: flex; flex-direction: column;
          align-items: center; gap: 12px; text-align: center;
        }
        .success-ring {
          width: 58px; height: 58px;
          border-radius: 50%;
          background: rgba(7,166,38,0.10);
          border: 1.5px solid rgba(7,166,38,0.3);
          display: flex; align-items: center; justify-content: center;
          color: #07A626;
          box-shadow: 0 0 24px rgba(7,166,38,0.25);
          animation: pop .45s cubic-bezier(.22,1,.36,1);
        }
        @keyframes pop { from { transform:scale(0.5); opacity:0; } to { transform:scale(1); opacity:1; } }
        .success-title { font-size: 17px; font-weight: 800; color: var(--heading); letter-spacing: -0.3px; }
        .success-sub { font-size: 12.5px; color: var(--muted); font-family: 'DM Sans', sans-serif; line-height: 1.6; max-width: 270px; }

        /* Card entrance */
        .anim { opacity:0; transform:translateY(20px);
          transition: opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1); }
        .ready .anim { opacity:1; transform:translateY(0); }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 460px) {
          .auth-center { padding: 80px 14px 48px; }
          .auth-header { padding: 22px 18px 16px; }
          .auth-body { padding: 18px 18px 20px; }
          .auth-footer { padding: 0 18px 18px; }
        }
      `}</style>

      <div className="auth-page" data-theme={dark ? "dark" : "light"}>
        <div className="auth-bg-mesh" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <Navbar />

        <div className={`auth-center${ready ? " ready" : ""}`}>
          <div className="auth-card anim">

            {/* ── Header ── */}
            <div className="auth-header">
              <div className="auth-logo-wrap">
                {dark
                  ? <img src="/cdrlogo-dark.svg" alt="Logo" width={160} height={48} />
                  : <img src="/cdrlogo-light.svg" alt="Logo" width={160} height={48} />
                }
              </div>
              <div className="auth-title">
                {tab === "login" ? "Welcome back" : "Create account"}
              </div>
              <div className="auth-subtitle">
                {tab === "login"
                  ? "Sign in to download logos & save your favourites"
                  : "Join cdrlogo — free access to thousands of vector logos"}
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="auth-tabs">
              <button
                className={`auth-tab${tab === "login" ? " active" : ""}`}
                onClick={() => { setTab("login"); setLoginError(""); setSignupError(""); }}
              >Sign In</button>
              <button
                className={`auth-tab${tab === "signup" ? " active" : ""}`}
                onClick={() => { setTab("signup"); setLoginError(""); setSignupError(""); }}
              >Sign Up</button>
            </div>

            {/* ── LOGIN ── */}
            {tab === "login" && (
              <div className="auth-body">
                {loginError && (
                  <div className="auth-error">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {loginError}
                  </div>
                )}
                <form onSubmit={handleLogin}>
                  <div className="input-group">
                    <label className="input-label" htmlFor="l-email">Email Address</label>
                    <div className="input-wrap">
                      <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      <input id="l-email" className="auth-input" type="email" placeholder="you@example.com"
                        value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="l-password">Password</label>
                    <div className="input-wrap">
                      <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <input id="l-password" className="auth-input" type={showLoginPw ? "text" : "password"}
                        placeholder="Enter your password" value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password"
                        style={{ paddingRight: 36 }} />
                      <button type="button" className="pw-toggle" onClick={() => setShowLoginPw(v => !v)}>
                        {showLoginPw
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="auth-btn" disabled={loginLoading}>
                    {loginLoading
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Signing In…</>
                      : <>Sign In <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                    }
                  </button>
                </form>
              </div>
            )}

            {/* ── SIGNUP ── */}
            {tab === "signup" && (
              signupSuccess ? (
                <div className="signup-success">
                  <div className="success-ring">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="success-title">Account Created!</div>
                  <div className="success-sub">Welcome to cdrlogo. Check your email to verify your account, then sign in.</div>
                  <button className="auth-btn" style={{ marginTop: 8 }} onClick={() => { setTab("login"); setSignupSuccess(false); }}>
                    Go to Sign In →
                  </button>
                </div>
              ) : (
                <div className="auth-body">
                  {signupError && (
                    <div className="auth-error">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {signupError}
                    </div>
                  )}
                  <form onSubmit={handleSignup}>
                    <div className="input-group">
                      <label className="input-label" htmlFor="s-name">Full Name</label>
                      <div className="input-wrap">
                        <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <input id="s-name" className="auth-input" type="text" placeholder="Your full name"
                          value={signupName} onChange={e => setSignupName(e.target.value)} autoComplete="name" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="s-email">Email Address</label>
                      <div className="input-wrap">
                        <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <input id="s-email" className="auth-input" type="email" placeholder="you@example.com"
                          value={signupEmail} onChange={e => setSignupEmail(e.target.value)} autoComplete="email" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="s-password">Password</label>
                      <div className="input-wrap">
                        <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <input id="s-password" className="auth-input" type={showSignupPw ? "text" : "password"}
                          placeholder="Min. 6 characters" value={signupPassword}
                          onChange={e => setSignupPassword(e.target.value)} autoComplete="new-password"
                          style={{ paddingRight: 36 }} />
                        <button type="button" className="pw-toggle" onClick={() => setShowSignupPw(v => !v)}>
                          {showSignupPw
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                      {signupPassword && (
                        <div className="pw-strength">
                          {[0,1,2,3].map(i => {
                            const s = pwStrength(signupPassword);
                            const cls = i < s ? (s === 1 ? "weak" : s === 2 ? "medium" : "strong") : "";
                            return <div key={i} className={`pw-bar ${cls}`} />;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="s-confirm">Confirm Password</label>
                      <div className="input-wrap">
                        <svg className="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <input id="s-confirm" className="auth-input" type={showConfirmPw ? "text" : "password"}
                          placeholder="Repeat your password" value={signupConfirm}
                          onChange={e => setSignupConfirm(e.target.value)} autoComplete="new-password"
                          style={{ paddingRight: 36 }} />
                        <button type="button" className="pw-toggle" onClick={() => setShowConfirmPw(v => !v)}>
                          {showConfirmPw
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                    </div>
                    <div className="terms-row">
                      <input type="checkbox" className="terms-check" id="terms" required />
                      <label htmlFor="terms" className="terms-text">
                        I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
                      </label>
                    </div>
                    <button type="submit" className="auth-btn" disabled={signupLoading}>
                      {signupLoading
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Creating Account…</>
                        : <>Create Account <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                      }
                    </button>
                  </form>
                </div>
              )
            )}

            {/* ── Footer switch ── */}
            {!signupSuccess && (
              <div className="auth-footer">
                {tab === "login"
                  ? <>Don't have an account? <a href="#" onClick={e => { e.preventDefault(); setTab("signup"); }}>Sign up free</a></>
                  : <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setTab("login"); }}>Sign in</a></>
                }
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}