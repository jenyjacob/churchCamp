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
  
  // Camp configuration settings
  const [settings, setSettings] = useState({ team_1_name: "Team Peter", team_2_name: "Team Paul" });
  const [activitiesList, setActivitiesList] = useState(["KAYAKING", "BOAT TOUR"]);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  useEffect(() => {
    // Fetch privileges
    api.get("/api/permissions/")
      .then(res => {
        setGrid(res.data.permissions);
      })
      .catch(() => setError("Failed to load permissions grid."))
      .finally(() => setLoading(false));

    // Fetch dynamic configs
    api.get("/api/settings/")
      .then(res => {
        if (res.data.settings) {
          setSettings(res.data.settings);
          try {
            const parsed = JSON.parse(res.data.settings.activity_names);
            if (Array.isArray(parsed)) {
              setActivitiesList(parsed);
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, []);

  const handleActivityChange = (index, val) => {
    const updated = [...activitiesList];
    updated[index] = val;
    setActivitiesList(updated);
  };

  const addActivity = () => {
    setActivitiesList([...activitiesList, ""]);
  };

  const removeActivity = (index) => {
    setActivitiesList(activitiesList.filter((_, i) => i !== index));
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setUpdatingSettings(true);
    setSettingsError("");
    setSettingsSuccess("");

    const payload = {
      ...settings,
      activity_names: JSON.stringify(activitiesList.filter(act => act.trim() !== ""))
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(res.data.settings);
          try {
            const parsed = JSON.parse(res.data.settings.activity_names);
            if (Array.isArray(parsed)) {
              setActivitiesList(parsed);
            }
          } catch (e) {}
          setSettingsSuccess("Camp settings updated successfully!");
          setTimeout(() => setSettingsSuccess(""), 4000);
        }
      })
      .catch(() => setSettingsError("Failed to update camp settings."))
      .finally(() => setUpdatingSettings(false));
  };

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
        {/* Camp Settings (Owner Only) */}
        <div className="card" style={{ marginBottom: 28, padding: "20px" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--forest)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            ⚙️ Camp Customization Settings
          </h3>
          
          {settingsSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{settingsSuccess}</div>}
          {settingsError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{settingsError}</div>}

          <form onSubmit={handleSaveSettings}>
            {/* Group 1: Registration Form Details */}
            <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 14, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
              📝 Registration Page Branding & Activities
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Registration Form Heading Title</label>
                <input 
                  className="form-input" 
                  value={settings.signup_title || ""} 
                  onChange={e => setSettings(prev => ({ ...prev, signup_title: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Camp Dates Description</label>
                <input 
                  className="form-input" 
                  value={settings.signup_dates || ""} 
                  onChange={e => setSettings(prev => ({ ...prev, signup_dates: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Camp Location Description</label>
                <input 
                  className="form-input" 
                  value={settings.signup_location || ""} 
                  onChange={e => setSettings(prev => ({ ...prev, signup_location: e.target.value }))}
                  required 
                />
              </div>
            </div>

            {/* Dynamic Activity Options nested under Registration Page Branding */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border)", paddingBottom: 6, margin: "16px 0 14px 0" }}>
              <h5 style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, fontWeight: 700 }}>
                🛶 Activity Option Labels
              </h5>
              <button 
                type="button" 
                onClick={addActivity}
                style={{ background: "none", border: "1px solid var(--forest)", borderRadius: 4, color: "var(--forest)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", padding: "2px 8px" }}
              >
                + Add Activity
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {activitiesList.map((activity, idx) => (
                <div key={idx} className="form-group" style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Activity #{idx + 1} Name</label>
                    <button 
                      type="button" 
                      onClick={() => removeActivity(idx)}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                  <input 
                    className="form-input" 
                    value={activity} 
                    onChange={e => handleActivityChange(idx, e.target.value)}
                    placeholder={`e.g. Activity #${idx + 1}`}
                    required 
                  />
                </div>
              ))}
              {activitiesList.length === 0 && (
                <div style={{ gridColumn: "span 2", padding: "12px", background: "#f8fafc", borderRadius: 6, color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
                  No activities configured. The activities section will be hidden on the signup page.
                </div>
              )}
            </div>

            {/* Group 2: Game Teams */}
            <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 14, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
              🏆 Game Teams Configurations
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>First Team Name</label>
                <input 
                  className="form-input" 
                  value={settings.team_1_name || ""} 
                  onChange={e => setSettings(prev => ({ ...prev, team_1_name: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Second Team Name</label>
                <input 
                  className="form-input" 
                  value={settings.team_2_name || ""} 
                  onChange={e => setSettings(prev => ({ ...prev, team_2_name: e.target.value }))}
                  required 
                />
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={updatingSettings}
                style={{ padding: "8px 24px" }}
              >
                {updatingSettings ? "Saving Settings…" : "Save Customizations"}
              </button>
            </div>
          </form>
        </div>

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
