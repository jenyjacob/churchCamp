import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const TSHIRT_SIZES = [
  "2T", "3T", "4T", "5T",
  "YXXS", "YXS", "YS", "YM", "YL", "YXL",
  "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"
];

export default function TShirtsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("apparel", "edit");
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingMap, setSavingMap] = useState({}); // { camperId: "saving" | "saved" | "error" }
  const [error, setError] = useState("");

  const fetchCampers = useCallback(() => {
    setLoading(true);
    // Fetch all campers (non-paginated) to display all families together
    api.get("/api/campers/?page=1&per_page=-1")
      .then(r => {
        setCampers(r.data.campers);
      })
      .catch(() => setError("Failed to load campers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCampers();
  }, [fetchCampers]);

  const handleSizeChange = async (camperId, newSize) => {
    setSavingMap(prev => ({ ...prev, [camperId]: "saving" }));
    try {
      await api.put(`/api/campers/${camperId}`, { tshirt_size: newSize });
      setSavingMap(prev => ({ ...prev, [camperId]: "saved" }));
      
      // Update local state
      setCampers(prev => prev.map(c => {
        if (c.id === camperId) {
          return { ...c, tshirt_size: newSize };
        }
        return c;
      }));

      // Clear the "saved" status after 2 seconds
      setTimeout(() => {
        setSavingMap(prev => {
          const updated = { ...prev };
          delete updated[camperId];
          return updated;
        });
      }, 2000);
    } catch {
      setSavingMap(prev => ({ ...prev, [camperId]: "error" }));
    }
  };

  // Filter campers based on search query
  const filteredCampers = campers.filter(c => {
    if (!search) return true;
    const query = search.toLowerCase();
    const nameMatch = c.full_name?.toLowerCase().includes(query);
    const familyMatch = c.family_group?.toLowerCase().includes(query);
    const guardianMatch = c.guardian_name?.toLowerCase().includes(query);
    return nameMatch || familyMatch || guardianMatch;
  });

  // Group campers by family
  const families = {};
  const individuals = [];
  filteredCampers.forEach(c => {
    if (c.family_group) {
      if (!families[c.family_group]) {
        families[c.family_group] = [];
      }
      families[c.family_group].push(c);
    } else {
      individuals.push(c);
    }
  });

  const sortedFamilyKeys = Object.keys(families).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Calculate size counts for the summary widget
  const sizeCounts = {};
  filteredCampers.forEach(c => {
    if (c.tshirt_size) {
      sizeCounts[c.tshirt_size] = (sizeCounts[c.tshirt_size] || 0) + 1;
    }
  });

  return (
    <>
      <div className="top-bar">
        <h1>Apparel</h1>
        <span className="text-muted">{campers.length} campers total</span>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="search-bar" style={{ marginBottom: 20 }}>
          <div className="search-input-wrap" style={{ flex: 1 }}>
            <span className="search-icon">🔍</span>
            <input
              className="form-input"
              placeholder="Search by name, family group, or guardian…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* T-Shirt Inventory/Order Summary Stats Widget */}
        {!loading && campers.length > 0 && (
          <div className="card" style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: "1rem", color: "var(--forest)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              👕 Apparel Order Summary
            </h3>
            {Object.keys(sizeCounts).length === 0 ? (
              <p className="text-muted" style={{ fontSize: "0.875rem" }}>No T-shirt sizes selected yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                {TSHIRT_SIZES.filter(sz => sizeCounts[sz]).map(sz => (
                  <div key={sz} style={{ 
                    background: "rgba(34, 76, 56, 0.03)", 
                    border: "1px solid var(--border)", 
                    borderRadius: "var(--radius-sm)", 
                    padding: "8px 12px", 
                    textAlign: "center" 
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest)" }}>{sz}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--charcoal)", marginTop: 4 }}>
                      {sizeCounts[sz]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center" style={{ padding: 48, color: "var(--muted)" }}>Loading campers…</div>
        ) : filteredCampers.length === 0 ? (
          <div className="text-center" style={{ padding: 48, color: "var(--muted)" }}>No matching campers found.</div>
        ) : (
          <div className="family-grid">
            {/* Render Families */}
            {sortedFamilyKeys.map(fg => {
              const members = families[fg];
              return (
                <div key={fg} className="family-card">
                  <div className="family-card-header">
                    <h3 className="family-card-title">👨‍👩‍👧‍👦 Family #{fg}</h3>
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>{members.length} members</span>
                  </div>
                  <div className="family-card-body">
                    {members.map(c => {
                      const savingStatus = savingMap[c.id];
                      return (
                        <div key={c.id} className="family-member-row" style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div className="family-member-name" style={{ fontWeight: 600 }}>{c.full_name}</div>
                              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                                {c.age ? `Age: ${c.age}` : ""} {c.cabin_group ? `| Cabin: ${c.cabin_group}` : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select 
                                className="form-select" 
                                style={{ width: 140, padding: "4px 8px", fontSize: "0.8rem", height: "auto" }}
                                value={c.tshirt_size || ""}
                                onChange={e => handleSizeChange(c.id, e.target.value)}
                                disabled={!canEdit}
                              >
                                <option value="">— Select Size —</option>
                                {TSHIRT_SIZES.map(sz => (
                                  <option key={sz} value={sz}>{sz}</option>
                                ))}
                              </select>
                              
                              {/* Status Indicators */}
                              {savingStatus === "saving" && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                              {savingStatus === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.9rem", fontWeight: 700 }}>✓</span>}
                              {savingStatus === "error" && <span style={{ color: "var(--red)", fontSize: "0.9rem", fontWeight: 700 }}>⚠️</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Render Individuals */}
            {individuals.length > 0 && (
              <div className="family-card" style={{ borderTop: "4px solid var(--forest)" }}>
                <div className="family-card-header" style={{ background: "rgba(34, 76, 56, 0.05)" }}>
                  <h3 className="family-card-title" style={{ color: "var(--forest)" }}>👤 Individual Registrations</h3>
                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>{individuals.length} members</span>
                </div>
                <div className="family-card-body">
                  {individuals.map(c => {
                    const savingStatus = savingMap[c.id];
                    return (
                      <div key={c.id} className="family-member-row" style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="family-member-name" style={{ fontWeight: 600 }}>{c.full_name}</div>
                            <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                              {c.age ? `Age: ${c.age}` : ""} {c.cabin_group ? `| Cabin: ${c.cabin_group}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <select 
                              className="form-select" 
                              style={{ width: 140, padding: "4px 8px", fontSize: "0.8rem", height: "auto" }}
                              value={c.tshirt_size || ""}
                              onChange={e => handleSizeChange(c.id, e.target.value)}
                              disabled={!canEdit}
                            >
                              <option value="">— Select Size —</option>
                              {TSHIRT_SIZES.map(sz => (
                                <option key={sz} value={sz}>{sz}</option>
                              ))}
                            </select>
                            
                            {/* Status Indicators */}
                            {savingStatus === "saving" && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                            {savingStatus === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.9rem", fontWeight: 700 }}>✓</span>}
                            {savingStatus === "error" && <span style={{ color: "var(--red)", fontSize: "0.9rem", fontWeight: 700 }}>⚠️</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
