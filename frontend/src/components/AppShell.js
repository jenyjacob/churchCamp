import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  isWebAuthnSupported,
  prepareRegistrationOptions,
  formatRegistrationCredential
} from "../utils/webauthn";


const navItems = [
  { to: "/",        icon: "🏠", label: "Dashboard",  exact: true, pageKey: "dashboard" },
  { to: "/campers", icon: "👤", label: "Campers", pageKey: "campers" },
  { to: "/checkin", icon: "✅", label: "Check-In", pageKey: "checkin" },
  { to: "/cabins",  icon: "⛺", label: "Cabins", pageKey: "cabins" },
  { to: "/app/schedule", icon: "📅", label: "Schedule", pageKey: "schedule" },
  { to: "/outdoor", icon: "🛶", label: "Outdoor Activities", pageKey: "outdoor" },
  { to: "/tshirts", icon: "👕", label: "Apparel", pageKey: "apparel" },
];

const adminItems = [
  { to: "/finance", icon: "💰", label: "Finance", pageKey: "finance" },
  { to: "/users",   icon: "⚙️", label: "Users", pageKey: "users" },
  { to: "/logs",    icon: "📄", label: "Audit Logs", pageKey: "logs" },
  { to: "/role-assigner", icon: "🛡️", label: "Role Assigner", pageKey: "role_assigner" },
];

function NavItem({ to, icon, label, exact }) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      className={`nav-item${active ? " active" : ""}`}
    >
      <span className="icon">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function AppShell() {
  const { user, logout, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();

  // Change Password States
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters long.");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword
      });
      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess("");
      }, 1500);
    } catch (err) {
      setPasswordError(err.response?.data?.error || "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete your account? This action is irreversible and all your data will be permanently removed from the system.")) {
      return;
    }
    try {
      await api.delete("/api/users/delete-me");
      alert("Your account has been deleted successfully.");
      logout();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete account.");
    }
  };

  // Passkeys States
  const [isPasskeysOpen, setIsPasskeysOpen] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [passkeySuccess, setPasskeySuccess] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const fetchPasskeys = async () => {
    try {
      const res = await api.get("/api/auth/passkeys");
      setPasskeys(res.data.passkeys || []);
    } catch (err) {
      setPasskeyError("Failed to fetch passkeys.");
    }
  };

  useEffect(() => {
    if (isPasskeysOpen) {
      fetchPasskeys();
      setNewPasskeyName("");
      setPasskeyError("");
      setPasskeySuccess("");
    }
  }, [isPasskeysOpen]);

  const handleRegisterPasskey = async (e) => {
    e.preventDefault();
    setPasskeyError("");
    setPasskeySuccess("");
    setPasskeyLoading(true);

    if (!isWebAuthnSupported()) {
      setPasskeyError("Passkeys/WebAuthn are not supported on this browser or device.");
      setPasskeyLoading(false);
      return;
    }

    try {
      const optionsRes = await api.post("/api/auth/register-passkey/options");
      const options = optionsRes.data;

      const preparedOptions = prepareRegistrationOptions(options);

      const credential = await navigator.credentials.create({
        publicKey: preparedOptions,
      });

      if (!credential) {
        throw new Error("No credential returned from device.");
      }

      const formatted = formatRegistrationCredential(credential);

      await api.post("/api/auth/register-passkey/verify", {
        credential: formatted,
        challenge: options.challenge,
        name: newPasskeyName || "My Passkey",
      });

      setPasskeySuccess("Passkey registered successfully!");
      setNewPasskeyName("");
      fetchPasskeys();
    } catch (err) {
      console.error(err);
      let errMsg = err.response?.data?.error || err.message || "Failed to register passkey.";
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
      setPasskeyError(errMsg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (passkeyId) => {
    if (!window.confirm("Are you sure you want to delete this passkey?")) return;
    setPasskeyError("");
    setPasskeySuccess("");
    try {
      await api.delete(`/api/auth/passkeys/${passkeyId}`);
      setPasskeySuccess("Passkey deleted successfully!");
      fetchPasskeys();
    } catch (err) {
      setPasskeyError(err.response?.data?.error || "Failed to delete passkey.");
    }
  };


  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {/* Mobile Sticky Header */}
      <header className="mobile-header">
        <Link to="/" className="mobile-brand" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <img src="/gca-logo-white.png" alt="GCA Logo" style={{ height: 22, width: "auto", objectFit: "contain" }} />
          <span style={{ fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.3px" }}>Camp Manager</span>
        </Link>
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Backdrop overlay for closing the drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand" style={{ paddingBottom: 16 }}>
          <Link to="/" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", color: "inherit" }}>
            <img src="/gca-logo-white.png" alt="GCA Logo" style={{ width: 140, height: "auto", marginBottom: 10, objectFit: "contain", cursor: "pointer" }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255, 255, 255, 0.7)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Camp Registration</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => hasPermission(item.pageKey, "hide"))
            .map(item => (
              <NavItem key={item.to} {...item} />
            ))
          }
          {adminItems.some(item => hasPermission(item.pageKey, "hide")) && (
            <>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "8px 0" }} />
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "4px 12px 2px" }}>Admin</div>
              {adminItems
                .filter(item => hasPermission(item.pageKey, "hide"))
                .map(item => (
                  <NavItem key={item.to} {...item} />
                ))
              }
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="avatar">{initials}</div>
            <div className="info">
              <div className="name">{user?.full_name || user?.username}</div>
              <div className="role-tag">{user?.role}</div>
            </div>
          </div>
          <button className="nav-item w-full" onClick={() => setIsSettingsOpen(!isSettingsOpen)} style={{ marginBottom: 4 }}>
            <span className="icon">⚙️</span>
            Settings
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", transform: isSettingsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
          </button>
          {isSettingsOpen && (
            <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
              <button className="nav-item w-full" onClick={() => setIsChangePasswordOpen(true)} style={{ fontSize: "0.825rem", padding: "8px 10px" }}>
                <span className="icon">🔑</span>
                Change Password
              </button>
              <button className="nav-item w-full" onClick={() => setIsPasskeysOpen(true)} style={{ fontSize: "0.825rem", padding: "8px 10px" }}>
                <span className="icon">🛡️</span>
                Manage Passkeys
              </button>
              <button className="nav-item w-full" onClick={handleDeleteAccount} style={{ fontSize: "0.825rem", padding: "8px 10px", color: "var(--danger)" }}>
                <span className="icon">🗑️</span>
                Delete Account
              </button>
            </div>
          )}
          <button className="nav-item w-full" onClick={logout}>
            <span className="icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => {
                setIsChangePasswordOpen(false);
                setPasswordError("");
                setPasswordSuccess("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}>×</button>
            </div>
            
            <form onSubmit={handleChangePassword}>
              {passwordError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{passwordError}</div>}
              {passwordSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{passwordSuccess}</div>}
              
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Current Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">New Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Confirm New Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  disabled={passwordSaving}
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setPasswordError("");
                    setPasswordSuccess("");
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                  {passwordSaving ? "Saving..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Passkeys Modal */}
      {isPasskeysOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Manage Biometric Passkeys</h2>
              <button className="modal-close" onClick={() => setIsPasskeysOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ padding: "0 20px 20px" }}>
              {passkeyError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{passkeyError}</div>}
              {passkeySuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{passkeySuccess}</div>}
              
              {!isWebAuthnSupported() && (
                <div className="alert alert-error" style={{ marginBottom: 12 }}>
                  ⚠️ Your browser or device does not support WebAuthn / Passkeys, or you are not using a secure (HTTPS/localhost) connection.
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 10, color: "#374151" }}>Registered Passkeys</h3>
                {passkeys.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#6B7280", fontStyle: "italic", background: "#F9FAFB", padding: 12, borderRadius: 6, border: "1px dashed #E5E7EB" }}>
                    No biometric passkeys registered. Register your device below to log in faster.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {passkeys.map(pk => (
                      <div key={pk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F9FAFB", padding: "10px 12px", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1F2937" }}>🛡️ {pk.name || "Unnamed Passkey"}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                            Registered: {pk.created_at ? new Date(pk.created_at).toLocaleDateString() : "Unknown"} • Used {pk.sign_count} times
                          </div>
                        </div>
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: "4px 8px", color: "#EF4444" }} 
                          onClick={() => handleDeletePasskey(pk.id)}
                          title="Delete Passkey"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isWebAuthnSupported() && (
                <form onSubmit={handleRegisterPasskey} style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: 10, color: "#374151" }}>Register This Device</h3>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Passkey Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Face ID / Touch ID, My Laptop"
                      value={newPasskeyName} 
                      onChange={e => setNewPasskeyName(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="btn btn-primary w-full" 
                    style={{ justifyContent: "center", gap: 8 }}
                    disabled={passkeyLoading}
                  >
                    {passkeyLoading ? (
                      <>
                        <span className="spinner" /> Authenticating...
                      </>
                    ) : (
                      <>
                        <span>🔑</span> Register Biometric Passkey
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setIsPasskeysOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
