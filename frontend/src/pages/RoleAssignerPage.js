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
  { key: "receipt_upload", label: "🧾 Upload Receipts" },
  { key: "users", label: "⚙️ Users" },
  { key: "logs", label: "📄 Audit Logs" }
];

const getRoleLabel = (roleKey) => {
  switch (roleKey) {
    case "user": return "Registration Team (user)";
    case "director": return "Camp Director";
    case "finance": return "Finance Dept";
    case "admin": return "Camp Admin";
    case "owner": return "Camp Owner";
    default: return `${roleKey.charAt(0).toUpperCase() + roleKey.slice(1)} (Custom)`;
  }
};


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
  const [selectedRole, setSelectedRole] = useState("user");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [dynamicRoles, setDynamicRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [roleSuccess, setRoleSuccess] = useState("");
  const [isRoleSettingsOpen, setIsRoleSettingsOpen] = useState(true);

  // Camp configuration settings
  const [settings, setSettings] = useState({ team_1_name: "Team Peter", team_2_name: "Team Paul" });
  const [activitiesList, setActivitiesList] = useState(["KAYAKING", "BOAT TOUR"]);
  const [updatingCamp, setUpdatingCamp] = useState(false);
  const [updatingTeams, setUpdatingTeams] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [isCampSettingsOpen, setIsCampSettingsOpen] = useState(true);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(true);

  useEffect(() => {
    // Fetch privileges
    api.get("/api/permissions/")
      .then(res => {
        setGrid(res.data.permissions);
        if (res.data.roles) {
          const rolesArray = res.data.roles
            .filter(r => r !== "owner")
            .map(r => ({
              key: r,
              label: getRoleLabel(r)
            }));
          setDynamicRoles(rolesArray);
        } else {
          setDynamicRoles([
            { key: "user", label: "Registration Team (user)" },
            { key: "director", label: "Camp Director" },
            { key: "finance", label: "Finance Dept" },
            { key: "admin", label: "Camp Admin" }
          ]);
        }
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

    // Resize listener
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  const handleSaveCampSettings = (e) => {
    e.preventDefault();
    setUpdatingCamp(true);
    setSettingsError("");
    setSettingsSuccess("");

    const status = settings.registration_status || "open";
    const payload = {
      signup_title: settings.signup_title,
      signup_dates: settings.signup_dates,
      signup_location: settings.signup_location,
      registration_status: status,
      registration_closed: status === "open" ? "false" : "true",
      activity_names: JSON.stringify(activitiesList.filter(act => act.trim() !== ""))
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(prev => ({ ...prev, ...res.data.settings }));
          try {
            const parsed = JSON.parse(res.data.settings.activity_names);
            if (Array.isArray(parsed)) {
              setActivitiesList(parsed);
            }
          } catch (e) {}
          setSettingsSuccess("Camp customization settings updated successfully!");
          setTimeout(() => setSettingsSuccess(""), 4000);
        }
      })
      .catch(() => setSettingsError("Failed to update camp customization settings."))
      .finally(() => setUpdatingCamp(false));
  };

  const handleSaveTeamSettings = (e) => {
    e.preventDefault();
    setUpdatingTeams(true);
    setSettingsError("");
    setSettingsSuccess("");

    const payload = {
      team_1_name: settings.team_1_name,
      team_2_name: settings.team_2_name
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(prev => ({ ...prev, ...res.data.settings }));
          setSettingsSuccess("Game teams configurations updated successfully!");
          setTimeout(() => setSettingsSuccess(""), 4000);
        }
      })
      .catch(() => setSettingsError("Failed to update game teams configurations."))
      .finally(() => setUpdatingTeams(false));
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setRoleError("");
    setRoleSuccess("");

    if (!newRoleName.trim()) {
      setRoleError("Role name is required.");
      return;
    }

    const cleanName = newRoleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanName) {
      setRoleError("Role name must contain only lowercase letters, numbers, or underscores.");
      return;
    }

    setCreatingRole(true);
    try {
      const res = await api.post("/api/permissions/roles", { role_name: cleanName });
      setRoleSuccess(res.data.message || `User role '${cleanName}' created successfully!`);
      setNewRoleName("");

      // Refresh permissions grid and dynamic roles
      const gridRes = await api.get("/api/permissions/");
      setGrid(gridRes.data.permissions);
      if (gridRes.data.roles) {
        const rolesArray = gridRes.data.roles
          .filter(r => r !== "owner")
          .map(r => ({
            key: r,
            label: getRoleLabel(r)
          }));
        setDynamicRoles(rolesArray);
      }
      setTimeout(() => setRoleSuccess(""), 4000);
    } catch (err) {
      setRoleError(err.response?.data?.error || "Failed to create user role.");
    } finally {
      setCreatingRole(false);
    }
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

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {settingsSuccess && <div className="alert alert-success">{settingsSuccess}</div>}
        {settingsError && <div className="alert alert-error">{settingsError}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* SECTION 1: Privileges Matrix Table / Mobile List */}
        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
            Loading privileges matrix…
          </div>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: "var(--forest)" }}>Select Role to Edit Permissions:</label>
                <select 
                  className="form-input" 
                  value={selectedRole} 
                  onChange={e => setSelectedRole(e.target.value)}
                  style={{ width: "100%", height: 40, cursor: "pointer", marginTop: 6 }}
                >
                  {dynamicRoles.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              {PAGES.map(p => {
                const currentLevel = grid[selectedRole]?.[p.key] || "hide";
                const savingKey = `${selectedRole}-${p.key}`;
                const savingStatus = savingMap[savingKey];

                return (
                  <div key={p.key} className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "var(--forest)", fontSize: "0.85rem" }}>{p.label}</span>
                      <div style={{ height: 14, fontSize: "0.68rem" }}>
                        {savingStatus === "saving" && <span style={{ color: "var(--muted)" }}>Saving…</span>}
                        {savingStatus === "saved" && <span style={{ color: "var(--forest)", fontWeight: 700 }}>Saved ✓</span>}
                        {savingStatus === "error" && <span style={{ color: "var(--red)", fontWeight: 700 }}>Failed ⚠️</span>}
                      </div>
                    </div>
                    
                    <div style={{ 
                      display: "flex", 
                      border: "1px solid var(--border)", 
                      borderRadius: "20px",
                      overflow: "hidden",
                      background: "#fff",
                      padding: 2
                    }}>
                      {ACCESS_LEVELS.map(al => {
                        const isActive = currentLevel === al.level;
                        return (
                          <button
                            key={al.level}
                            style={{
                              flex: 1,
                              border: "none",
                              outline: "none",
                              padding: "8px 0",
                              fontSize: "0.72rem",
                              fontWeight: isActive ? 700 : 500,
                              cursor: "pointer",
                              color: isActive ? al.color : "var(--muted)",
                              background: isActive ? al.bg : "transparent",
                              borderRadius: "18px",
                              transition: "all 0.2s ease",
                              textAlign: "center"
                            }}
                            onClick={() => handleAccessChange(selectedRole, p.key, al.level)}
                            title={`${al.label} access to ${p.label}`}
                          >
                            <span style={{ marginRight: 2 }}>{al.icon}</span> {al.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "rgba(0, 0, 0, 0.01)" }}>
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, fontWeight: 700 }}>
                🛡️ Role Access Control Grid
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "16px 20px", textAlign: "left", fontWeight: 600 }}>Page Name</th>
                    {dynamicRoles.map(r => (
                      <th key={r.key} style={{ padding: "16px 20px", textAlign: "center", fontWeight: 600 }}>{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PAGES.map(p => (
                    <tr key={p.key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: 600, color: "var(--forest)" }}>{p.label}</td>
                      {dynamicRoles.map(r => {
                        const currentLevel = grid[r.key]?.[p.key] || "hide";
                        const savingKey = `${r.key}-${p.key}`;
                        const savingStatus = savingMap[savingKey];
                        
                        return (
                          <td key={r.key} style={{ padding: "12px 20px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                              <div style={{ 
                                display: "inline-flex", 
                                border: "1px solid var(--border)", 
                                borderRadius: "20px",
                                overflow: "hidden",
                                background: "#fff",
                                padding: 2
                              }}>
                                {ACCESS_LEVELS.map(al => {
                                  const isActive = currentLevel === al.level;
                                  return (
                                    <button
                                      key={al.level}
                                      style={{
                                        border: "none",
                                        outline: "none",
                                        padding: "6px 14px",
                                        fontSize: "0.72rem",
                                        fontWeight: isActive ? 700 : 500,
                                        cursor: "pointer",
                                        color: isActive ? al.color : "var(--muted)",
                                        background: isActive ? al.bg : "transparent",
                                        borderRadius: "18px",
                                        transition: "all 0.2s ease"
                                      }}
                                      onClick={() => handleAccessChange(r.key, p.key, al.level)}
                                      title={`${al.label} access to ${p.label}`}
                                    >
                                      <span style={{ marginRight: 3 }}>{al.icon}</span> {al.label}
                                    </button>
                                  );
                                })}
                              </div>
                              
                              {/* Auto-save Status */}
                              <div style={{ height: 14, fontSize: "0.68rem" }}>
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
          </div>
        )}

        {/* SECTION 2: Access Level Guide */}
        <div className="card" style={{ background: "#fdfdfd" }}>
          <h3 style={{ fontSize: "0.95rem", color: "var(--forest)", marginBottom: 12, fontWeight: 700 }}>
            💡 Access Level Guide
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div style={{ padding: 12, background: "rgba(220, 53, 69, 0.03)", border: "1px solid rgba(220, 53, 69, 0.1)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, color: "var(--red)", fontSize: "0.85rem", marginBottom: 4 }}>🚫 Hide Access</div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--charcoal)", lineHeight: 1.5 }}>
                Roles with this level will not see the page link in the navigation menu and will be blocked from accessing the route.
              </p>
            </div>
            <div style={{ padding: 12, background: "rgba(29, 78, 216, 0.03)", border: "1px solid rgba(29, 78, 216, 0.1)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: "0.85rem", marginBottom: 4 }}>👁️ Read Only Access</div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--charcoal)", lineHeight: 1.5 }}>
                Roles with this level can view records and browse layout elements, but all editing, check-in, or delete buttons are hidden/disabled.
              </p>
            </div>
            <div style={{ padding: 12, background: "rgba(34, 76, 56, 0.03)", border: "1px solid rgba(34, 76, 56, 0.1)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, color: "var(--forest)", fontSize: "0.85rem", marginBottom: 4 }}>📝 Edit Access</div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--charcoal)", lineHeight: 1.5 }}>
                Roles with this level have full create, read, update, and delete access. They can modify campers, cabins, check-ins, or logs.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Collapsible Configurations */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          
          {/* Card 1: Camp Customization Settings */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div 
              onClick={() => setIsCampSettingsOpen(!isCampSettingsOpen)}
              style={{ 
                padding: "16px 20px", 
                cursor: "pointer", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isCampSettingsOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isCampSettingsOpen ? "0px" : "8px",
                borderBottomRightRadius: isCampSettingsOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                ⚙️ Camp Customization Settings
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isCampSettingsOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isCampSettingsOpen && (
              <form onSubmit={handleSaveCampSettings} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Group 1: Registration Form Details */}
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                  📝 Registration Page Branding & Details
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
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

                {/* Group 2: Dynamic Activities List */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border)", paddingBottom: 6, marginTop: 10 }}>
                  <h5 style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, fontWeight: 700 }}>
                    🛶 Activity Option Labels
                  </h5>
                  <button 
                    type="button" 
                    onClick={addActivity}
                    style={{ background: "none", border: "1px solid var(--forest)", borderRadius: 4, color: "var(--forest)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", padding: "2px 10px" }}
                  >
                    + Add Activity
                  </button>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  {activitiesList.map((activity, idx) => (
                    <div key={idx} className="form-group" style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: "0.8rem" }}>Activity #{idx + 1} Name</label>
                        <button 
                          type="button" 
                          onClick={() => removeActivity(idx)}
                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
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
                    <div style={{ gridColumn: "1 / -1", padding: "16px", background: "#f8fafc", borderRadius: 6, color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
                      No activities configured. The activities section will be hidden on the signup page.
                    </div>
                  )}
                </div>

                {/* Group 3: Registration Availability Status */}
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700, marginTop: 10 }}>
                  🟢 Registration Status
                </h4>
                <div className="form-group" style={{ marginBottom: 4 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Camper Registration Form Availability</label>
                  <select
                    className="form-input"
                    style={{ width: "100%", maxWidth: 360, height: 38, cursor: "pointer" }}
                    value={settings.registration_status || "open"}
                    onChange={e => setSettings(prev => ({ ...prev, registration_status: e.target.value }))}
                  >
                    <option value="open">🟢 Open (Allow campers to sign up)</option>
                    <option value="not_open">⏳ Not Open Yet (Display 'Registration is not open yet' message)</option>
                    <option value="closed">🚫 Closed (Display 'Registration is closed' message)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={updatingCamp}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {updatingCamp ? "Saving Settings…" : "Save Customization Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2: Game Teams Configurations */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div 
              onClick={() => setIsTeamSettingsOpen(!isTeamSettingsOpen)}
              style={{ 
                padding: "16px 20px", 
                cursor: "pointer", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isTeamSettingsOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isTeamSettingsOpen ? "0px" : "8px",
                borderBottomRightRadius: isTeamSettingsOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                🏆 Game Teams Configurations
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isTeamSettingsOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isTeamSettingsOpen && (
              <form onSubmit={handleSaveTeamSettings} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                  🏆 Camp Game Teams Name
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
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
                
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={updatingTeams}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {updatingTeams ? "Saving Teams…" : "Save Teams Configuration"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 3: Dynamic User Roles Configuration */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div 
              onClick={() => setIsRoleSettingsOpen(!isRoleSettingsOpen)}
              style={{ 
                padding: "16px 20px", 
                cursor: "pointer", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isRoleSettingsOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isRoleSettingsOpen ? "0px" : "8px",
                borderBottomRightRadius: isRoleSettingsOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                👥 Define New Custom User Role
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isRoleSettingsOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isRoleSettingsOpen && (
              <form onSubmit={handleCreateRole} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                  👥 Create New Role
                </h4>

                {roleSuccess && <div className="alert alert-success">{roleSuccess}</div>}
                {roleError && <div className="alert alert-error">{roleError}</div>}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Role Identifier *</label>
                  <input 
                    className="form-input" 
                    value={newRoleName} 
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="e.g. assistant_director, helper, group_leader"
                    required 
                  />
                  <span className="text-muted" style={{ fontSize: "0.72rem", marginTop: 4, display: "block" }}>
                    Lower-case letters, numbers, and underscores only. This will run an alter statement on the database schema.
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={creatingRole}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {creatingRole ? "Altering DB Schema…" : "Create & Authorize Role"}
                  </button>
                </div>
              </form>
            )}
          </div>
          
        </div>
      </div>
    </>
  );
}
