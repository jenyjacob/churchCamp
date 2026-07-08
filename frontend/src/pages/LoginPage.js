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
      setError(
        err.response?.data?.error ||
        err.message ||
        "Passkey sign in failed. Make sure you are using HTTPS or localhost, and your passkey is registered."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/grace-logo.png" alt="Grace Christian Assembly" className="login-logo" />
        <h1>Welcome Back</h1>
        <p className="tagline">GCA Camp Registration & Check-In</p>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
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
            className="btn btn-primary btn-lg w-full"
            style={{ marginTop: 8, justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        {isWebAuthnSupported() && (
          <>
            <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              <span style={{ margin: "0 10px", fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>

            <button
              type="button"
              onClick={handlePasskeySignIn}
              className="btn btn-lg w-full"
              style={{
                justifyContent: "center",
                gap: 10,
                background: "transparent",
                border: "1px solid #1E4D2B",
                color: "#1E4D2B",
                fontWeight: 600,
                transition: "all 0.2s ease"
              }}
              disabled={loading}
            >
              <span>🛡️</span> Sign In with Biometric / Passkey
            </button>
          </>
        )}

        <p style={{ marginTop: 20, fontSize: "0.78rem", color: "#9CA3AF" }}>
          Trouble signing in? Contact your camp administrator.
        </p>
      </div>
    </div>
  );
}
