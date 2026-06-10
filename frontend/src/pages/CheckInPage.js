import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

export default function CheckInPage() {
  const [search, setSearch] = useState("");
  const [campers, setCampers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
  const [notes, setNotes] = useState("");

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

  useEffect(() => { fetchActive(); }, [fetchActive]);

  const searchCampers = useCallback(() => {
    if (!search.trim()) { setCampers([]); return; }
    setSearching(true);
    api.get(`/api/campers/?search=${encodeURIComponent(search)}&per_page=10`)
      .then(r => setCampers(r.data.campers))
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(searchCampers, 300);
    return () => clearTimeout(t);
  }, [searchCampers]);

  const handleCheckIn = async (camper) => {
    try {
      await api.post("/api/checkin/", { camper_id: camper.id, notes });
      flash("success", `✅ ${camper.full_name} checked in successfully!`);
      setSearch("");
      setCampers([]);
      setNotes("");
      fetchActive();
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-in failed.");
    }
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Left: Check In */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ color: "var(--forest)", fontSize: "1rem", marginBottom: 16 }}>
                ✅ Check In a Camper
              </h3>

              <div className="form-group">
                <label className="form-label">Search Camper</label>
                <div className="search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    className="form-input"
                    placeholder="Type name to search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any notes for this check-in…"
                  rows={2}
                />
              </div>

              {searching && <p className="text-muted" style={{ marginTop: 8 }}>Searching…</p>}

              {campers.length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginTop: 8 }}>
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
                        <div className="text-muted">
                          {c.cabin_group && `${c.cabin_group} · `}
                          {c.session && `${c.session} · `}
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
                        {ci.notes && <div className="text-muted" style={{ fontStyle: "italic", fontSize: "0.75rem" }}>{ci.notes}</div>}
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
    </>
  );
}
