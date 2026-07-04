import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function CabinsPage() {
  const { isAdmin } = useAuth();
  
  // Campers data state
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
  
  // UI filter & layout state
  const [search, setSearch] = useState("");
  
  // Custom cabins defined by the user on the fly or fetched
  const [cabins, setCabins] = useState([]);
  const [newCabinName, setNewCabinName] = useState("");
  const [draggedCamperId, setDraggedCamperId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  
  // State for active menu popup on camper cards
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Success/error helper
  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Fetch campers
  const fetchCampers = useCallback(() => {
    setLoading(true);
    // Request a large page size to get all campers for assignment
    api.get("/api/campers/?per_page=1000&status=registered")
      .then(r => {
        const camperList = r.data.campers;
        setCampers(camperList);

        // Extract unique cabins from campers
        const uniqueCabins = [...new Set(camperList.map(c => c.cabin_group).filter(Boolean))];
        setCabins(prev => {
          // Merge existing manual cabins with newly loaded ones
          const merged = [...new Set([...prev, ...uniqueCabins])];
          return merged.sort();
        });
      })
      .catch(() => setError("Failed to load campers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCampers();
  }, [fetchCampers]);

  // Handle assigning camper to cabin group
  const assignCabin = async (camperId, cabinName) => {
    // Find the camper
    const camper = campers.find(c => c.id === camperId);
    if (!camper) return;

    const previousCabin = camper.cabin_group;
    
    // Optimistically update frontend state
    setCampers(prev => prev.map(c => {
      if (c.id === camperId) {
        return { ...c, cabin_group: cabinName };
      }
      return c;
    }));

    try {
      await api.put(`/api/campers/${camperId}`, { cabin_group: cabinName });
      flash("success", `✅ ${camper.full_name} moved to ${cabinName || "Unassigned"}.`);
    } catch (err) {
      // Revert if API fails
      setCampers(prev => prev.map(c => {
        if (c.id === camperId) {
          return { ...c, cabin_group: previousCabin };
        }
        return c;
      }));
      flash("error", err.response?.data?.error || "Failed to assign cabin.");
    }
  };

  // Add new cabin column
  const handleAddCabin = (e) => {
    e.preventDefault();
    const name = newCabinName.trim();
    if (!name) return;
    if (cabins.includes(name)) {
      flash("error", "Cabin name already exists.");
      return;
    }
    setCabins(prev => [...prev, name].sort());
    setNewCabinName("");
    flash("success", `⛺ Cabin "${name}" added to board.`);
  };

  // Delete cabin (only if empty)
  const handleDeleteCabin = (cabinName) => {
    const hasCampers = campers.some(c => c.cabin_group === cabinName);
    if (hasCampers) {
      alert("Cannot delete cabin while it still contains campers. Reassign them first!");
      return;
    }
    setCabins(prev => prev.filter(c => c !== cabinName));
    flash("success", `Deleted empty cabin "${cabinName}".`);
  };

  // Drag & drop handlers
  const handleDragStart = (e, camperId) => {
    if (!isAdmin) {
      e.preventDefault();
      return;
    }
    setDraggedCamperId(camperId);
    e.dataTransfer.setData("text/plain", camperId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetCabinName) => {
    e.preventDefault();
    setDragOverColumn(null);
    const camperId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (camperId && draggedCamperId === camperId) {
      assignCabin(camperId, targetCabinName);
    }
    setDraggedCamperId(null);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Filter campers by search query
  const filteredCampers = campers.filter(c => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(query) ||
      c.last_name.toLowerCase().includes(query) ||
      (c.cabin_group && c.cabin_group.toLowerCase().includes(query))
    );
  });

  // Group campers by cabin group
  const getCampersInCabin = (cabinName) => {
    return filteredCampers.filter(c => c.cabin_group === cabinName);
  };

  const unassignedCampers = filteredCampers.filter(c => !c.cabin_group);

  // Compute stats for a camper list
  const getStats = (list) => {
    const total = list.length;
    const male = list.filter(c => c.gender === "male").length;
    const female = list.filter(c => c.gender === "female").length;
    const ages = list.map(c => c.age).filter(Boolean);
    const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;
    
    return { total, male, female, avgAge };
  };

  return (
    <>
      <div className="top-bar">
        <h1>Cabin & Group Assignment</h1>
        <span className="text-muted">
          {filteredCampers.length} camper{filteredCampers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        {/* Filters and Add Cabin Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Search Input */}
            <div className="search-input-wrap" style={{ width: 240 }}>
              <span className="search-icon">🔍</span>
              <input
                className="form-input"
                placeholder="Search camper in board…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingTop: 8, paddingBottom: 8 }}
              />
            </div>
          </div>

          {/* Add Cabin Form */}
          {isAdmin && (
            <form onSubmit={handleAddCabin} style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                placeholder="New cabin name…"
                value={newCabinName}
                onChange={e => setNewCabinName(e.target.value)}
                style={{ width: 180, paddingTop: 8, paddingBottom: 8 }}
              />
              <button type="submit" className="btn btn-outline" style={{ padding: "8px 16px", height: "38px" }}>
                ⛺ Add Cabin
              </button>
            </form>
          )}
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 40, flex: 1 }}>
            <div className="spinner" style={{ borderTopColor: "var(--forest-mid)", border: "3px solid #eee", width: 36, height: 36, margin: "0 auto" }} />
          </div>
        ) : (
          <div className="board-container">
            {/* COLUMN: Unassigned */}
            <div 
              className={`board-column ${dragOverColumn === "unassigned" ? "drag-over" : ""}`}
              onDragOver={e => handleDragOver(e, "unassigned")}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, "")}
            >
              <div className="board-column-header" style={{ borderTopColor: "var(--border)" }}>
                <div className="board-column-title">
                  <h3>Unassigned</h3>
                  <span className="badge badge-gray">{unassignedCampers.length}</span>
                </div>
                <div className="board-column-stats">
                  <span>{getStats(unassignedCampers).male} M</span>
                  <span>·</span>
                  <span>{getStats(unassignedCampers).female} F</span>
                  {getStats(unassignedCampers).avgAge && (
                    <>
                      <span>·</span>
                      <span>Avg Age: {getStats(unassignedCampers).avgAge}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="board-cards-list">
                {unassignedCampers.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: "0.8rem" }}>
                    All campers assigned.
                  </div>
                ) : (
                  unassignedCampers.map(c => (
                    <CamperCard 
                      key={c.id} 
                      camper={c} 
                      isAdmin={isAdmin}
                      cabins={cabins}
                      onDragStart={handleDragStart}
                      onAssign={assignCabin}
                      activeMenuId={activeMenuId}
                      setActiveMenuId={setActiveMenuId}
                    />
                  ))
                )}
              </div>
            </div>

            {/* COLUMNS: Defined Cabins */}
            {cabins.map(cabinName => {
              const cabinCampers = getCampersInCabin(cabinName);
              const stats = getStats(cabinCampers);
              const isOver = dragOverColumn === cabinName;

              return (
                <div 
                  key={cabinName}
                  className={`board-column ${isOver ? "drag-over" : ""}`}
                  onDragOver={e => handleDragOver(e, cabinName)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, cabinName)}
                >
                  <div className="board-column-header" style={{ borderTop: "3px solid var(--forest-lt)" }}>
                    <div className="board-column-title">
                      <h3>{cabinName}</h3>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span className="badge badge-green">{cabinCampers.length}</span>
                        {isAdmin && cabinCampers.length === 0 && (
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ padding: "0 4px", fontSize: "0.85rem", height: 18, color: "var(--danger)" }}
                            onClick={() => handleDeleteCabin(cabinName)}
                            title="Delete Cabin Column"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="board-column-stats">
                      <span>{stats.male} M</span>
                      <span>·</span>
                      <span>{stats.female} F</span>
                      {stats.avgAge && (
                        <>
                          <span>·</span>
                          <span>Avg Age: {stats.avgAge}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="board-cards-list">
                    {cabinCampers.length === 0 ? (
                      <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: "0.8rem", border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
                        Drag campers here
                      </div>
                    ) : (
                      cabinCampers.map(c => (
                        <CamperCard 
                          key={c.id} 
                          camper={c} 
                          isAdmin={isAdmin}
                          cabins={cabins}
                          onDragStart={handleDragStart}
                          onAssign={assignCabin}
                          activeMenuId={activeMenuId}
                          setActiveMenuId={setActiveMenuId}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// Sub-component for individual Camper Cards
function CamperCard({ camper, isAdmin, cabins, onDragStart, onAssign, activeMenuId, setActiveMenuId }) {
  const isMenuOpen = activeMenuId === camper.id;

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (isMenuOpen) {
      setActiveMenuId(null);
    } else {
      setActiveMenuId(camper.id);
    }
  };

  const getGenderIcon = (gender) => {
    if (gender === "male") return <span style={{ color: "#3182ce" }} title="Boy">♂️</span>;
    if (gender === "female") return <span style={{ color: "#dd6b20" }} title="Girl">♀️</span>;
    return <span style={{ color: "var(--muted)" }} title="Other">👤</span>;
  };

  return (
    <div 
      className="camper-card"
      draggable={isAdmin}
      onDragStart={e => onDragStart(e, camper.id)}
      style={{ opacity: camper.gender === "female" ? 0.95 : 1 }}
    >
      <div className="camper-card-header">
        <div className="camper-card-name" title={camper.full_name}>
          {camper.full_name}
        </div>
        
        {isAdmin && (
          <div className="camper-card-actions">
            <button className="camper-card-menu-btn" onClick={toggleMenu}>
              ⋮
            </button>
            {isMenuOpen && (
              <div className="camper-card-menu">
                {camper.cabin_group && (
                  <button 
                    type="button"
                    className="camper-card-menu-item"
                    onClick={() => onAssign(camper.id, "")}
                  >
                    🚫 Unassign
                  </button>
                )}
                {cabins.filter(c => c !== camper.cabin_group).map(cabinName => (
                  <button
                    key={cabinName}
                    type="button"
                    className="camper-card-menu-item"
                    onClick={() => onAssign(camper.id, cabinName)}
                  >
                    ⛺ To {cabinName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="camper-card-details">
        {getGenderIcon(camper.gender)}
        {camper.age && <span>{camper.age} yrs</span>}
      </div>

      {camper.allergies && (
        <div className="text-muted" style={{ fontSize: "0.7rem", marginTop: 4, color: "var(--danger)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`Allergies: ${camper.allergies}`}>
          ⚠️ {camper.allergies}
        </div>
      )}
    </div>
  );
}
