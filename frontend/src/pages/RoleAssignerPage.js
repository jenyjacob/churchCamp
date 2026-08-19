import React, { useEffect, useState } from "react";
import api from "../utils/api";

const PAGES = [
  { key: "dashboard", label: "🏠 Dashboard" },
  { key: "campers", label: "👤 Campers" },
  { key: "teams", label: "🏆 Team Selection" },
  { key: "checkin", label: "✅ Check-In" },
  { key: "cabins", label: "⛺ Cabins" },
  { key: "schedule", label: "📅 Schedule" },
  { key: "outdoor", label: "🛶 Outdoor Activities" },
  { key: "apparel", label: "👕 Apparel" },
  { key: "finance", label: "💰 Finance" },
  { key: "receipt_upload", label: "🧾 Upload Receipts" },
  { key: "users", label: "⚙️ Users" },
  { key: "logs", label: "📄 Audit Logs" },
  { key: "camp_info", label: "ℹ️ Camp Info" },
  { key: "retreat_ops", label: "📋 Retreat Operations" },
  { key: "registration_config", label: "📝 Registration Config" },
  { key: "kidz_corner", label: "🧸 Kidz Corner" },
  { key: "kidz_corner_checkin", label: "✅ VBS Check-In" },
  { key: "kidz_corner_budget", label: "💰 Kidz Corner Budget" }
];

const getRoleLabel = (roleKey) => {
  switch (roleKey) {
    case "user": return "Registration Team (user)";
    case "director": return "Camp Director";
    case "finance": return "Finance Dept";
    case "admin": return "Camp Admin";
    case "owner": return "Camp Owner";
    case "vbslead": return "VBS Lead";
    case "volunteer": return "VBS Volunteer";
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
  const [settings, setSettings] = useState({ team_1_name: "Team Peter", team_2_name: "Team Paul", teams_published: "true", require_waiver_confirmation: "true", show_breakfast_option: "true" });
  const [updatingTeams, setUpdatingTeams] = useState(false);
  const [teamSuccess, setTeamSuccess] = useState("");
  const [teamError, setTeamError] = useState("");
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(true);

  // Check-In configuration settings
  const [updatingCheckinSettings, setUpdatingCheckinSettings] = useState(false);
  const [checkinSettingsSuccess, setCheckinSettingsSuccess] = useState("");
  const [checkinSettingsError, setCheckinSettingsError] = useState("");
  const [isCheckinSettingsOpen, setIsCheckinSettingsOpen] = useState(true);

  // Sunday Breakfast configuration
  const [breakfastMenuItems, setBreakfastMenuItems] = useState(["Pancakes", "Eggs", "Cereal", "Fruit"]);
  const [updatingBreakfastSettings, setUpdatingBreakfastSettings] = useState(false);
  const [breakfastSettingsSuccess, setBreakfastSettingsSuccess] = useState("");
  const [breakfastSettingsError, setBreakfastSettingsError] = useState("");
  const [isBreakfastSettingsOpen, setIsBreakfastSettingsOpen] = useState(true);

  // Breakfast Orders Summary
  const [breakfastSummary, setBreakfastSummary] = useState(null);
  const [loadingBreakfastSummary, setLoadingBreakfastSummary] = useState(false);
  const [isBreakfastSummaryOpen, setIsBreakfastSummaryOpen] = useState(true);

  // Excel Upload State for Teams
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");

  const handleUploadExcel = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select an Excel (.xlsx) file first.");
      return;
    }
    setUploadingExcel(true);
    setUploadError("");
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await api.post("/api/campers/upload-teams", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadResult(res.data);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Failed to upload and process Excel sheet.");
    } finally {
      setUploadingExcel(false);
    }
  };

  const fetchBreakfastSummary = () => {
    setLoadingBreakfastSummary(true);
    api.get("/api/breakfast/summary")
      .then(res => setBreakfastSummary(res.data))
      .catch(() => {})
      .finally(() => setLoadingBreakfastSummary(false));
  };

  const handleExportBreakfastPDF = () => {
    if (!breakfastSummary) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print/export PDF.");
      return;
    }

    const escapeHtml = (str) => {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const itemRows = Object.entries(breakfastSummary.item_totals || {}).map(([name, count]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td style="text-align:right; font-weight:700;">${count}</td>
      </tr>
    `).join("") || `<tr><td colspan="2" style="text-align:center; color:#7f8c8d;">No breakfast selections recorded yet.</td></tr>`;

    const rosterRows = (breakfastSummary.family_breakdown || []).map(group => {
      const itemsText = Object.entries(group.items || {}).map(([name, count]) => `${count}x ${name}`).join(", ") || "—";
      const hasNoItems = Object.keys(group.items || {}).length === 0;
      return `
        <tr${hasNoItems ? ' style="background:#FEF3C7;"' : ""}>
          <td>${group.family_group ? `Family #${escapeHtml(group.family_group)}` : "Individual"}</td>
          <td>${group.members.map(escapeHtml).join(", ")}</td>
          <td${hasNoItems ? ' style="color:#92400E;font-weight:700;"' : ""}>${hasNoItems ? "⚠️ No items specified" : itemsText}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="3" style="text-align:center; color:#7f8c8d;">No breakfast selections recorded yet.</td></tr>`;

    const mismatches = (breakfastSummary.family_breakdown || []).filter(g => Object.keys(g.items || {}).length === 0);
    const mismatchBanner = mismatches.length > 0
      ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
           <strong style="color:#92400E;">⚠️ Order mismatch — ${mismatches.reduce((s, g) => s + g.members.length, 0)} camper(s) want breakfast but have no items specified</strong>
           <ul style="margin:6px 0 0 0;padding-left:18px;color:#78350F;font-size:0.88rem;">
             ${mismatches.map(g => `<li>${g.family_group ? `<strong>Family #${escapeHtml(g.family_group)}:</strong> ` : "<strong>Individual:</strong> "}${g.members.map(escapeHtml).join(", ")}</li>`).join("")}
           </ul>
         </div>`
      : `<div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:6px;padding:10px 14px;margin-bottom:24px;color:#065F46;font-weight:600;font-size:0.88rem;">✅ All campers who want breakfast have items selected.</div>`;

    const generatedAt = new Date().toLocaleString();

    const htmlContent = `
      <html>
        <head>
          <title>Sunday Breakfast Orders Summary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2c3e50; padding: 20px; }
            h1 { color: #1e4d2b; border-bottom: 2px solid #1e4d2b; padding-bottom: 10px; margin-bottom: 8px; }
            .subtitle { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 24px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; max-width: 420px; }
            .metric-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; text-align: center; }
            .metric-label { font-size: 0.75rem; text-transform: uppercase; color: #7f8c8d; font-weight: 600; margin-bottom: 5px; }
            .metric-value { font-size: 1.5rem; font-weight: 700; color: #2c3e50; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; max-width: 500px; }
            th, td { border: 1px solid #e0e0e0; padding: 10px 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            tr:nth-child(even) { background-color: #fafafa; }
            .print-btn-bar { margin-bottom: 20px; display: flex; gap: 10px; }
            @media print {
              .print-btn-bar { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-btn-bar">
            <button onclick="window.print()" style="padding: 10px 20px; background: #1e4d2b; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">🖨️ Print / Save as PDF</button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">Close</button>
          </div>
          <h1>🥞 Sunday Breakfast Orders Summary</h1>
          <div class="subtitle">Generated ${generatedAt}</div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Campers Asked</div>
              <div class="metric-value">${breakfastSummary.total_answered}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Want Breakfast</div>
              <div class="metric-value">${breakfastSummary.total_wants_breakfast}</div>
            </div>
          </div>

          ${mismatchBanner}

          <h2 style="color: #1e4d2b; margin-top: 30px; font-size: 1.1rem; border-bottom: 1px solid #ddd; padding-bottom: 6px;">Totals by Menu Item</h2>
          <table>
            <thead>
              <tr>
                <th>Menu Item</th>
                <th style="text-align:right;">Total Count</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <h2 style="color: #1e4d2b; margin-top: 30px; font-size: 1.1rem; border-bottom: 1px solid #ddd; padding-bottom: 6px;">Who's Getting Breakfast</h2>
          <table>
            <thead>
              <tr>
                <th>Family</th>
                <th>Camper Name(s)</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              ${rosterRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
            { key: "admin", label: "Camp Admin" },
            { key: "vbslead", label: "VBS Lead" },
            { key: "volunteer", label: "VBS Volunteer" }
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
          if (res.data.settings.breakfast_menu_items) {
            try {
              const parsed = JSON.parse(res.data.settings.breakfast_menu_items);
              if (Array.isArray(parsed)) setBreakfastMenuItems(parsed);
            } catch {
              // keep default list if stored value is malformed
            }
          }
        }
      })
      .catch(() => {});

    // Fetch breakfast orders summary
    fetchBreakfastSummary();

    // Resize listener
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSaveTeamSettings = (e) => {
    e.preventDefault();
    setUpdatingTeams(true);
    setTeamError("");
    setTeamSuccess("");

    const payload = {
      team_1_name: settings.team_1_name,
      team_2_name: settings.team_2_name,
      teams_published: settings.teams_published || "true"
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(prev => ({ ...prev, ...res.data.settings }));
          setTeamSuccess("Game teams configuration saved successfully!");
          setTimeout(() => setTeamSuccess(""), 5000);
        }
      })
      .catch(() => setTeamError("Failed to update game teams configuration."))
      .finally(() => setUpdatingTeams(false));
  };

  const handleSaveCheckinSettings = (e) => {
    e.preventDefault();
    setUpdatingCheckinSettings(true);
    setCheckinSettingsError("");
    setCheckinSettingsSuccess("");

    const payload = {
      require_waiver_confirmation: settings.require_waiver_confirmation || "true"
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(prev => ({ ...prev, ...res.data.settings }));
          setCheckinSettingsSuccess("Check-in configuration saved successfully!");
          setTimeout(() => setCheckinSettingsSuccess(""), 5000);
        }
      })
      .catch(() => setCheckinSettingsError("Failed to update check-in configuration."))
      .finally(() => setUpdatingCheckinSettings(false));
  };

  const handleBreakfastItemChange = (index, value) => {
    setBreakfastMenuItems(prev => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddBreakfastItem = () => {
    setBreakfastMenuItems(prev => [...prev, ""]);
  };

  const handleRemoveBreakfastItem = (index) => {
    setBreakfastMenuItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveBreakfastSettings = (e) => {
    e.preventDefault();
    setUpdatingBreakfastSettings(true);
    setBreakfastSettingsError("");
    setBreakfastSettingsSuccess("");

    const cleanItems = breakfastMenuItems.map(i => i.trim()).filter(Boolean);
    if (cleanItems.length === 0) {
      setBreakfastSettingsError("Add at least one breakfast menu item.");
      setUpdatingBreakfastSettings(false);
      return;
    }

    const payload = {
      show_breakfast_option: settings.show_breakfast_option || "true",
      breakfast_menu_items: JSON.stringify(cleanItems)
    };

    api.post("/api/settings/", payload)
      .then(res => {
        if (res.data.settings) {
          setSettings(prev => ({ ...prev, ...res.data.settings }));
          setBreakfastMenuItems(cleanItems);
          setBreakfastSettingsSuccess("Breakfast configuration saved successfully!");
          setTimeout(() => setBreakfastSettingsSuccess(""), 5000);
        }
      })
      .catch(() => setBreakfastSettingsError("Failed to update breakfast configuration."))
      .finally(() => setUpdatingBreakfastSettings(false));
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

  const customStyles = `
    @media (max-width: 768px) {
      .top-bar {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 10px !important;
        padding: 16px 14px !important;
      }

      .mobile-role-selector-card {
        padding: 14px 16px !important;
      }

      .access-level-btn-group {
        display: flex !important;
        flex-direction: row !important;
        width: 100% !important;
      }

      .access-level-btn-group button {
        padding: 8px 2px !important;
        font-size: 0.7rem !important;
      }

      .config-card-form {
        padding: 16px 14px !important;
        gap: 14px !important;
      }

      .excel-upload-container {
        flex-direction: column !important;
        align-items: stretch !important;
      }

      .excel-upload-container input[type="file"] {
        max-width: 100% !important;
        width: 100% !important;
      }

      .excel-upload-container button {
        width: 100% !important;
        justify-content: center !important;
      }

      .form-actions-row {
        width: 100% !important;
      }

      .form-actions-row button {
        width: 100% !important;
        justify-content: center !important;
      }

      .guide-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;

  return (
    <>
      <style>{customStyles}</style>

      <div className="top-bar">
        <div>
          <h1 style={{ margin: 0 }}>Role Assigner & Permissions</h1>
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            Manage role-based page privileges & system parameters
          </span>
        </div>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
          <div className="guide-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
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
              <form onSubmit={handleSaveTeamSettings} className="config-card-form" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                  🏆 Camp Game Teams Name
                </h4>

                {teamSuccess && <div className="alert alert-success" style={{ margin: "4px 0 8px" }}>🎉 {teamSuccess}</div>}
                {teamError && <div className="alert alert-error" style={{ margin: "4px 0 8px" }}>⚠️ {teamError}</div>}
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

                <div className="form-group" style={{ margin: "8px 0", padding: "12px 14px", background: "rgba(180, 151, 90, 0.05)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", color: "var(--forest)" }}>
                    <input 
                      type="checkbox"
                      checked={settings.teams_published !== "false"}
                      onChange={e => setSettings(prev => ({ ...prev, teams_published: e.target.checked ? "true" : "false" }))}
                      style={{ width: 18, height: 18, accentColor: "var(--forest)" }}
                    />
                    <span>👁️ Show Team Names on Campers Page (Publish Teams)</span>
                  </label>
                  <span className="text-muted" style={{ fontSize: "0.78rem", marginLeft: 28, marginTop: 4, display: "block" }}>
                    When checked, team badges are visible to everyone on the Campers page. When unchecked, team names are hidden on the Campers page except for users with Team Selection access.
                  </span>
                </div>
                
                <div className="form-actions-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={updatingTeams}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {updatingTeams ? "Saving Teams…" : "Save Teams Configuration"}
                  </button>
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
                  <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8, fontWeight: 700 }}>
                    📁 Import Team Assignments from Excel (.xlsx)
                  </h4>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 12 }}>
                    Upload an Excel sheet containing camper names and assigned teams to automatically match campers and update their database team assignments.
                  </p>

                  {uploadError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{uploadError}</div>}
                  {uploadResult && (
                    <div className="alert alert-success" style={{ marginBottom: 12 }}>
                      🎉 {uploadResult.message} (Updated: {uploadResult.updated})
                      {uploadResult.unmatched && uploadResult.unmatched.length > 0 && (
                        <div style={{ fontSize: "0.75rem", marginTop: 4, color: "var(--red)" }}>
                          Unmatched names ({uploadResult.unmatched.length}): {uploadResult.unmatched.slice(0, 5).join(", ")}{uploadResult.unmatched.length > 5 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="excel-upload-container" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <input 
                      type="file" 
                      accept=".xlsx" 
                      onChange={e => setUploadFile(e.target.files[0])}
                      className="form-input" 
                      style={{ padding: "6px 12px", flex: 1, maxWidth: 360 }}
                    />
                    <button
                      type="button"
                      onClick={handleUploadExcel}
                      disabled={uploadingExcel || !uploadFile}
                      className="btn btn-secondary"
                      style={{ padding: "8px 18px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {uploadingExcel ? "Importing Teams..." : "📤 Upload & Sync Team Assignments"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Card 2b: Check-In Configurations */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div
              onClick={() => setIsCheckinSettingsOpen(!isCheckinSettingsOpen)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isCheckinSettingsOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isCheckinSettingsOpen ? "0px" : "8px",
                borderBottomRightRadius: isCheckinSettingsOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                ✅ Check-In Configurations
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isCheckinSettingsOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isCheckinSettingsOpen && (
              <form onSubmit={handleSaveCheckinSettings} className="config-card-form" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                  📝 Waiver Form
                </h4>

                {checkinSettingsSuccess && <div className="alert alert-success" style={{ margin: "4px 0 8px" }}>🎉 {checkinSettingsSuccess}</div>}
                {checkinSettingsError && <div className="alert alert-error" style={{ margin: "4px 0 8px" }}>⚠️ {checkinSettingsError}</div>}

                <div className="form-group" style={{ margin: "8px 0", padding: "12px 14px", background: "rgba(180, 151, 90, 0.05)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", color: "var(--forest)" }}>
                    <input
                      type="checkbox"
                      checked={settings.require_waiver_confirmation !== "false"}
                      onChange={e => setSettings(prev => ({ ...prev, require_waiver_confirmation: e.target.checked ? "true" : "false" }))}
                      style={{ width: 18, height: 18, accentColor: "var(--forest)" }}
                    />
                    <span>📝 Require Waiver Form Confirmation at Check-In</span>
                  </label>
                  <span className="text-muted" style={{ fontSize: "0.78rem", marginLeft: 28, marginTop: 4, display: "block" }}>
                    When checked, staff must confirm a camper's waiver form was submitted (via a pop-up prompt) before they can be checked in. When unchecked, check-ins proceed immediately with no waiver prompt.
                  </span>
                </div>

                <div className="form-actions-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updatingCheckinSettings}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {updatingCheckinSettings ? "Saving…" : "Save Check-In Configuration"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2c: Sunday Breakfast Configuration */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div
              onClick={() => setIsBreakfastSettingsOpen(!isBreakfastSettingsOpen)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isBreakfastSettingsOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isBreakfastSettingsOpen ? "0px" : "8px",
                borderBottomRightRadius: isBreakfastSettingsOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                🥞 Sunday Breakfast Configuration
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isBreakfastSettingsOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isBreakfastSettingsOpen && (
              <form onSubmit={handleSaveBreakfastSettings} className="config-card-form" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {breakfastSettingsSuccess && <div className="alert alert-success" style={{ margin: "4px 0 8px" }}>🎉 {breakfastSettingsSuccess}</div>}
                {breakfastSettingsError && <div className="alert alert-error" style={{ margin: "4px 0 8px" }}>⚠️ {breakfastSettingsError}</div>}

                <div className="form-group" style={{ margin: "0 0 8px", padding: "12px 14px", background: "rgba(180, 151, 90, 0.05)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", color: "var(--forest)" }}>
                    <input
                      type="checkbox"
                      checked={settings.show_breakfast_option !== "false"}
                      onChange={e => setSettings(prev => ({ ...prev, show_breakfast_option: e.target.checked ? "true" : "false" }))}
                      style={{ width: 18, height: 18, accentColor: "var(--forest)" }}
                    />
                    <span>🥞 Ask About Sunday Breakfast at Check-In</span>
                  </label>
                  <span className="text-muted" style={{ fontSize: "0.78rem", marginLeft: 28, marginTop: 4, display: "block" }}>
                    When checked, staff are prompted per-camper (right after a successful check-in) to ask if they need Sunday morning breakfast, and if so, which menu items. When unchecked, this prompt is skipped entirely.
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.82rem", color: "var(--forest-mid)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 6, fontWeight: 700 }}>
                    🍽️ Breakfast Menu Items
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {breakfastMenuItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="form-input"
                          value={item}
                          onChange={e => handleBreakfastItemChange(idx, e.target.value)}
                          placeholder="e.g. Pancakes"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakfastItem(idx)}
                          className="btn btn-ghost"
                          title="Remove this item"
                          style={{ padding: "6px 10px", color: "var(--danger)", border: "1px dashed var(--border)" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBreakfastItem}
                    className="btn btn-outline"
                    style={{ marginTop: 10, padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    ➕ Add Menu Item
                  </button>
                </div>

                <div className="form-actions-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updatingBreakfastSettings}
                    style={{ padding: "8px 24px", fontSize: "0.85rem" }}
                  >
                    {updatingBreakfastSettings ? "Saving…" : "Save Breakfast Configuration"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2d: Breakfast Orders Summary */}
          <div className="card" style={{ padding: 0, overflow: "visible" }}>
            <div
              onClick={() => setIsBreakfastSummaryOpen(!isBreakfastSummaryOpen)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(180, 151, 90, 0.04)",
                borderBottom: isBreakfastSummaryOpen ? "1px solid var(--border)" : "none",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottomLeftRadius: isBreakfastSummaryOpen ? "0px" : "8px",
                borderBottomRightRadius: isBreakfastSummaryOpen ? "0px" : "8px",
                userSelect: "none"
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                📊 Breakfast Orders Summary
              </h3>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                {isBreakfastSummaryOpen ? "▲ Collapse" : "▼ Expand"}
              </span>
            </div>

            {isBreakfastSummaryOpen && (
              <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                    Live counts from everyone asked at check-in so far.
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleExportBreakfastPDF}
                      className="btn btn-outline"
                      disabled={!breakfastSummary}
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      📄 Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={fetchBreakfastSummary}
                      className="btn btn-outline"
                      disabled={loadingBreakfastSummary}
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      {loadingBreakfastSummary ? "Refreshing…" : "🔄 Refresh"}
                    </button>
                  </div>
                </div>

                {breakfastSummary ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div className="stat-card">
                        <div className="label">Campers Asked</div>
                        <div className="value" style={{ fontSize: "1.5rem" }}>{breakfastSummary.total_answered}</div>
                      </div>
                      <div className="stat-card green-accent">
                        <div className="label">Want Breakfast</div>
                        <div className="value" style={{ fontSize: "1.5rem" }}>{breakfastSummary.total_wants_breakfast}</div>
                      </div>
                    </div>

                    {/* Mismatch check: want breakfast but no items selected */}
                    {(() => {
                      const noItems = (breakfastSummary.family_breakdown || []).filter(
                        group => Object.keys(group.items || {}).length === 0
                      );
                      const affectedCount = noItems.reduce((sum, g) => sum + g.members.length, 0);
                      if (breakfastSummary.total_wants_breakfast === 0) return null;
                      if (noItems.length > 0) {
                        return (
                          <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8, padding: "12px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 6, fontSize: "0.9rem" }}>
                              ⚠️ Order mismatch — {affectedCount} camper{affectedCount !== 1 ? "s" : ""} want breakfast but have no items specified
                            </div>
                            <ul style={{ margin: "0 0 4px 0", paddingLeft: 18, fontSize: "0.83rem", color: "#78350F", display: "flex", flexDirection: "column", gap: 2 }}>
                              {noItems.map((group, i) => (
                                <li key={i}>
                                  {group.family_group ? <strong>Family #{group.family_group}:</strong> : <strong>Individual:</strong>} {group.members.join(", ")}
                                </li>
                              ))}
                            </ul>
                            <div style={{ fontSize: "0.78rem", color: "#92400E", marginTop: 4 }}>
                              Ask these campers to re-confirm their breakfast items at check-in.
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", fontSize: "0.85rem", color: "#065F46", fontWeight: 600 }}>
                          ✅ All {breakfastSummary.total_wants_breakfast} camper{breakfastSummary.total_wants_breakfast !== 1 ? "s" : ""} who want breakfast have items selected.
                        </div>
                      );
                    })()}

                    {Object.keys(breakfastSummary.item_totals || {}).length > 0 ? (
                      <div className="table-wrap">
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Menu Item</th>
                              <th style={{ textAlign: "right" }}>Total Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(breakfastSummary.item_totals).map(([name, count]) => (
                              <tr key={name}>
                                <td>{name}</td>
                                <td style={{ textAlign: "right", fontWeight: 700 }}>{count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-muted" style={{ fontSize: "0.85rem" }}>No breakfast selections recorded yet.</div>
                    )}

                    {(breakfastSummary.family_breakdown || []).length > 0 && (
                      <div className="table-wrap" style={{ marginTop: 16 }}>
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Family</th>
                              <th>Camper Name(s)</th>
                              <th>Order</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakfastSummary.family_breakdown.map(group => (
                              <tr key={group.family_group || group.members.join(",")}>
                                <td>{group.family_group ? `Family #${group.family_group}` : "Individual"}</td>
                                <td>{group.members.join(", ")}</td>
                                <td>
                                  {Object.entries(group.items || {}).length > 0
                                    ? Object.entries(group.items).map(([name, count]) => `${count}x ${name}`).join(", ")
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {loadingBreakfastSummary ? "Loading…" : "No data yet — click Refresh."}
                  </div>
                )}
              </div>
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
              <form onSubmit={handleCreateRole} className="config-card-form" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
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

                <div className="form-actions-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
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
