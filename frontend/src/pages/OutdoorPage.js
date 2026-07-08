import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

export default function OutdoorPage() {
  const [campers, setCampers] = useState([]);
  const [totalKayaking, setTotalKayaking] = useState(0);
  const [totalBoatTour, setTotalBoatTour] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [flashMessage, setFlashMessage] = useState(null);
  
  // Edit Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    camper: null,
    kayaking: 0,
    boatTour: 0,
    saving: false
  });

  // Add Participant Modal State
  const [allCampers, setAllCampers] = useState([]);
  const [addModal, setAddModal] = useState({
    isOpen: false,
    selectedCamperId: "",
    kayaking: 0,
    boatTour: 0,
    saving: false
  });

  const handleOpenAddModal = async () => {
    try {
      const res = await api.get("/api/campers/?per_page=1000");
      setAllCampers(res.data.campers || []);
      setAddModal({
        isOpen: true,
        selectedCamperId: "",
        kayaking: 0,
        boatTour: 0,
        saving: false
      });
    } catch (err) {
      showFlash("error", "Failed to fetch campers list.");
    }
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const { selectedCamperId, kayaking, boatTour } = addModal;
    if (!selectedCamperId) {
      showFlash("error", "Please select a camper.");
      return;
    }
    const camper = allCampers.find(c => c.id === parseInt(selectedCamperId, 10));
    if (!camper) return;

    setAddModal(prev => ({ ...prev, saving: true }));
    try {
      await api.put(`/api/campers/${camper.id}`, {
        ...camper,
        kayaking: parseInt(kayaking, 10) || 0,
        boat_tour: parseInt(boatTour, 10) || 0
      });
      showFlash("success", `Registered outdoor activities for ${camper.full_name}.`);
      setAddModal({ isOpen: false, selectedCamperId: "", kayaking: 0, boatTour: 0, saving: false });
      fetchOutdoorData();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to register camper.");
      setAddModal(prev => ({ ...prev, saving: false }));
    }
  };

  const fetchOutdoorData = useCallback(() => {
    setLoading(true);
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

  const handleEditClick = (camper) => {
    setEditModal({
      isOpen: true,
      camper,
      kayaking: camper.kayaking || 0,
      boatTour: camper.boat_tour || 0,
      saving: false
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const { camper, kayaking, boatTour } = editModal;
    if (!camper) return;

    setEditModal(prev => ({ ...prev, saving: true }));
    try {
      await api.put(`/api/campers/${camper.id}`, {
        ...camper,
        kayaking: parseInt(kayaking, 10) || 0,
        boat_tour: parseInt(boatTour, 10) || 0
      });
      showFlash("success", `Updated activity slots for ${camper.full_name}.`);
      setEditModal({ isOpen: false, camper: null, kayaking: 0, boatTour: 0, saving: false });
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
        <span className="text-muted">Manage Kayaking and Boat Tour reservations and participants</span>
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
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>🛶</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--forest-mid)" }}>{totalKayaking}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Total Kayaking Spots</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "2rem" }}>🚤</div>
            <div>
              <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--gold)" }}>{totalBoatTour}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>Total Boat Tour Spots</div>
            </div>
          </div>
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
              <button
                className="btn btn-forest"
                onClick={handleOpenAddModal}
                style={{ padding: "0 16px", height: "38px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600 }}
              >
                <span>➕</span> Add Participant
              </button>
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
                    <th style={{ textAlign: "center" }}>🛶 Kayaking</th>
                    <th style={{ textAlign: "center" }}>🚤 Boat Tour</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                      <td style={{ textAlign: "center", fontWeight: c.kayaking > 0 ? 700 : 400, color: c.kayaking > 0 ? "var(--forest-mid)" : "inherit" }}>
                        {c.kayaking > 0 ? `${c.kayaking} spots` : "—"}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: c.boat_tour > 0 ? 700 : 400, color: c.boat_tour > 0 ? "var(--gold)" : "inherit" }}>
                        {c.boat_tour > 0 ? `${c.boat_tour} spots` : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEditClick(c)}
                        >
                          Edit Spots
                        </button>
                      </td>
                    </tr>
                  ))}
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
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>🛶 Kayaking Spots</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={editModal.kayaking}
                  onChange={e => setEditModal(prev => ({ ...prev, kayaking: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>🚤 Boat Tour Spots</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={editModal.boatTour}
                  onChange={e => setEditModal(prev => ({ ...prev, boatTour: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={editModal.saving}
                  onClick={() => setEditModal({ isOpen: false, camper: null, kayaking: 0, boatTour: 0, saving: false })}
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
                    .filter(c => c.kayaking === 0 && c.boat_tour === 0)
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} {c.family_group ? `(Family #${c.family_group})` : ""}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>🛶 Kayaking Spots</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={addModal.kayaking}
                  onChange={e => setAddModal(prev => ({ ...prev, kayaking: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>🚤 Boat Tour Spots</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={addModal.boatTour}
                  onChange={e => setAddModal(prev => ({ ...prev, boatTour: e.target.value }))}
                />
              </div>

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
    </>
  );
}
