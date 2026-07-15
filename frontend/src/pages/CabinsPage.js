import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// Helper to parse cabin group string into cabin name and room name
const parseCabinGroup = (cabinGroupString) => {
  if (!cabinGroupString) return { cabin: "", room: "" };
  const parts = cabinGroupString.split(" | ");
  if (parts.length === 2) {
    return { cabin: parts[0].strip ? parts[0].strip() : parts[0].trim(), room: parts[1].strip ? parts[1].strip() : parts[1].trim() };
  }
  return { cabin: cabinGroupString.trim(), room: "General" };
};

export default function CabinsPage() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("cabins", "edit");
  
  // Campers data state
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
  
  // UI filter state
  const [search, setSearch] = useState("");
  const [newCabinName, setNewCabinName] = useState("");
  
  // Cabins config: loaded from localStorage, or defaults, merged on data fetch
  const [cabinsConfig, setCabinsConfig] = useState(() => {
    // Run a one-time reset check to clear previous defaults
    const isReset = localStorage.getItem("gca_cabins_reset_v4");
    if (!isReset) {
      localStorage.removeItem("gca_cabins_config");
      localStorage.setItem("gca_cabins_reset_v4", "true");
    }

    const saved = localStorage.getItem("gca_cabins_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback below
      }
    }
    return [];
  });

  const [dragOverBox, setDragOverBox] = useState(null); // e.g., "Cabin A | Room 1"

  // Success/error flash helper
  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const saveConfig = (newConfig) => {
    setCabinsConfig(newConfig);
    localStorage.setItem("gca_cabins_config", JSON.stringify(newConfig));
  };

  // Fetch campers and merge any active cabin/room mappings dynamically
  const fetchCampers = useCallback(() => {
    setLoading(true);
    api.get("/api/campers/?per_page=1000&status=registered")
      .then(r => {
        const camperList = r.data.campers;
        setCampers(camperList);

        // Merge any cabin/room values from DB into config if they are missing
        setCabinsConfig(prev => {
          let updated = [...prev];
          camperList.forEach(c => {
            if (c.cabin_group) {
              const { cabin, room } = parseCabinGroup(c.cabin_group);
              if (cabin && room) {
                // Find or add cabin
                let cab = updated.find(cb => cb.name.toLowerCase() === cabin.toLowerCase());
                if (!cab) {
                  cab = { name: cabin, rooms: [room] };
                  updated.push(cab);
                } else if (!cab.rooms.map(rm => rm.toLowerCase()).includes(room.toLowerCase())) {
                  cab.rooms.push(room);
                }
              }
            }
          });

          // Sort cabins and rooms alphabetically/numerically
          updated = updated.map(cb => ({
            ...cb,
            rooms: [...cb.rooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

          localStorage.setItem("gca_cabins_config", JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => setError("Failed to load campers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCampers();
  }, [fetchCampers]);

  // Handle assigning camper to cabin/room
  const assignCabin = async (camperId, cabinName, roomName) => {
    const camper = campers.find(c => c.id === camperId);
    if (!camper) return;

    const previousCabinGroup = camper.cabin_group;
    const targetValue = cabinName && roomName ? `${cabinName} | ${roomName}` : "";

    // Optimistically update local state
    setCampers(prev => prev.map(c => {
      if (c.id === camperId) {
        return { ...c, cabin_group: targetValue };
      }
      return c;
    }));

    try {
      await api.put(`/api/campers/${camperId}`, { cabin_group: targetValue });
      if (targetValue) {
        flash("success", `Moved ${camper.first_name} ${camper.last_name} to ${cabinName} - ${roomName}.`);
      } else {
        flash("success", `Unassigned ${camper.first_name} ${camper.last_name}.`);
      }
    } catch (err) {
      // Revert state
      setCampers(prev => prev.map(c => {
        if (c.id === camperId) {
          return { ...c, cabin_group: previousCabinGroup };
        }
        return c;
      }));
      flash("error", err.response?.data?.error || "Failed to update assignment.");
    }
  };

  // Assign multiple family members to the same cabin room
  const assignFamily = async (camperIds, cabinName, roomName) => {
    const targetValue = cabinName && roomName ? `${cabinName} | ${roomName}` : "";
    
    // Save original state of family members for rollback
    const originalState = campers.filter(c => camperIds.includes(c.id));

    // Optimistically update
    setCampers(prev => prev.map(c => {
      if (camperIds.includes(c.id)) {
        return { ...c, cabin_group: targetValue };
      }
      return c;
    }));

    try {
      await Promise.all(camperIds.map(id => api.put(`/api/campers/${id}`, { cabin_group: targetValue })));
      if (targetValue) {
        flash("success", `Assigned family members to ${cabinName} - ${roomName}.`);
      } else {
        flash("success", `Unassigned family members.`);
      }
    } catch (err) {
      // Rollback
      setCampers(prev => prev.map(c => {
        const orig = originalState.find(o => o.id === c.id);
        if (orig) {
          return { ...c, cabin_group: orig.cabin_group };
        }
        return c;
      }));
      flash("error", "Failed to assign family group.");
    }
  };

  // Add a new cabin
  const handleAddCabin = (e) => {
    e.preventDefault();
    const name = newCabinName.trim();
    if (!name) return;
    if (cabinsConfig.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      flash("error", "Cabin name already exists.");
      return;
    }
    const newConfig = [...cabinsConfig, { name, rooms: [] }].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    saveConfig(newConfig);
    setNewCabinName("");
    flash("success", `Created cabin "${name}".`);
  };

  // Delete a cabin (only if all rooms inside are empty)
  const handleDeleteCabin = (cabinName) => {
    const cabinCampers = campers.filter(c => {
      const { cabin } = parseCabinGroup(c.cabin_group);
      return cabin.toLowerCase() === cabinName.toLowerCase();
    });

    if (cabinCampers.length > 0) {
      alert("Cannot delete cabin. Make sure all rooms inside this cabin are empty first!");
      return;
    }

    const newConfig = cabinsConfig.filter(c => c.name.toLowerCase() !== cabinName.toLowerCase());
    saveConfig(newConfig);
    flash("success", `Deleted empty cabin "${cabinName}".`);
  };

  // Add room to cabin
  const handleAddRoom = (cabinName) => {
    const roomName = prompt(`Enter new Room name for ${cabinName}:`, "Room X");
    if (!roomName || !roomName.trim()) return;

    const newConfig = cabinsConfig.map(c => {
      if (c.name.toLowerCase() === cabinName.toLowerCase()) {
        if (c.rooms.map(r => r.toLowerCase()).includes(roomName.trim().toLowerCase())) {
          alert("Room name already exists inside this cabin.");
          return c;
        }
        const updatedRooms = [...c.rooms, roomName.trim()].sort((a, b) => 
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
        return { ...c, rooms: updatedRooms };
      }
      return c;
    });

    saveConfig(newConfig);
    flash("success", `Added "${roomName.trim()}" to ${cabinName}.`);
  };

  // Delete room from cabin (only if empty)
  const handleDeleteRoom = (cabinName, roomName) => {
    const roomCampers = campers.filter(c => {
      const { cabin, room } = parseCabinGroup(c.cabin_group);
      return cabin.toLowerCase() === cabinName.toLowerCase() && room.toLowerCase() === roomName.toLowerCase();
    });

    if (roomCampers.length > 0) {
      alert("Cannot delete room while it has campers assigned to it.");
      return;
    }

    const newConfig = cabinsConfig.map(c => {
      if (c.name.toLowerCase() === cabinName.toLowerCase()) {
        return { ...c, rooms: c.rooms.filter(r => r.toLowerCase() !== roomName.toLowerCase()) };
      }
      return c;
    });

    saveConfig(newConfig);
    flash("success", `Deleted empty room "${roomName}" from ${cabinName}.`);
  };

  // Drag and drop setup
  const handleDragStart = (e, dragType, data) => {
    if (!isAdmin) {
      e.preventDefault();
      return;
    }
    const dragPayload = { type: dragType, ...data };
    e.dataTransfer.setData("application/json", JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, boxId) => {
    e.preventDefault();
    if (dragOverBox !== boxId) {
      setDragOverBox(boxId);
    }
  };

  const handleDragLeave = () => {
    setDragOverBox(null);
  };

  const handleDrop = async (e, targetCabin, targetRoom) => {
    e.preventDefault();
    setDragOverBox(null);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const dragPayload = JSON.parse(dataStr);

      if (dragPayload.type === "single") {
        await assignCabin(dragPayload.id, targetCabin, targetRoom);
      } else if (dragPayload.type === "family") {
        await assignFamily(dragPayload.ids, targetCabin, targetRoom);
      }
    } catch (err) {
      console.error("Drop operation failed", err);
    }
  };

  // Search filtering
  const filteredCampers = (() => {
    if (!search.trim()) return campers;
    const query = search.toLowerCase();
    const matchingFamilyGroups = new Set(
      campers
        .filter(c => 
          c.first_name.toLowerCase().includes(query) ||
          c.last_name.toLowerCase().includes(query) ||
          (c.family_group && c.family_group.toLowerCase().includes(query))
        )
        .map(c => c.family_group)
        .filter(Boolean)
    );
    return campers.filter(c => {
      const matchesSearch = 
        c.first_name.toLowerCase().includes(query) ||
        c.last_name.toLowerCase().includes(query) ||
        (c.family_group && c.family_group.toLowerCase().includes(query));
      const belongsToMatchingFamily = c.family_group && matchingFamilyGroups.has(c.family_group);
      return matchesSearch || belongsToMatchingFamily;
    });
  })();

  // Extract unassigned campers and group them by Family Group
  const unassignedCampers = filteredCampers.filter(c => !c.cabin_group);
  const unassignedList = [];
  const groupedIds = new Set();

  unassignedCampers.forEach(c => {
    if (groupedIds.has(c.id)) return;

    if (c.family_group) {
      const familyMembers = unassignedCampers.filter(m => m.family_group === c.family_group);
      familyMembers.forEach(m => groupedIds.add(m.id));
      unassignedList.push({
        type: "family",
        id: c.family_group,
        familyName: familyMembers.find(m => m.guardian_name && m.guardian_name !== "Self")?.last_name || c.last_name,
        members: familyMembers
      });
    } else {
      groupedIds.add(c.id);
      unassignedList.push({
        type: "single",
        id: c.id,
        camper: c
      });
    }
  });

  // Retrieve assigned campers for a specific room
  const getRoomOccupants = (cabinName, roomName) => {
    return campers.filter(c => {
      if (!c.cabin_group) return false;
      const { cabin, room } = parseCabinGroup(c.cabin_group);
      return cabin.toLowerCase() === cabinName.toLowerCase() && room.toLowerCase() === roomName.toLowerCase();
    });
  };

  // Evaluate room status/occupancy badge
  const getRoomStatus = (occupants) => {
    if (occupants.length === 0) return { label: "Empty", class: "badge-empty" };
    if (occupants.length === 1) return { label: "Single", class: "badge-single" };

    const firstFamily = occupants[0].family_group;
    const isSingleFamily = firstFamily && occupants.every(o => o.family_group === firstFamily);
    if (isSingleFamily) {
      return { label: `Family (F#${firstFamily})`, class: "badge-family" };
    }
    return { label: "Shared", class: "badge-mixed" };
  };

  // Helper selector dropdown for assigning campers without drag-and-drop
  const CabinRoomSelector = ({ camperIds, currentCabin, currentRoom }) => {
    if (!isAdmin) return null;
    return (
      <select 
        className="form-select selector-box"
        value={currentCabin && currentRoom ? `${currentCabin} | ${currentRoom}` : ""}
        onChange={(e) => {
          const val = e.target.value;
          if (!val) {
            if (camperIds.length === 1) assignCabin(camperIds[0], "", "");
            else assignFamily(camperIds, "", "");
          } else {
            const [cab, rm] = val.split(" | ");
            if (camperIds.length === 1) assignCabin(camperIds[0], cab, rm);
            else assignFamily(camperIds, cab, rm);
          }
        }}
      >
        <option value="">Move to...</option>
        {cabinsConfig.map(cb => (
          <optgroup key={cb.name} label={cb.name}>
            {cb.rooms.map(rm => (
              <option key={`${cb.name} | ${rm}`} value={`${cb.name} | ${rm}`}>
                {cb.name} — {rm}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  };

  // Injected CSS Styles for premium look and feel
  const customStyles = `
    .cabins-manager {
      display: grid;
      grid-template-columns: 330px 1fr;
      gap: 24px;
      height: calc(100vh - 150px);
      min-height: 520px;
    }

    .sidebar-panel {
      background: var(--white);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.01);
    }

    .sidebar-scrollable {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .workspace-panel {
      display: flex;
      flex-direction: column;
      gap: 24px;
      height: 100%;
      overflow-y: auto;
      padding-right: 8px;
    }

    .cabin-card {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .cabin-header {
      background: var(--forest);
      color: var(--white);
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--gold);
    }

    .cabin-header h3 {
      font-family: 'Playfair Display', serif;
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }

    .cabin-rooms-grid {
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .room-box {
      border: 1px dashed var(--border);
      border-radius: 12px;
      padding: 16px;
      background: var(--cream);
      display: flex;
      flex-direction: column;
      min-height: 150px;
      transition: all 0.2s ease;
      position: relative;
    }

    .room-box.drag-over {
      border-color: var(--forest);
      background: rgba(47, 82, 51, 0.08);
      transform: scale(1.015);
      box-shadow: 0 4px 12px rgba(47, 82, 51, 0.1);
    }

    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      padding-bottom: 6px;
    }

    .room-title {
      font-weight: 600;
      font-size: 0.92rem;
      color: var(--forest);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .room-status-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .badge-empty { background: rgba(0,0,0,0.06); color: #4b5563; }
    .badge-single { background: #dbeafe; color: #1e40af; }
    .badge-family { background: #f3e8ff; color: #6b21a8; }
    .badge-mixed { background: #fef3c7; color: #92400e; }

    .occupants-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    .occupant-item {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .occupant-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: var(--charcoal);
    }

    .family-group-card {
      background: linear-gradient(135deg, #fdfbf7 0%, #f7f1e6 100%);
      border: 1px solid var(--gold-lt);
      border-radius: 10px;
      padding: 14px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: grab;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .family-group-card:hover {
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      transform: translateY(-2px);
    }

    .family-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 0.85rem;
      color: #92400e;
      border-bottom: 1px solid rgba(146, 64, 14, 0.15);
      padding-bottom: 6px;
    }

    .single-camper-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      box-shadow: var(--shadow-sm);
      cursor: grab;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .single-camper-card:hover {
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      transform: translateY(-2px);
    }

    .selector-box {
      font-size: 0.72rem !important;
      padding: 4px 8px !important;
      height: 28px !important;
      width: 100% !important;
      margin-top: 8px !important;
    }

    @media (max-width: 820px) {
      .cabins-manager {
        grid-template-columns: 1fr;
        height: auto;
        min-height: auto;
        gap: 20px;
      }

      .sidebar-panel {
        height: 420px;
      }

      .workspace-panel {
        height: auto;
        overflow-y: visible;
        padding-right: 0;
      }
    }
  `;

  return (
    <>
      <style>{customStyles}</style>

      <div className="top-bar">
        <h1>Cabin Room Assigner</h1>
        <span className="text-muted">
          {campers.length} registered camper{campers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column" }}>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        {/* Global Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="search-input-wrap" style={{ width: 260 }}>
              <span className="search-icon">🔍</span>
              <input
                className="form-input"
                placeholder="Search by name or family ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingTop: 8, paddingBottom: 8 }}
              />
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={handleAddCabin} style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                placeholder="Cabin Name (e.g. Cabin D)…"
                value={newCabinName}
                onChange={e => setNewCabinName(e.target.value)}
                style={{ width: 200, paddingTop: 8, paddingBottom: 8 }}
              />
              <button type="submit" className="btn btn-outline" style={{ padding: "8px 16px", height: "38px" }}>
                ⛺ Add Cabin
              </button>
            </form>
          )}
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 60 }}>
            <div className="spinner" style={{ borderTopColor: "var(--forest-mid)", border: "3px solid #eee", width: 36, height: 36, margin: "0 auto" }} />
          </div>
        ) : (
          <div className="cabins-manager">
            {/* LEFT SIDEBAR: Unassigned list */}
            <div className="sidebar-panel">
              <div className="sidebar-header">
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--forest)", fontWeight: 600 }}>
                  Unassigned ({unassignedCampers.length})
                </h3>
                <p className="text-muted" style={{ fontSize: "0.78rem", margin: "4px 0 0 0" }}>
                  {isAdmin ? "Drag cards or use dropdowns to assign" : "Camper registrations waiting for assignments"}
                </p>
              </div>

              <div className="sidebar-scrollable">
                {unassignedList.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: "0.82rem" }}>
                    🎉 All registered campers assigned!
                  </div>
                ) : (
                  unassignedList.map(item => {
                    if (item.type === "family") {
                      const ids = item.members.map(m => m.id);
                      return (
                        <div 
                          key={`family-${item.id}`}
                          className="family-group-card"
                          draggable={isAdmin}
                          onDragStart={e => handleDragStart(e, "family", { ids, familyGroup: item.id })}
                        >
                          <div className="family-header">
                            <span>👨‍👩‍👧‍👦 Family #{item.id}</span>
                            <span style={{ fontSize: "0.75rem", fontStyle: "italic" }}>{item.familyName}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {item.members.map(m => (
                              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                                <span>
                                  {m.first_name} {m.last_name}
                                  {m.team_name && <span style={{ fontSize: "0.7rem", color: "var(--gold)", fontWeight: 700, marginLeft: 4 }}>({m.team_name})</span>}
                                </span>
                                <span className="text-muted">
                                  {m.age !== null && m.age !== undefined && m.age !== "" ? "Child" : "Adult"}
                                </span>
                              </div>
                            ))}
                          </div>
                          <CabinRoomSelector camperIds={ids} currentCabin="" currentRoom="" />
                        </div>
                      );
                    } else {
                      const c = item.camper;
                      return (
                        <div 
                          key={`single-${c.id}`}
                          className="single-camper-card"
                          draggable={isAdmin}
                          onDragStart={e => handleDragStart(e, "single", { id: c.id })}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--forest-mid)" }}>
                              👤 {c.first_name} {c.last_name}
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                {c.age !== null && c.age !== undefined && c.age !== "" ? "Child" : "Adult"}
                              </span>
                              {c.team_name && (
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gold)" }}>
                                  🏆 {c.team_name}
                                </span>
                              )}
                            </div>
                          </div>
                          {c.allergies && (
                            <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                              ⚠️ Allergies: {c.allergies}
                            </span>
                          )}
                          <CabinRoomSelector camperIds={[c.id]} currentCabin="" currentRoom="" />
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>

            {/* RIGHT WORKSPACE: Cabins and rooms */}
            <div className="workspace-panel">
              {cabinsConfig.map(cabin => {
                const cabinCampers = campers.filter(c => {
                  if (!c.cabin_group) return false;
                  const { cabin: cabName } = parseCabinGroup(c.cabin_group);
                  return cabName.toLowerCase() === cabin.name.toLowerCase();
                });
                const cabinOccupancy = cabinCampers.length;

                return (
                  <div key={cabin.name} className="cabin-card">
                    <div className="cabin-header">
                      <div className="cabin-title-area">
                        <span>⛺</span>
                        <h3>{cabin.name}</h3>
                        <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "0.78rem", marginLeft: 12, padding: "2px 8px", borderRadius: 4 }}>
                          Occupants: {cabinOccupancy}
                        </span>
                      </div>
                      
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <button 
                            className="btn btn-gold btn-sm" 
                            style={{ padding: "4px 8px", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff" }}
                            onClick={() => handleAddRoom(cabin.name)}
                          >
                            ➕ Add Room
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: "4px 8px" }}
                            onClick={() => handleDeleteCabin(cabin.name)}
                          >
                            Delete Cabin
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="cabin-rooms-grid">
                      {cabin.rooms.length === 0 ? (
                        <div className="text-muted" style={{ padding: 12, fontSize: "0.85rem" }}>
                          No rooms defined. Click "Add Room" to create one.
                        </div>
                      ) : (
                        cabin.rooms.map(room => {
                          const occupants = getRoomOccupants(cabin.name, room);
                          const status = getRoomStatus(occupants);
                          const boxId = `${cabin.name} | ${room}`;
                          const isOver = dragOverBox === boxId;

                          return (
                            <div 
                              key={room}
                              className={`room-box ${isOver ? "drag-over" : ""}`}
                              onDragOver={e => handleDragOver(e, boxId)}
                              onDragLeave={handleDragLeave}
                              onDrop={e => handleDrop(e, cabin.name, room)}
                            >
                              <div className="room-header">
                                <span className="room-title">
                                  <span>🚪</span> {room} <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--muted)", marginLeft: 4 }}>({occupants.length})</span>
                                </span>
                                <span className={`room-status-badge ${status.class}`}>
                                  {status.label}
                                </span>
                              </div>

                              <div className="occupants-list">
                                {occupants.length === 0 ? (
                                  <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: "0.75rem", fontStyle: "italic", minHeight: 60 }}>
                                    Vacant
                                  </div>
                                ) : (
                                  occupants.map(occ => (
                                    <div key={occ.id} className="occupant-item">
                                      <div className="occupant-info">
                                        <span>{occ.gender === "male" ? "👦" : occ.gender === "female" ? "👧" : "👤"}</span>
                                        <span title={`${occ.first_name} ${occ.last_name}`}>
                                          {occ.first_name} {occ.last_name.charAt(0)}.
                                        </span>
                                        <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                          ({occ.age !== null && occ.age !== undefined && occ.age !== "" ? "Child" : "Adult"})
                                        </span>
                                        {occ.team_name && (
                                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--gold)", marginLeft: 4 }}>
                                            ({occ.team_name})
                                          </span>
                                        )}
                                      </div>
                                      
                                      {isAdmin && (
                                        <button 
                                          style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem", padding: "0 2px" }}
                                          onClick={() => assignCabin(occ.id, "", "")}
                                          title="Remove from room"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>

                              {isAdmin && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: 8 }}>
                                  {occupants.length === 0 && (
                                    <button 
                                      style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem" }}
                                      onClick={() => handleDeleteRoom(cabin.name, room)}
                                    >
                                      🗑️ Delete Room
                                    </button>
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <CabinRoomSelector 
                                      camperIds={occupants.map(o => o.id)} 
                                      currentCabin={cabin.name} 
                                      currentRoom={room} 
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
