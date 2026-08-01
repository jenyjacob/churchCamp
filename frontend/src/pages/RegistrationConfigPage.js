import React, { useEffect, useState } from "react";
import api from "../utils/api";

export default function RegistrationConfigPage() {
  const [allSettings, setAllSettings] = useState({});
  const [settings, setSettings] = useState({
    signup_title: "",
    signup_dates: "",
    signup_location: "",
    current_camp_year: "2026",
    signup_camp_year: "2026",
    registration_status: "open"
  });
  const [activitiesList, setActivitiesList] = useState(["KAYAKING", "BOAT TOUR"]);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    // Fetch current settings
    api.get("/api/settings/")
      .then(res => {
        if (res.data.settings) {
          setAllSettings(res.data.settings);
          setSettings(res.data.settings);
          
          const year = res.data.settings.signup_camp_year || "2026";
          const yearKey = "activity_names_" + year;
          const rawActivities = res.data.settings[yearKey] || res.data.settings.activity_names || '["KAYAKING", "BOAT TOUR"]';
          try {
            const parsed = JSON.parse(rawActivities);
            if (Array.isArray(parsed)) {
              setActivitiesList(parsed);
            }
          } catch (e) {}
        }
      })
      .catch(() => setError("Failed to load registration configurations."));

    // Resize listener
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update activitiesList when signup_camp_year changes
  useEffect(() => {
    const year = settings.signup_camp_year;
    if (!year) return;
    
    const yearKey = "activity_names_" + year;
    const rawActivities = allSettings[yearKey] || allSettings.activity_names || '["KAYAKING", "BOAT TOUR"]';
    try {
      const parsed = JSON.parse(rawActivities);
      if (Array.isArray(parsed)) {
        setActivitiesList(parsed);
      }
    } catch (e) {}
  }, [settings.signup_camp_year, allSettings]);

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

  const handleSave = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError("");
    setSuccess("");

    const status = settings.registration_status || "open";
    const year = settings.signup_camp_year || "2026";
    const yearKey = "activity_names_" + year;

    const payload = {
      signup_title: settings.signup_title,
      signup_dates: settings.signup_dates,
      signup_location: settings.signup_location,
      registration_status: status,
      registration_closed: status === "open" ? "false" : "true",
      current_camp_year: settings.current_camp_year || "2026",
      signup_camp_year: year
    };
    
    payload[yearKey] = JSON.stringify(activitiesList.filter(act => act.trim() !== ""));

    try {
      const res = await api.post("/api/settings/", payload);
      if (res.data.settings) {
        setAllSettings(res.data.settings);
        setSettings(res.data.settings);
      }
      setSuccess("Registration settings saved successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("Failed to update registration settings.");
    } finally {
      setUpdating(false);
    }
  };

  const customStyles = `
    @media (max-width: 768px) {
      .config-card-form {
        padding: 16px 14px !important;
        gap: 14px !important;
      }
      .form-actions-row button {
        width: 100% !important;
        justify-content: center !important;
      }
    }
  `;

  return (
    <>
      <style>{customStyles}</style>
      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px", maxWidth: 960, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", color: "var(--forest-dark)", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              ⚙️ Registration Page Configuration
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "4px 0 0 0" }}>
              Configure public sign-up dates, locations, years, availability, and activity checkboxes.
            </p>
          </div>
        </div>

        {success && <div className="alert alert-success" style={{ marginBottom: 20 }}>🎉 {success}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

        <div className="card" style={{ padding: 0, overflow: "visible", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ padding: "16px 20px", background: "rgba(180, 151, 90, 0.04)", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              📝 Public Signup Setup Form
            </h3>
          </div>

          <form onSubmit={handleSave} className="config-card-form" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
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
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Active Dashboard Camp Year</label>
                <input 
                  type="number"
                  className="form-input" 
                  value={settings.current_camp_year || "2026"} 
                  onChange={e => setSettings(prev => ({ ...prev, current_camp_year: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Public Signup Camp Year</label>
                <input 
                  type="number"
                  className="form-input" 
                  value={settings.signup_camp_year || "2026"} 
                  onChange={e => setSettings(prev => ({ ...prev, signup_camp_year: e.target.value }))}
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

            <div className="form-actions-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={updating}
                style={{ padding: "8px 24px", fontSize: "0.85rem" }}
              >
                {updating ? "Saving Settings…" : "Save Registration Config"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </>
  );
}
