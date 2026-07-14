import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  isWebAuthnSupported,
  prepareAuthenticationOptions,
  formatAuthenticationCredential
} from "../utils/webauthn";

export default function LoginPage() {
  const { login, loginPasskey } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError("");
    setLoading(true);

    if (!isWebAuthnSupported()) {
      setError("Passkeys/WebAuthn are not supported on this browser or device.");
      setLoading(false);
      return;
    }

    try {
      // 1. Get authentication challenge options from backend
      const optionsRes = await api.post("/api/auth/login-passkey/options");
      const options = optionsRes.data;

      // 2. Coerce challenge base64url string to ArrayBuffer
      const preparedOptions = prepareAuthenticationOptions(options);

      // 3. Prompt user for biometrics via the browser credential manager
      const credential = await navigator.credentials.get({
        publicKey: preparedOptions,
      });

      if (!credential) {
        throw new Error("No credential returned from device.");
      }

      // 4. Format credential result back to base64url structures
      const formatted = formatAuthenticationCredential(credential);

      // 5. Verify credential assertion on backend
      const verifyRes = await api.post("/api/auth/login-passkey/verify", {
        credential: formatted,
        challenge: options.challenge,
      });

      // 6. Complete login in React context using JWT token returned
      const { access_token, user } = verifyRes.data;
      await loginPasskey(access_token, user);
    } catch (err) {
      console.error(err);
      let errMsg = err.response?.data?.error || err.message || "Passkey sign in failed.";
      const rawErr = ((err.message || "") + " " + (err.name || "") + " " + String(err)).toLowerCase();
      if (
        err.name === "NotAllowedError" ||
        err.name === "AbortError" ||
        rawErr.includes("privacy-considerations-client") ||
        rawErr.includes("timed out") ||
        rawErr.includes("not allowed")
      ) {
        errMsg = "Passkey operation was cancelled or timed out. Please try again.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .login-page-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f1d13;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(34, 76, 56, 0.45) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(180, 151, 90, 0.25) 0%, transparent 50%);
          padding: 24px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          box-sizing: border-box;
          width: 100%;
        }
        .login-glass-card {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 48px 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
          text-align: center;
          box-sizing: border-box;
        }
        .login-logo-img {
          width: 220px;
          height: auto;
          object-fit: contain;
          margin: 0 auto -6px;
          display: block;
        }
        .login-title {
          color: #224C38;
          font-size: 1.8rem;
          font-weight: 700;
          font-family: 'Playfair Display', serif;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
          line-height: 1.25;
        }
        .login-tagline {
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 500;
          margin: 0 0 32px 0;
        }
        .login-field-group {
          text-align: left;
          margin-bottom: 20px;
        }
        .login-field-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .login-field-input {
          width: 100%;
          height: 44px;
          background-color: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #1e293b !important;
          border-radius: 8px !important;
          padding: 10px 14px;
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .login-field-input:focus {
          outline: none;
          border-color: #224C38 !important;
          box-shadow: 0 0 0 3px rgba(34, 76, 56, 0.15) !important;
        }
        .login-submit-btn {
          background-color: #224C38;
          color: #ffffff;
          border: 1px solid #224C38;
          border-radius: 8px;
          height: 44px;
          font-size: 15px;
          font-weight: 600;
          width: 100%;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 24px;
          box-sizing: border-box;
        }
        .login-submit-btn:hover {
          background-color: #2e674c;
        }
        .login-submit-btn:active {
          transform: scale(0.98);
        }
        .login-submit-btn:disabled {
          background-color: #94a3b8;
          border-color: #94a3b8;
          cursor: not-allowed;
        }
        .login-passkey-btn {
          background-color: #ffffff;
          color: #224C38;
          border: 1px solid #224C38;
          border-radius: 8px;
          height: 44px;
          font-size: 14px;
          font-weight: 600;
          width: 100%;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
        }
        .login-passkey-btn:hover {
          background-color: #f1f5f9;
        }
        .login-divider {
          display: flex;
          align-items: center;
          margin: 24px 0 18px;
        }
        .login-divider-line {
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }
        .login-divider-text {
          margin: 0 12px;
          font-size: 0.72rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }
      `}</style>

      <div className="login-glass-card">
        <img src="/grace-logo.png" alt="Grace Christian Assembly" className="login-logo-img" />
        <h1 className="login-title">Welcome Back</h1>
        <p className="login-tagline">GCA Camp Registration & Check-In</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-field-group">
            <label className="login-field-label">Username</label>
            <input
              className="login-field-input"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="login-field-group" style={{ marginBottom: 8 }}>
            <label className="login-field-label">Password</label>
            <input
              className="login-field-input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        {isWebAuthnSupported() && (
          <>
            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">or</span>
              <div className="login-divider-line" />
            </div>

            <button
              type="button"
              onClick={handlePasskeySignIn}
              className="login-passkey-btn"
              disabled={loading}
            >
              <span>🛡️</span> Sign In with Biometric / Passkey
            </button>
          </>
        )}

        <p style={{ marginTop: 28, fontSize: "0.78rem", color: "#94a3b8", margin: "28px 0 0 0" }}>
          Trouble signing in? Contact your camp administrator.
        </p>
      </div>
    </div>
  );
}
