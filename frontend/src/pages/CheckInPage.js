import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

export default function CheckInPage() {
  const [search, setSearch] = useState("");
  const [campers, setCampers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
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

  const fetchActive = useCallback(() => {
    setLoadingActive(true);
    api.get("/api/checkin/?active_only=true&per_page=50")
      .then(r => setActiveCheckins(r.data.checkins))
      .catch(() => {})
      .finally(() => setLoadingActive(false));
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

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
      setSearch("");
      setCampers([]);
      fetchActive();
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-in failed.");
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckIn = (camper) => {
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
      await Promise.all(
        uncheckedCampers.map(c => api.post("/api/checkin/", { camper_id: c.id }))
      );
      flash("success", `✅ Family Group ${familyGroup} checked in successfully (${uncheckedCampers.length} members)!`);
      setSearch("");
      setCampers([]);
      fetchActive();
    } catch (err) {
      flash("error", "Failed to check in all family members.");
      fetchActive();
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckInFamily = (familyGroup, uncheckedCampers) => {
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
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-out failed.");
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
                    const familyCampers = campers.filter(c => c.family_group === fg);
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
                          <div style={{ fontWeight: 600, color: "var(--forest)" }}>Family Group {fg}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {uncheckedFamilyCampers.length} of {familyCampers.length} members not checked in
                          </div>
                        </div>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckInFamily(fg, uncheckedFamilyCampers)}
                        >
                          Check In All
                        </button>
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
                          disabled={c.checked_in}
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
                <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeCheckins.map(ci => (
                    <div key={ci.id} style={{
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--cream)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{ci.camper_name}</div>
                        <div className="text-muted">
                          In at {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {ci.checked_in_by && ` · by ${ci.checked_in_by}`}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleCheckOut(ci)}
                      >
                        Check Out
                      </button>
                    </div>
                  ))}
                </div>
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
    </>
  );
}
