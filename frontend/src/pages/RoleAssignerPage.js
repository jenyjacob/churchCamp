import React, { useEffect, useState } from "react";
import api from "../utils/api";

const PAGES = [
  { key: "dashboard", label: "🏠 Dashboard" },
  { key: "campers", label: "👤 Campers" },
  { key: "checkin", label: "✅ Check-In" },
  { key: "cabins", label: "⛺ Cabins" },
  { key: "schedule", label: "📅 Schedule" },
  { key: "outdoor", label: "🛶 Outdoor Activities" },
  { key: "apparel", label: "👕 Apparel" },
  { key: "finance", label: "💰 Finance" },
  { key: "users", label: "⚙️ Users" },
  { key: "logs", label: "📄 Audit Logs" }
];

const ROLES = [
  { key: "user", label: "Registration Team (user)" },
  { key: "director", label: "Camp Director" },
  { key: "finance", label: "Finance Dept" },
  { key: "admin", label: "Camp Admin" }
];

const ACCESS_LEVELS = [
  { level: "hide", label: "Hide", color: "var(--red)", bg: "rgba(220, 53, 69, 0.08)", icon: "🚫" },
  { level: "read", label: "Read Only", color: "#1D4ED8", bg: "rgba(29, 78, 216, 0.08)", icon: "👁️" },
  { level: "edit", label: "Edit", color: "var(--forest)", bg: "rgba(34, 76, 56, 0.08)", icon: "📝" }
];

export default function RoleAssignerPage() {
  const [grid, setGrid] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState({}); // { 'role-page': 'saving' | 'saved' | 'error' }
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/permissions/")
      .then(res => {
        setGrid(res.data.permissions);
      })
      .catch(() => setError("Failed to load permissions grid."))
      .finally(() => setLoading(false));
  }, []);

  const handleAccessChange = async (role, pageKey, level) => {
    const key = `${role}-${pageKey}`;
    setSavingMap(prev => ({ ...prev, [key]: "saving" }));
    try {
      await api.post("/api/permissions/", { role, page_key: pageKey, access_level: level });
      
      // Update local state
      setGrid(prev => ({
        ...prev,
        [role]: {
          ...prev[role],
          [pageKey]: level
        }
      }));
      setSavingMap(prev => ({ ...prev, [key]: "saved" }));
      setTimeout(() => {
        setSavingMap(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }, 2000);
    } catch {
      setSavingMap(prev => ({ ...prev, [key]: "error" }));
    }
  };

  return (
    <>
      <div className="top-bar">
        <h1>Role Assigner</h1>
        <span className="text-muted">Manage page access privileges across user roles</span>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--forest)", marginBottom: 12 }}>🛡️ Access Level Guide</h3>
          <ul style={{ paddingLeft: 18, fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6 }}>
            <li><strong>Hide 🚫</strong>: Role cannot see the page in navigation and cannot access the page route.</li>
            <li><strong>Read Only 👁️</strong>: Role can view the page but cannot save, edit, check-in, or delete items.</li>
            <li><strong>Edit 📝</strong>: Role has full view and modify permissions for the page.</li>
          </ul>
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 48, color: "var(--muted)" }}>Loading privileges matrix…</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontWeight: 600 }}>Page Name</th>
                  {ROLES.map(r => (
                    <th key={r.key} style={{ padding: "16px 20px", textAlign: "center", fontWeight: 600 }}>{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGES.map(p => (
                  <tr key={p.key} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "16px 20px", fontWeight: 500, color: "var(--charcoal)" }}>{p.label}</td>
                    {ROLES.map(r => {
                      const currentLevel = grid[r.key]?.[p.key] || "hide";
                      const savingKey = `${r.key}-${p.key}`;
                      const savingStatus = savingMap[savingKey];
                      
                      return (
                        <td key={r.key} style={{ padding: "12px 20px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ 
                              display: "inline-flex", 
                              border: "1px solid var(--border)", 
                              borderRadius: "var(--radius-sm)",
                              overflow: "hidden"
                            }}>
                              {ACCESS_LEVELS.map(al => {
                                const isActive = currentLevel === al.level;
                                return (
                                  <button
                                    key={al.level}
                                    style={{
                                      border: "none",
                                      outline: "none",
                                      padding: "6px 12px",
                                      fontSize: "0.75rem",
                                      fontWeight: isActive ? 700 : 500,
                                      cursor: "pointer",
                                      color: isActive ? al.color : "var(--muted)",
                                      background: isActive ? al.bg : "white",
                                      transition: "all 0.15s ease",
                                      borderRight: al.level !== "edit" ? "1px solid var(--border)" : "none"
                                    }}
                                    onClick={() => handleAccessChange(r.key, p.key, al.level)}
                                    title={`${al.label} access to ${p.label}`}
                                  >
                                    <span style={{ marginRight: 3 }}>{al.icon}</span> {al.label}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {/* Auto-save Indicator */}
                            <div style={{ height: 14, fontSize: "0.7rem" }}>
                              {savingStatus === "saving" && <span style={{ color: "var(--muted)" }}>Saving…</span>}
                              {savingStatus === "saved" && <span style={{ color: "var(--forest)", fontWeight: 700 }}>Saved ✓</span>}
                              {savingStatus === "error" && <span style={{ color: "var(--red)", fontWeight: 700 }}>Failed ⚠️</span>}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
