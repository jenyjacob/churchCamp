import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function CheckInPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("checkin", "edit");
  const [search, setSearch] = useState("");
  const [campers, setCampers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [stats, setStats] = useState({ total_registered: 0, checked_in: 0, waivers_submitted: 0 });
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
  const [allCampers, setAllCampers] = useState([]);
  const [checkedInSummary, setCheckedInSummary] = useState(null); // array of campers recently checked in
  const [settings, setSettings] = useState({ team_1_name: "Team Peter", team_2_name: "Team Paul" });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [waiverModal, setWaiverModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    warningMessage: "",
    showWarning: false,
    onConfirm: null
  });

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const toggleGroupExpand = (fg) => {
    setExpandedGroups(prev => ({
      ...prev,
      [fg]: prev[fg] === false ? true : false
    }));
  };

  const fetchActive = useCallback(() => {
    setLoadingActive(true);
    api.get("/api/checkin/?active_only=true&per_page=50")
      .then(r => setActiveCheckins(r.data.checkins))
      .catch(() => {})
      .finally(() => setLoadingActive(false));
  }, []);

  const fetchStats = useCallback(() => {
    api.get("/api/campers/stats")
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  const fetchAllCampers = useCallback(() => {
    api.get("/api/campers/?page=1&per_page=-1")
      .then(r => setAllCampers(r.data.campers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchActive();
    fetchStats();
    fetchAllCampers();
    
    // Fetch dynamic configurations
    api.get("/api/settings/")
      .then(res => {
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      })
      .catch(() => {});
  }, [fetchActive, fetchStats, fetchAllCampers]);

  const searchCampers = useCallback(() => {
    if (!search.trim()) {
      setCampers([]);
      return;
    }
    setSearching(true);
    api.get(`/api/campers/?search=${encodeURIComponent(search)}&per_page=15`)
      .then(r => setCampers(r.data.campers))
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(searchCampers, 300);
    return () => clearTimeout(t);
  }, [searchCampers]);

  const performCheckIn = async (camperId, fullName) => {
    try {
      await api.post("/api/checkin/", { camper_id: camperId });
      flash("success", `✅ ${fullName} checked in successfully!`);
      
      const camperDetails = allCampers.find(c => c.id === camperId);
      if (camperDetails) {
        setCheckedInSummary([camperDetails]);
      }

      setSearch("");
      setCampers([]);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-in failed.");
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckIn = (camper) => {
    if (camper.waiver_submitted) {
      performCheckIn(camper.id, camper.full_name);
      return;
    }
    setWaiverModal({
      isOpen: true,
      title: "Waiver Form Confirmation",
      message: `Has ${camper.full_name} submitted their waiver form?`,
      warningMessage: `Please ask ${camper.full_name} to submit the waiver form before checking in.`,
      showWarning: false,
      onConfirm: () => performCheckIn(camper.id, camper.full_name)
    });
  };

  const performCheckInFamily = async (familyGroup, uncheckedCampers) => {
    try {
      // Execute sequentially to avoid concurrent database deadlock locks in MySQL
      for (const c of uncheckedCampers) {
        await api.post("/api/checkin/", { camper_id: c.id });
      }
      flash("success", `✅ Family Group ${familyGroup} checked in successfully (${uncheckedCampers.length} members)!`);
      
      const detailsList = uncheckedCampers.map(uc => allCampers.find(c => c.id === uc.id)).filter(Boolean);
      if (detailsList.length > 0) {
        setCheckedInSummary(detailsList);
      }

      setSearch("");
      setCampers([]);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", "Failed to check in all family members.");
      fetchActive();
      fetchStats();
      fetchAllCampers();
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckInFamily = (familyGroup, uncheckedCampers) => {
    const isWaiverSubmitted = uncheckedCampers.some(c => c.waiver_submitted);
    if (isWaiverSubmitted) {
      performCheckInFamily(familyGroup, uncheckedCampers);
      return;
    }
    const names = uncheckedCampers.map(c => c.full_name).join(", ");
    setWaiverModal({
      isOpen: true,
      title: "Waiver Form Confirmation",
      message: `Have all members of Family Group ${familyGroup} (${names}) submitted their waiver forms?`,
      warningMessage: "Please ask all family members to submit their waiver forms before checking in.",
      showWarning: false,
      onConfirm: () => performCheckInFamily(familyGroup, uncheckedCampers)
    });
  };

  const handleCheckOut = async (checkin) => {
    try {
      await api.post(`/api/checkin/${checkin.id}/checkout`);
      flash("success", `👋 ${checkin.camper_name} checked out.`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-out failed.");
    }
  };

  const handleCheckOutGroup = async (fg, cis) => {
    if (!window.confirm(`Are you sure you want to check out all ${cis.length} members of Family #${fg}?`)) {
      return;
    }
    try {
      await Promise.all(cis.map(ci => api.post(`/api/checkin/${ci.id}/checkout`)));
      flash("success", `👋 Family #${fg} group checked out (${cis.length} campers).`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", "One or more check-outs failed during group checkout.");
      fetchActive();
      fetchStats();
      fetchAllCampers();
    }
  };

  const handleResetCheckIn = async (checkin) => {
    if (!window.confirm(`Are you sure you want to reset the check-in for ${checkin.camper_name}? This will completely delete the check-in record.`)) {
      return;
    }
    try {
      await api.delete(`/api/checkin/${checkin.id}`);
      flash("success", `🔄 Checked-in status reset for ${checkin.camper_name}.`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", err.response?.data?.error || "Failed to reset check-in.");
    }
  };

  // Extract unique family groups present in the search results
  const uniqueFamilyGroups = [...new Set(campers.map(c => c.family_group).filter(Boolean))];

  return (
    <>
      <div className="top-bar">
        <h1>Check-In / Check-Out</h1>
        <span className="text-muted">
          {activeCheckins.length} camper{activeCheckins.length !== 1 ? "s" : ""} on site
        </span>
      </div>

      <div className="page-body">
        {message && (
          <div className={`alert alert-${message.type === "success" ? "success" : "error"}`}>
            {message.text}
          </div>
        )}

        {/* Statistics Row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>✅</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--forest-mid)" }}>{stats.checked_in}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Checked In Campers</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>📝</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--gold)" }}>{stats.waivers_submitted}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Waiver Forms Submitted</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>👥</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--charcoal)" }}>{Math.max(0, stats.total_registered - stats.checked_in)}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Remaining Check-Ins</div>
            </div>
          </div>
        </div>

        <div className="checkin-grid">
          {/* Left: Check In */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ color: "var(--forest)", fontSize: "1rem", marginBottom: 16 }}>
                ✅ Check In
              </h3>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Search Camper or Family Group</label>
                <div className="search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    className="form-input"
                    placeholder="Search by name or Family Group (e.g. 101)…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {searching && <p className="text-muted" style={{ marginTop: 8 }}>Searching…</p>}

              {campers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {/* Family Group Quick Check-In Panels */}
                  {uniqueFamilyGroups.map(fg => {
                    const familyCampers = allCampers.filter(c => c.family_group === fg);
                    const uncheckedFamilyCampers = familyCampers.filter(c => !c.checked_in);
                    
                    if (uncheckedFamilyCampers.length === 0) return null;
                    
                    return (
                      <div key={fg} style={{
                        background: "rgba(30, 77, 43, 0.04)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "12px 16px",
                        marginBottom: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <div className="tooltip-container">
                            <div style={{ fontWeight: 600, color: "var(--forest)", display: "flex", alignItems: "center", gap: 4 }}>
                              Family Group {fg} <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>ℹ️</span>
                            </div>
                            <div className="tooltip-content">
                              <strong style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, marginBottom: 4 }}>
                                Family Members ({familyCampers.length}):
                              </strong>
                              {familyCampers.map(c => (
                                <div key={c.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", margin: "2px 0" }}>
                                  <span>{c.full_name}</span>
                                  <span style={{ fontSize: "0.75rem" }}>
                                    {c.checked_in ? "🟢 Checked In" : "⚪ Not Checked In"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {uncheckedFamilyCampers.length} of {familyCampers.length} members not checked in
                          </div>
                        </div>
                        {canEdit && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCheckInFamily(fg, uncheckedFamilyCampers)}
                          >
                            Check In All
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Individual Camper List */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                    {campers.map((c, i) => (
                      <div key={c.id} style={{
                        padding: "12px 16px",
                        borderBottom: i < campers.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--white)",
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                          <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                            {c.family_group && `Family ${c.family_group} · `}
                            {c.cabin_group && `${c.cabin_group} · `}
                            {c.team_name && `${c.team_name} · `}
                            {c.age && `Age ${c.age}`}
                          </div>
                          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                            <span className={`badge badge-${c.registration_status === "registered" ? "green" : "gray"}`}>
                              {c.registration_status}
                            </span>
                            {c.checked_in && <span className="badge badge-blue">Already In</span>}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckIn(c)}
                          disabled={!canEdit || c.checked_in}
                        >
                          {c.checked_in ? "Checked In" : "Check In"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {search && !searching && campers.length === 0 && (
                <p className="text-muted" style={{ marginTop: 8 }}>No campers found matching "{search}".</p>
              )}
            </div>
          </div>

          {/* Right: Currently Checked In */}
          <div>
            <div className="card">
              <h3 style={{ color: "var(--forest)", fontSize: "1rem", marginBottom: 16 }}>
                🏕️ Currently On Site ({activeCheckins.length})
              </h3>

              {loadingActive ? (
                <p className="text-muted">Loading…</p>
              ) : activeCheckins.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏕️</div>
                  <p className="text-muted">No campers checked in yet.</p>
                </div>
              ) : (
                (() => {
                  const groups = {};
                  const individuals = [];

                  activeCheckins.forEach(ci => {
                    if (ci.family_group) {
                      if (!groups[ci.family_group]) {
                        groups[ci.family_group] = [];
                      }
                      groups[ci.family_group].push(ci);
                    } else {
                      individuals.push(ci);
                    }
                  });

                  const sortedGroupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Collapsible Groups */}
                      {sortedGroupKeys.map(fg => {
                        const cis = groups[fg];
                        const isExpanded = expandedGroups[fg] !== false;
                        return (
                          <div key={`group-${fg}`} style={{
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md, 8px)",
                            background: "#fff",
                            overflow: "visible",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                          }}>
                            <div 
                              onClick={() => toggleGroupExpand(fg)}
                              style={{
                                padding: "10px 14px",
                                background: "rgba(180, 151, 90, 0.05)",
                                borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                                borderTopLeftRadius: "7px",
                                borderTopRightRadius: "7px",
                                borderBottomLeftRadius: isExpanded ? "0px" : "7px",
                                borderBottomRightRadius: isExpanded ? "0px" : "7px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                userSelect: "none"
                              }}
                            >
                              <div className="tooltip-container tooltip-bottom">
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--forest)", display: "flex", alignItems: "center", gap: 6 }}>
                                  👨‍👩‍👧‍👦 Family #{fg}
                                  <span className="badge badge-gray" style={{ fontSize: "0.65rem", padding: "1px 5px", color: "var(--forest)" }}>
                                    {cis.length} on site
                                  </span>
                                </span>
                                <div className="tooltip-content" style={{ pointerEvents: "none" }}>
                                  <strong style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, marginBottom: 4 }}>
                                    Currently On Site ({cis.length}):
                                  </strong>
                                  {cis.map(ci => (
                                    <div key={ci.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", margin: "2px 0" }}>
                                      <span>{ci.camper_name}</span>
                                      <span style={{ fontSize: "0.75rem", color: "#a7f3d0" }}>🟢 In</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, minWidth: 68 }}
                                  disabled={!canEdit}
                                  title={`Check out all members of Family #${fg}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCheckOutGroup(fg, cis);
                                  }}
                                >
                                  Check Out Group
                                </button>
                                <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                                  {isExpanded ? "▲ Collapse" : "▼ Expand"}
                                </span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "#fdfdfb" }}>
                                {cis.map(ci => (
                                  <div key={ci.id} style={{
                                    padding: "8px 12px",
                                    border: "1px solid #f1f0ea",
                                    borderRadius: "6px",
                                    background: "#fff",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                  }}>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--dark)" }}>{ci.camper_name}</div>
                                      <div className="text-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                                        In {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        {ci.checked_in_by && ` · by ${ci.checked_in_by}`}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, minWidth: 68 }}
                                        onClick={(e) => { e.stopPropagation(); handleCheckOut(ci); }}
                                        disabled={!canEdit}
                                      >
                                        Check Out
                                      </button>
                                      {canEdit && (
                                        <button
                                          className="btn btn-danger btn-sm"
                                          style={{ padding: "2px 6px", fontSize: "0.7rem", height: 24, minWidth: "auto" }}
                                          title="Reset Check-In"
                                          onClick={(e) => { e.stopPropagation(); handleResetCheckIn(ci); }}
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Individuals List */}
                      {individuals.map(ci => (
                        <div key={ci.id} style={{
                          padding: "10px 14px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md, 8px)",
                          background: "var(--cream)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--dark)" }}>{ci.camper_name}</div>
                            <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                              In {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {ci.checked_in_by && ` · by ${ci.checked_in_by}`}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24 }}
                              onClick={() => handleCheckOut(ci)}
                              disabled={!canEdit}
                            >
                              Check Out
                            </button>
                            {canEdit && (
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: "2px 6px", fontSize: "0.7rem", height: 24, minWidth: "auto" }}
                                title="Reset Check-In"
                                onClick={() => handleResetCheckIn(ci)}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Waiver Confirmation Dialog Box */}
      {waiverModal.isOpen && (
        <div className="waiver-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          backdropFilter: "blur(2px)"
        }}>
          <div className="waiver-modal-content" style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "480px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            borderTop: "5px solid var(--forest)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--forest)", fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              📝 {waiverModal.title}
            </h3>
            
            {!waiverModal.showWarning ? (
              <>
                <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                  {waiverModal.message}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => setWaiverModal(prev => ({ ...prev, showWarning: true }))}
                    style={{ padding: "8px 16px" }}
                  >
                    No, Not Yet
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={waiverModal.onConfirm}
                    style={{ padding: "8px 16px" }}
                  >
                    Yes, Confirmed
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  background: "#fffbeb", 
                  borderLeft: "4px solid #d97706", 
                  padding: "12px 16px", 
                  borderRadius: "4px", 
                  marginBottom: 20,
                  fontSize: "0.88rem",
                  color: "#92400e",
                  lineHeight: 1.4
                }}>
                  ⚠️ {waiverModal.warningMessage}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setWaiverModal({ isOpen: false })}
                    style={{ padding: "8px 16px" }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Check-In Details Confirmation Modal */}
      {checkedInSummary && checkedInSummary.length > 0 && (
        <div className="waiver-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          backdropFilter: "blur(2px)"
        }}>
          <div className="waiver-modal-content" style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "520px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            borderTop: "5px solid var(--forest)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--forest)", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              🎉 Check-In Successful!
            </h3>
            
            <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Please confirm the following assignments and details with the camper:
            </p>

            <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {checkedInSummary.map(camper => (
                <div key={camper.id} style={{ 
                  border: "1px solid var(--border)", 
                  borderRadius: "8px", 
                  padding: "14px", 
                  background: "rgba(34, 76, 56, 0.02)" 
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--forest)", marginBottom: 8 }}>
                    👤 {camper.full_name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.85rem" }}>
                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        Cabin / Room
                      </span>
                      <strong style={{ color: "var(--charcoal)" }}>
                        {camper.cabin_group || "Not Assigned"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        T-Shirt Size
                      </span>
                      <strong style={{ color: "var(--charcoal)" }}>
                        {camper.tshirt_size || camper.indian_size ? (
                          <>
                            {camper.tshirt_size && `${camper.tshirt_size} (US)`}
                            {camper.tshirt_size && camper.indian_size && " / "}
                            {camper.indian_size && `${camper.indian_size} (IN)`}
                          </>
                        ) : (
                          "None Selected"
                        )}
                      </strong>
                    </div>
                    <div style={{ gridColumn: "span 2", marginTop: 4 }}>
                      <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        Team
                      </span>
                      <span className={`badge ${
                        camper.team_name === (settings.team_1_name || "Team Peter") 
                          ? "badge-gold" 
                          : camper.team_name === (settings.team_2_name || "Team Paul") 
                          ? "badge-blue" 
                          : "badge-gray"
                      }`} style={{ display: "inline-block", marginTop: 4, padding: "4px 8px", fontSize: "0.8rem", fontWeight: 700 }}>
                        🏆 {camper.team_name || "Not Allocated Yet"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setCheckedInSummary(null)}
                style={{ padding: "10px 24px", fontWeight: 600 }}
              >
                Complete & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
