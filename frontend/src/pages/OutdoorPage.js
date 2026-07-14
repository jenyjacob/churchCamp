import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function OutdoorPage() {
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission("outdoor", "edit");
  const isOwner = user?.role === "owner";

  // Helper functions for parsing additional activity spots from notes
  const parseCustomActivities = (notesStr) => {
    if (!notesStr) return {};
    const match = notesStr.match(/<!-- ACTIVITIES_JSON:\s*(.*?)\s*-->/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse custom activities:", e);
      }
    }
    return {};
  };

  const buildNotesWithActivities = (originalNotes, activitiesObj) => {
    const baseNotes = (originalNotes || "").replace(/<!-- ACTIVITIES_JSON:\s*(.*?)\s*-->/, "").trim();
    return `${baseNotes} <!-- ACTIVITIES_JSON: ${JSON.stringify(activitiesObj)} -->`.trim();
  };

  const [campers, setCampers] = useState([]);
  const [totalKayaking, setTotalKayaking] = useState(0);
  const [totalBoatTour, setTotalBoatTour] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [flashMessage, setFlashMessage] = useState(null);

  // Dynamic Activity Names
  const [activityNames, setActivityNames] = useState(["Kayaking", "Boat Tour"]);

  // Edit Activity Names Modal State
  const [editNamesModal, setEditNamesModal] = useState({
    isOpen: false,
    activities: [],
    saving: false
  });
  
  // Edit Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    camper: null,
    activities: {}, // Map of activity name -> spots (integer)
    saving: false
  });

  // Add Participant Modal State
  const [allCampers, setAllCampers] = useState([]);
  const [addModal, setAddModal] = useState({
    isOpen: false,
    selectedCamperId: "",
    activities: {}, // Map of activity name -> spots (integer)
    saving: false
  });

  const handleOpenAddModal = async () => {
    try {
      const res = await api.get("/api/campers/?per_page=1000");
      setAllCampers(res.data.campers || []);
      
      const initialActs = {};
      activityNames.forEach(name => {
        initialActs[name] = 0;
      });

      setAddModal({
        isOpen: true,
        selectedCamperId: "",
        activities: initialActs,
        saving: false
      });
    } catch (err) {
      showFlash("error", "Failed to fetch campers list.");
    }
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const { selectedCamperId, activities } = addModal;
    if (!selectedCamperId) {
      showFlash("error", "Please select a camper.");
      return;
    }
    const camper = allCampers.find(c => c.id === parseInt(selectedCamperId, 10));
    if (!camper) return;

    const spots1 = parseInt(activities[activityNames[0]], 10) || 0;
    const spots2 = parseInt(activities[activityNames[1]], 10) || 0;
    
    const customObj = {};
    for (let i = 2; i < activityNames.length; i++) {
      const name = activityNames[i];
      customObj[name] = parseInt(activities[name], 10) || 0;
    }
    const updatedNotes = buildNotesWithActivities(camper.notes, customObj);

    setAddModal(prev => ({ ...prev, saving: true }));
    try {
      await api.put(`/api/campers/${camper.id}`, {
        ...camper,
        kayaking: spots1,
        boat_tour: spots2,
        notes: updatedNotes
      });
      showFlash("success", `Registered outdoor activities for ${camper.full_name}.`);
      setAddModal({ isOpen: false, selectedCamperId: "", activities: {}, saving: false });
      fetchOutdoorData();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to register camper.");
      setAddModal(prev => ({ ...prev, saving: false }));
    }
  };

  const fetchOutdoorData = useCallback(() => {
    setLoading(true);

    // Fetch dynamic activity names
    api.get("/api/settings/public")
      .then(res => {
        const settings = res.data.settings || {};
        try {
          let list = JSON.parse(settings.activity_names || '["Kayaking", "Boat Tour"]');
          if (Array.isArray(list)) {
            if (list.length < 1 || !list[0]) list[0] = "Kayaking";
            if (list.length < 2 || !list[1]) list[1] = "Boat Tour";
            setActivityNames(list);
          }
        } catch (e) {
          console.error("Failed to parse activity names:", e);
        }
      })
      .catch(err => {
        console.error("Failed to fetch settings:", err);
      });

    api.get("/api/campers/outdoor")
      .then(res => {
        setCampers(res.data.campers || []);
        setTotalKayaking(res.data.total_kayaking || 0);
        setTotalBoatTour(res.data.total_boat_tour || 0);
      })
      .catch(err => {
        setError("Failed to fetch outdoor activity participants data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchOutdoorData();
  }, [fetchOutdoorData]);

  const showFlash = (type, text) => {
    setFlashMessage({ type, text });
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const handleModalActivityChange = (idx, value) => {
    setEditNamesModal(prev => {
      const updated = [...prev.activities];
      updated[idx] = value;
      return { ...prev, activities: updated };
    });
  };

  const handleModalAddActivity = () => {
    setEditNamesModal(prev => ({
      ...prev,
      activities: [...prev.activities, ""]
    }));
  };

  const handleModalRemoveActivity = (idx) => {
    setEditNamesModal(prev => {
      const updated = prev.activities.filter((_, i) => i !== idx);
      return { ...prev, activities: updated };
    });
  };

  const handleSaveActivityNames = async (e) => {
    e.preventDefault();
    const { activities } = editNamesModal;
    
    // Clean and validate
    const cleaned = activities.map(act => act.trim()).filter(Boolean);

    setEditNamesModal(prev => ({ ...prev, saving: true }));
    try {
      await api.post("/api/settings/", {
        activity_names: JSON.stringify(cleaned)
      });

      showFlash("success", "Activity configurations updated successfully.");
      setEditNamesModal({ isOpen: false, activities: [], saving: false });
      fetchOutdoorData();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to update activity names.");
      setEditNamesModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleEditClick = (camper) => {
    const customActs = parseCustomActivities(camper.notes);
    const initialActs = {};
    activityNames.forEach((name, idx) => {
      if (idx === 0) initialActs[name] = camper.kayaking || 0;
      else if (idx === 1) initialActs[name] = camper.boat_tour || 0;
      else initialActs[name] = customActs[name] || 0;
    });

    setEditModal({
      isOpen: true,
      camper,
      activities: initialActs,
      saving: false
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const { camper, activities } = editModal;
    if (!camper) return;

    const spots1 = parseInt(activities[activityNames[0]], 10) || 0;
    const spots2 = parseInt(activities[activityNames[1]], 10) || 0;
    
    const customObj = {};
    for (let i = 2; i < activityNames.length; i++) {
      const name = activityNames[i];
      customObj[name] = parseInt(activities[name], 10) || 0;
    }
    const updatedNotes = buildNotesWithActivities(camper.notes, customObj);

    setEditModal(prev => ({ ...prev, saving: true }));
    try {
      await api.put(`/api/campers/${camper.id}`, {
        ...camper,
        kayaking: spots1,
        boat_tour: spots2,
        notes: updatedNotes
      });
      showFlash("success", `Updated activity slots for ${camper.full_name}.`);
      setEditModal({ isOpen: false, camper: null, activities: {}, saving: false });
      fetchOutdoorData();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to update slots.");
      setEditModal(prev => ({ ...prev, saving: false }));
    }
  };

  // Filter campers
  const filteredCampers = campers.filter(c => {
    const term = search.toLowerCase();
    const nameMatch = c.full_name.toLowerCase().includes(term);
    const famMatch = c.family_group && c.family_group.toLowerCase().includes(term);
    return nameMatch || famMatch;
  });

  return (
    <>
      <div className="top-bar">
        <h1>🛶 Outdoor Activities</h1>
        <span className="text-muted">
          {activityNames.length > 0
            ? `Manage ${activityNames.join(" and ")} reservations and participants`
            : "Manage outdoor activities reservations and participants"
          }
        </span>
      </div>

      <div className="page-body">
        {flashMessage && (
          <div className={`alert alert-${flashMessage.type === "success" ? "success" : "error"}`} style={{ marginBottom: 20 }}>
            {flashMessage.text}
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Statistics Banner cards row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {activityNames.length >= 1 && (
            <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "2rem" }}>🛶</div>
              <div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--forest-mid)" }}>{totalKayaking}</div>
                <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Total {activityNames[0]} Spots</div>
              </div>
            </div>
          )}
          {activityNames.length >= 2 && (
            <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "2rem" }}>🚤</div>
              <div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--gold)" }}>{totalBoatTour}</div>
                <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Total {activityNames[1]} Spots</div>
              </div>
            </div>
          )}
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>👥</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--charcoal)" }}>{campers.length}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Participating Bookings</div>
            </div>
          </div>
        </div>

        {/* List Card */}
        <div className="card">
          <style>{`
            @media (max-width: 576px) {
              .outdoor-header {
                flex-direction: column;
                align-items: stretch !important;
                gap: 12px !important;
              }
              .outdoor-actions {
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: stretch !important;
                gap: 8px !important;
              }
              .outdoor-actions .search-box {
                max-width: none !important;
                width: 100% !important;
              }
              .outdoor-actions button {
                width: 100% !important;
                justify-content: center;
              }
            }
          `}</style>

          <div className="outdoor-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Reserved Spots List</h3>
            <div className="outdoor-actions" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="search-box" style={{ maxWidth: 280, width: "100%" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or family group..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {isOwner && (
                <button
                  className="btn btn-outline"
                  onClick={() => setEditNamesModal({
                    isOpen: true,
                    activities: [...activityNames],
                    saving: false
                  })}
                  style={{ padding: "0 16px", height: "38px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, border: "1px solid var(--forest)", color: "var(--forest)", background: "transparent", cursor: "pointer", borderRadius: "4px" }}
                >
                  <span>✏️</span> Edit Activity Names
                </button>
              )}
              {canEdit && (
                <button
                  className="btn btn-forest"
                  onClick={handleOpenAddModal}
                  style={{ padding: "0 16px", height: "38px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600 }}
                >
                  <span>➕</span> Add Participant
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-muted">Loading outdoor activities list...</p>
          ) : filteredCampers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🛶</div>
              <p className="text-muted">No reservations found.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Camper Name</th>
                    {activityNames.map((name, idx) => (
                      <th key={idx} style={{ textAlign: "center" }}>
                        {idx === 0 ? "🛶" : idx === 1 ? "🚤" : "🎯"} {name}
                      </th>
                    ))}
                    {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredCampers.map(c => {
                    const customActs = parseCustomActivities(c.notes);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                        {activityNames.map((name, idx) => {
                          let spots = 0;
                          if (idx === 0) spots = c.kayaking || 0;
                          else if (idx === 1) spots = c.boat_tour || 0;
                          else spots = customActs[name] || 0;

                          const colorClass = idx === 0 ? "var(--forest-mid)" : idx === 1 ? "var(--gold)" : "var(--primary)";
                          return (
                            <td key={idx} style={{ textAlign: "center", fontWeight: spots > 0 ? 700 : 400, color: spots > 0 ? colorClass : "inherit" }}>
                              {spots > 0 ? `${spots} spots` : "—"}
                            </td>
                          );
                        })}
                        {canEdit && (
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleEditClick(c)}
                            >
                              Edit Spots
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Spots Modal */}
      {editModal.isOpen && (
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
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "2px solid var(--forest)"
          }}>
            <h3 style={{ marginTop: 0, color: "var(--forest)", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              Edit Outdoor Spots
            </h3>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
              Adjust reservations for <strong>{editModal.camper?.full_name}</strong>
            </p>

            <form onSubmit={handleSaveEdit} style={{ marginTop: 20 }}>
              {activityNames.map((name, idx) => (
                <div className="form-group" style={{ marginBottom: 16 }} key={idx}>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {idx === 0 ? "🛶" : idx === 1 ? "🚤" : "🎯"} {name} Spots
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={editModal.activities[name] || 0}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setEditModal(prev => ({
                        ...prev,
                        activities: { ...prev.activities, [name]: val }
                      }));
                    }}
                  />
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={editModal.saving}
                  onClick={() => setEditModal({ isOpen: false, camper: null, activities: {}, saving: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-forest"
                  disabled={editModal.saving}
                >
                  {editModal.saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {addModal.isOpen && (
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
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "2px solid var(--forest)"
          }}>
            <h3 style={{ marginTop: 0, color: "var(--forest)", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              Add Activity Participant
            </h3>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
              Register a camper for outdoor activities
            </p>

            <form onSubmit={handleSaveAdd} style={{ marginTop: 20 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Select Camper</label>
                <select
                  className="form-control"
                  value={addModal.selectedCamperId}
                  onChange={e => setAddModal(prev => ({ ...prev, selectedCamperId: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Camper --</option>
                  {allCampers
                    .filter(c => {
                      const customActs = parseCustomActivities(c.notes);
                      const hasCustom = Object.values(customActs).some(v => v > 0);
                      return c.kayaking === 0 && c.boat_tour === 0 && !hasCustom;
                    })
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} {c.family_group ? `(Family #${c.family_group})` : ""}
                      </option>
                    ))
                  }
                </select>
              </div>

              {activityNames.map((name, idx) => (
                <div className="form-group" style={{ marginBottom: 16 }} key={idx}>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {idx === 0 ? "🛶" : idx === 1 ? "🚤" : "🎯"} {name} Spots
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={addModal.activities[name] || 0}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setAddModal(prev => ({
                        ...prev,
                        activities: { ...prev.activities, [name]: val }
                      }));
                    }}
                  />
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={addModal.saving}
                  onClick={() => setAddModal({ isOpen: false, selectedCamperId: "", kayaking: 0, boatTour: 0, saving: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-forest"
                  disabled={addModal.saving}
                >
                  {addModal.saving ? "Saving..." : "Add Participant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Activity Names Modal (Owner Only) */}
      {editNamesModal.isOpen && (
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
            maxWidth: "420px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "2px solid var(--forest)"
          }}>
            <h3 style={{ marginTop: 0, color: "var(--forest)", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              ✏️ Configure Activity Labels
            </h3>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4, marginBottom: 20 }}>
              Add, rename, or delete activities. The first two activities correspond to dynamic counters on this page, while additional items will be saved as custom camper notes.
            </p>

            <form onSubmit={handleSaveActivityNames} style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
              {editNamesModal.activities.map((activity, idx) => (
                <div key={idx} className="form-group" style={{ marginBottom: 16, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontWeight: 600, fontSize: "0.85rem" }}>Activity #{idx + 1} Name</label>
                    <button
                      type="button"
                      onClick={() => handleModalRemoveActivity(idx)}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    value={activity}
                    onChange={e => handleModalActivityChange(idx, e.target.value)}
                    placeholder={`e.g. Activity #${idx + 1}`}
                    required
                  />
                </div>
              ))}

              {editNamesModal.activities.length === 0 && (
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 8, color: "#64748b", fontSize: "0.85rem", textAlign: "center", marginBottom: 20 }}>
                  No activities configured.
                </div>
              )}

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleModalAddActivity}
                style={{ width: "100%", height: "36px", fontSize: "0.8rem", fontWeight: 600, border: "1px dashed var(--forest)", color: "var(--forest)", marginBottom: 24, cursor: "pointer" }}
              >
                + Add Activity Option
              </button>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={editNamesModal.saving}
                  onClick={() => setEditNamesModal({ isOpen: false, activities: [], saving: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-forest"
                  disabled={editNamesModal.saving}
                >
                  {editNamesModal.saving ? "Saving..." : "Save Customizations"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
