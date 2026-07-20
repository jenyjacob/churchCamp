import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const TSHIRT_SIZES = [
  "2T", "3T", "4T", "5T",
  "YXXS", "YXS", "YS", "YM", "YL", "YXL",
  "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"
];

const DEFAULT_INDIAN_SIZES = [
  "1-2 year", "3-4 year", "5-6 year", "7-8 year", "9-10 year", "11-12 year",
  "S", "M", "L", "XL", "2XL", "3XL",
  '52"', '56"', '68"'
];

export default function TShirtsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("apparel", "edit");
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingMap, setSavingMap] = useState({}); // { camperId: "saving" | "saved" | "error" }
  const [error, setError] = useState("");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Inventory & Choice Tabs
  const [sizeSystemTab, setSizeSystemTab] = useState("BOTH"); // "US" | "INDIAN" | "BOTH"
  const [stockUs, setStockUs] = useState({});
  const [stockIndian, setStockIndian] = useState({});
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [modalStockTab, setModalStockTab] = useState("US"); // "US" | "INDIAN"
  const [stockFormUs, setStockFormUs] = useState({});
  const [stockFormIndian, setStockFormIndian] = useState({});
  const [savingStock, setSavingStock] = useState(false);
  const [customIndianSizes, setCustomIndianSizes] = useState([]);

  const fetchSettings = useCallback(() => {
    api.get("/api/settings/")
      .then(res => {
        const settings = res.data.settings || {};
        try {
          if (settings.tshirt_stock_us) {
            setStockUs(JSON.parse(settings.tshirt_stock_us));
          }
          if (settings.tshirt_stock_indian) {
            setStockIndian(JSON.parse(settings.tshirt_stock_indian));
          }
          if (settings.custom_indian_sizes) {
            setCustomIndianSizes(JSON.parse(settings.custom_indian_sizes));
          }
        } catch (e) {
          console.error("Failed to parse stock settings", e);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddCustomSize = async (sizeName) => {
    const trimmed = sizeName?.trim();
    if (!trimmed) return;

    if (!customIndianSizes.includes(trimmed) && !DEFAULT_INDIAN_SIZES.includes(trimmed)) {
      const updated = [...customIndianSizes, trimmed];
      setCustomIndianSizes(updated);
      try {
        await api.post("/api/settings/", {
          custom_indian_sizes: JSON.stringify(updated)
        });
      } catch {
        setError("Failed to save custom Indian T-Shirt size.");
      }
    }
  };

  const activeIndianSizes = Array.from(
    new Set([
      ...DEFAULT_INDIAN_SIZES,
      ...customIndianSizes,
      ...campers.map(c => c.indian_size?.trim()).filter(Boolean)
    ])
  );

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
    fetchSettings();
  }, [fetchCampers, fetchSettings]);

  const handleOpenStockModal = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setStockFormUs({ ...stockUs });
    setStockFormIndian({ ...stockIndian });
    setIsStockModalOpen(true);
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    setSavingStock(true);
    try {
      await api.post("/api/settings/", {
        tshirt_stock_us: JSON.stringify(stockFormUs),
        tshirt_stock_indian: JSON.stringify(stockFormIndian)
      });
      setStockUs(stockFormUs);
      setStockIndian(stockFormIndian);
      setIsStockModalOpen(false);
    } catch {
      setError("Failed to save T-Shirt inventory stock limit settings.");
    } finally {
      setSavingStock(false);
    }
  };

  const handleTshirtUpdate = async (camperId, field, value) => {
    const key = `${camperId}-${field}`;
    setSavingMap(prev => ({ ...prev, [key]: "saving" }));
    try {
      await api.put(`/api/campers/${camperId}`, { [field]: value });
      setSavingMap(prev => ({ ...prev, [key]: "saved" }));
      
      setCampers(prev => prev.map(c => {
        if (c.id === camperId) {
          return { ...c, [field]: value };
        }
        return c;
      }));

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

  // Filter campers based on search query
  const filteredCampers = (() => {
    if (!search) return campers;
    const query = search.toLowerCase();
    const matchingFamilyGroups = new Set(
      campers
        .filter(c => 
          c.full_name?.toLowerCase().includes(query) ||
          c.family_group?.toLowerCase().includes(query) ||
          c.guardian_name?.toLowerCase().includes(query)
        )
        .map(c => c.family_group)
        .filter(Boolean)
    );
    return campers.filter(c => {
      const matchesSearch = 
        c.full_name?.toLowerCase().includes(query) ||
        c.family_group?.toLowerCase().includes(query) ||
        c.guardian_name?.toLowerCase().includes(query);
      const belongsToMatchingFamily = c.family_group && matchingFamilyGroups.has(c.family_group);
      return matchesSearch || belongsToMatchingFamily;
    });
  })();

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

  // Calculate size counts for the summary widget (both US and Indian sizes)
  const usSizeCounts = {};
  const indianSizeCounts = {};
  
  campers.forEach(c => {
    if (c.tshirt_size) {
      usSizeCounts[c.tshirt_size] = (usSizeCounts[c.tshirt_size] || 0) + 1;
    }
    if (c.indian_size) {
      const cleanInd = String(c.indian_size).trim().toUpperCase();
      if (cleanInd) {
        indianSizeCounts[cleanInd] = (indianSizeCounts[cleanInd] || 0) + 1;
      }
    }
  });

  const totalUsCount = Object.values(usSizeCounts).reduce((a, b) => a + b, 0);
  const totalIndianCount = Object.values(indianSizeCounts).reduce((a, b) => a + b, 0);

  const totalUsStock = Object.values(stockUs).reduce((sum, val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 ? sum + num : sum;
  }, 0);

  const totalIndianStock = Object.values(stockIndian).reduce((sum, val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 ? sum + num : sum;
  }, 0);

  const grandTotalStock = totalUsStock + totalIndianStock;
  const grandTotalClaimed = totalUsCount + totalIndianCount;
  const totalUsRemaining = totalUsStock > 0 ? totalUsStock - totalUsCount : null;
  const totalIndianRemaining = totalIndianStock > 0 ? totalIndianStock - totalIndianCount : null;
  const grandTotalRemaining = grandTotalStock > 0 ? grandTotalStock - grandTotalClaimed : null;

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

        {/* T-Shirt Inventory & Stock Tracking Widget */}
        {!loading && campers.length > 0 && (
          <div className="card" style={{ marginBottom: 28, padding: "16px" }}>
            <div 
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
              onClick={() => setIsSummaryExpanded(prev => !prev)}
            >
              <h3 style={{ fontSize: "1rem", color: "var(--forest)", margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>📦 T-Shirt Inventory & Remaining Stock</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "normal", background: "rgba(34, 76, 56, 0.06)", padding: "3px 10px", borderRadius: 12 }}>
                  Claimed: {totalUsCount} US Size / {totalIndianCount} Indian Size
                </span>
              </h3>
              <span style={{ fontSize: "1.2rem", color: "var(--muted)", fontWeight: "bold" }}>
                {isSummaryExpanded ? "▼" : "▶"}
              </span>
            </div>
            
            {isSummaryExpanded && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                
                {/* Inventory Summary KPI Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
                  <div style={{ background: "rgba(34, 76, 56, 0.05)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Claimed Shirts</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--forest)", marginTop: 2 }}>
                      {grandTotalClaimed} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>({totalUsCount} US / {totalIndianCount} IN)</span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(34, 76, 56, 0.05)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Configured Stock</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--forest-mid)", marginTop: 2 }}>
                      {grandTotalStock > 0 ? grandTotalStock : "No Limit Set"} {grandTotalStock > 0 && <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>({totalUsStock} US / {totalIndianStock} IN)</span>}
                    </div>
                  </div>

                  {grandTotalStock > 0 && (
                    <div style={{ background: grandTotalRemaining >= 0 ? "rgba(34, 76, 56, 0.08)" : "rgba(220, 38, 38, 0.08)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: 8 }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Remaining Stock</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: grandTotalRemaining >= 0 ? "var(--forest)" : "var(--red)", marginTop: 2 }}>
                        {grandTotalRemaining >= 0 ? `${grandTotalRemaining} left` : `🔴 ${Math.abs(grandTotalRemaining)} over limit`}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Size System Choice Selector Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20, background: "rgba(0,0,0,0.02)", padding: "10px 14px", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--forest-mid)" }}>Select Sizing System:</span>
                    <div style={{ display: "inline-flex", background: "#fff", padding: 3, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                      <button
                        type="button"
                        className={`btn ${sizeSystemTab === "US" ? "btn-primary" : "btn-ghost"}`}
                        style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: 6 }}
                        onClick={() => setSizeSystemTab("US")}
                      >
                        🇺🇸 US Sizes
                      </button>
                      <button
                        type="button"
                        className={`btn ${sizeSystemTab === "INDIAN" ? "btn-primary" : "btn-ghost"}`}
                        style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: 6 }}
                        onClick={() => setSizeSystemTab("INDIAN")}
                      >
                        🇮🇳 Indian Sizes
                      </button>
                      <button
                        type="button"
                        className={`btn ${sizeSystemTab === "BOTH" ? "btn-primary" : "btn-ghost"}`}
                        style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: 6 }}
                        onClick={() => setSizeSystemTab("BOTH")}
                      >
                        📊 Both Systems
                      </button>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => handleOpenStockModal(e)}
                      style={{ fontSize: "0.8rem", height: 34, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                    >
                      ⚙️ Manage Inventory Stock Limits
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: (sizeSystemTab === "BOTH") ? "1fr auto 1fr" : "1fr", gap: 24 }}>
                  
                  {/* US Sizes Column */}
                  {(sizeSystemTab === "US" || sizeSystemTab === "BOTH") && (
                    <div>
                      <h4 style={{ fontSize: "0.9rem", color: "var(--forest)", marginBottom: 12, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>🇺🇸 US Size Inventory</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "normal" }}>{totalUsCount} total claimed</span>
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                        {TSHIRT_SIZES.map(sz => {
                          const claimed = usSizeCounts[sz] || 0;
                          const total = stockUs[sz] !== undefined && stockUs[sz] !== "" ? parseInt(stockUs[sz], 10) : null;
                          const hasStockLimit = total !== null && !isNaN(total);
                          const remaining = hasStockLimit ? total - claimed : null;

                          let badgeClass = "badge-success";
                          let badgeText = `${claimed} claimed`;
                          if (hasStockLimit) {
                            if (remaining > 5) {
                              badgeClass = "badge-success";
                              badgeText = `${remaining} left`;
                            } else if (remaining > 0) {
                              badgeClass = "badge-warning";
                              badgeText = `⚠️ ${remaining} left`;
                            } else {
                              badgeClass = "badge-danger";
                              badgeText = remaining === 0 ? "🔴 Out of Stock" : `🔴 ${Math.abs(remaining)} over limit`;
                            }
                          }

                          return (
                            <div key={sz} style={{ 
                              background: claimed > 0 ? "rgba(34, 76, 56, 0.04)" : "#fafafa", 
                              border: "1px solid var(--border-color)", 
                              borderRadius: 8, 
                              padding: "8px 10px", 
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: 4
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest)" }}>{sz}</span>
                                <span className={`badge ${badgeClass}`} style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                  {badgeText}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
                                Claimed: <strong style={{ color: "var(--charcoal)" }}>{claimed}</strong>
                                {hasStockLimit && <span> / Total: {total}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Vertical Divider Line */}
                  {sizeSystemTab === "BOTH" && (
                    <div style={{ width: "2px", background: "rgba(34, 76, 56, 0.25)", borderRadius: "2px", alignSelf: "stretch" }} />
                  )}

                  {/* Indian Sizes Column */}
                  {(sizeSystemTab === "INDIAN" || sizeSystemTab === "BOTH") && (
                    <div>
                      <h4 style={{ fontSize: "0.9rem", color: "var(--forest)", marginBottom: 12, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>🇮🇳 Indian Size Inventory</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "normal" }}>{totalIndianCount} total claimed</span>
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                        {activeIndianSizes.map(sz => {
                          const claimed = indianSizeCounts[sz] || 0;
                          const total = stockIndian[sz] !== undefined && stockIndian[sz] !== "" ? parseInt(stockIndian[sz], 10) : null;
                          const hasStockLimit = total !== null && !isNaN(total);
                          const remaining = hasStockLimit ? total - claimed : null;

                          let badgeClass = "badge-success";
                          let badgeText = `${claimed} claimed`;
                          if (hasStockLimit) {
                            if (remaining > 5) {
                              badgeClass = "badge-success";
                              badgeText = `${remaining} left`;
                            } else if (remaining > 0) {
                              badgeClass = "badge-warning";
                              badgeText = `⚠️ ${remaining} left`;
                            } else {
                              badgeClass = "badge-danger";
                              badgeText = remaining === 0 ? "🔴 Out of Stock" : `🔴 ${Math.abs(remaining)} over limit`;
                            }
                          }

                          return (
                            <div key={sz} style={{ 
                              background: claimed > 0 ? "rgba(34, 76, 56, 0.04)" : "#fafafa", 
                              border: "1px solid var(--border-color)", 
                              borderRadius: 8, 
                              padding: "8px 10px", 
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: 4
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest)" }}>{sz}</span>
                                <span className={`badge ${badgeClass}`} style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                  {badgeText}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
                                Claimed: <strong style={{ color: "var(--charcoal)" }}>{claimed}</strong>
                                {hasStockLimit && <span> / Total: {total}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
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
                      return (
                        <div key={c.id} className="family-member-row" style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <div className="apparel-member-row">
                            <div className="apparel-member-info">
                              <div className="family-member-name" style={{ fontWeight: 600 }}>{c.full_name}</div>
                            </div>
                            <div className="apparel-member-controls">
                              {/* US Size Select */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontWeight: 600 }}>US Size</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <select 
                                    className="form-select" 
                                    style={{ width: 110, padding: "4px 8px", fontSize: "0.8rem", height: "30px" }}
                                    value={c.tshirt_size || ""}
                                    onChange={e => handleTshirtUpdate(c.id, "tshirt_size", e.target.value)}
                                    disabled={!canEdit}
                                  >
                                    <option value="">— Select —</option>
                                    {TSHIRT_SIZES.map(sz => (
                                      <option key={sz} value={sz}>{sz}</option>
                                    ))}
                                  </select>
                                  {savingMap[`${c.id}-tshirt_size`] === "saving" && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                                  {savingMap[`${c.id}-tshirt_size`] === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.8rem", fontWeight: 700 }}>✓</span>}
                                  {savingMap[`${c.id}-tshirt_size`] === "error" && <span style={{ color: "var(--red)", fontSize: "0.8rem", fontWeight: 700 }}>⚠️</span>}
                                </div>
                              </div>

                              {/* Indian Size Select */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontWeight: 600 }}>Indian Size</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <select 
                                    className="form-select" 
                                    style={{ width: 120, padding: "4px 8px", fontSize: "0.8rem", height: "30px" }}
                                    value={c.indian_size || ""}
                                    onChange={async (e) => {
                                      const val = e.target.value;
                                      if (val === "__ADD_CUSTOM__") {
                                        const custom = window.prompt("Enter new custom Indian T-Shirt size:");
                                        if (custom && custom.trim()) {
                                          const clean = custom.trim();
                                          await handleAddCustomSize(clean);
                                          handleTshirtUpdate(c.id, "indian_size", clean);
                                        }
                                      } else {
                                        handleTshirtUpdate(c.id, "indian_size", val);
                                      }
                                    }}
                                    disabled={!canEdit}
                                  >
                                    <option value="">— Select —</option>
                                    {activeIndianSizes.map(sz => (
                                      <option key={sz} value={sz}>{sz}</option>
                                    ))}
                                    <option value="__ADD_CUSTOM__">➕ Custom Size...</option>
                                  </select>
                                  {savingMap[`${c.id}-indian_size`] === "saving" && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                                  {savingMap[`${c.id}-indian_size`] === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.8rem", fontWeight: 700 }}>✓</span>}
                                  {savingMap[`${c.id}-indian_size`] === "error" && <span style={{ color: "var(--red)", fontSize: "0.8rem", fontWeight: 700 }}>⚠️</span>}
                                </div>
                              </div>
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
                    return (
                      <div key={c.id} className="family-member-row" style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="family-member-name" style={{ fontWeight: 600 }}>{c.full_name}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {/* US Size Select */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontWeight: 600 }}>US Size</label>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <select 
                                  className="form-select" 
                                  style={{ width: 110, padding: "4px 8px", fontSize: "0.8rem", height: "30px" }}
                                  value={c.tshirt_size || ""}
                                  onChange={e => handleTshirtUpdate(c.id, "tshirt_size", e.target.value)}
                                  disabled={!canEdit}
                                >
                                  <option value="">— Select —</option>
                                  {TSHIRT_SIZES.map(sz => (
                                    <option key={sz} value={sz}>{sz}</option>
                                  ))}
                                </select>
                                {savingMap[`${c.id}-tshirt_size`] === "saving" && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                                  {savingMap[`${c.id}-tshirt_size`] === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.8rem", fontWeight: 700 }}>✓</span>}
                                  {savingMap[`${c.id}-tshirt_size`] === "error" && <span style={{ color: "var(--red)", fontSize: "0.8rem", fontWeight: 700 }}>⚠️</span>}
                              </div>
                            </div>

                            {/* Indian Size Input */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontWeight: 600 }}>Indian Size</label>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input 
                                  type="text"
                                  className="form-input" 
                                  placeholder="e.g. M"
                                  style={{ width: 80, padding: "4px 8px", fontSize: "0.8rem", height: "30px" }}
                                  key={c.indian_size || ""}
                                  defaultValue={c.indian_size || ""}
                                  onBlur={e => handleTshirtUpdate(c.id, "indian_size", e.target.value)}
                                  disabled={!canEdit}
                                />
                                {savingMap[`${c.id}-indian_size`] === "saving" && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                                  {savingMap[`${c.id}-indian_size`] === "saved" && <span style={{ color: "var(--forest)", fontSize: "0.8rem", fontWeight: 700 }}>✓</span>}
                                  {savingMap[`${c.id}-indian_size`] === "error" && <span style={{ color: "var(--red)", fontSize: "0.8rem", fontWeight: 700 }}>⚠️</span>}
                              </div>
                            </div>
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

      {/* Manage T-Shirt Inventory Stock Modal */}
      {isStockModalOpen && (
        <div 
          className="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99999,
            padding: 16
          }}
          onClick={() => setIsStockModalOpen(false)}
        >
          <div 
            className="modal-content" 
            style={{ 
              background: "#ffffff",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 680, 
              maxHeight: "90vh", 
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)" 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, color: "var(--forest)" }}>⚙️ Manage T-Shirt Inventory Stock</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsStockModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSaveStock}>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                Set total ordered stock quantity for each T-shirt size. The system automatically calculates remaining stock in real-time.
              </p>

              {(() => {
                const formUsTotal = Object.values(stockFormUs).reduce((sum, val) => {
                  const num = parseInt(val, 10);
                  return !isNaN(num) && num > 0 ? sum + num : sum;
                }, 0);
                const formIndianTotal = Object.values(stockFormIndian).reduce((sum, val) => {
                  const num = parseInt(val, 10);
                  return !isNaN(num) && num > 0 ? sum + num : sum;
                }, 0);

                return (
                  <>
                    {/* Tab Navigation for Modal */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                      <button
                        type="button"
                        className={`btn ${modalStockTab === "US" ? "btn-primary" : "btn-ghost"}`}
                        style={{ fontSize: "0.85rem", padding: "6px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                        onClick={() => setModalStockTab("US")}
                      >
                        🇺🇸 US Size Stock ({formUsTotal} Total)
                      </button>
                      <button
                        type="button"
                        className={`btn ${modalStockTab === "INDIAN" ? "btn-primary" : "btn-ghost"}`}
                        style={{ fontSize: "0.85rem", padding: "6px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                        onClick={() => setModalStockTab("INDIAN")}
                      >
                        🇮🇳 Indian Size Stock ({formIndianTotal} Total)
                      </button>
                    </div>

                    {/* Tab 1: US Sizes Stock Form */}
                    {modalStockTab === "US" && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid var(--border-color)", paddingBottom: 6 }}>
                          <h4 style={{ fontSize: "0.9rem", color: "var(--forest-mid)", margin: 0 }}>
                            🇺🇸 US Size Total Stock Limits
                          </h4>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest)" }}>
                            Total US Stock: {formUsTotal}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                          {TSHIRT_SIZES.map(sz => (
                            <div key={sz} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, background: "rgba(0,0,0,0.02)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                              <label style={{ fontSize: "0.8rem", fontWeight: 700, width: 45 }}>{sz}</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                style={{ height: 30, fontSize: "0.8rem", padding: "2px 6px", width: 70 }}
                                value={stockFormUs[sz] !== undefined ? stockFormUs[sz] : ""}
                                placeholder="No limit"
                                onChange={e => setStockFormUs(prev => ({ ...prev, [sz]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Indian Sizes Stock Form */}
                    {modalStockTab === "INDIAN" && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid var(--border-color)", paddingBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <h4 style={{ fontSize: "0.9rem", color: "var(--forest-mid)", margin: 0 }}>
                              🇮🇳 Indian Size Total Stock Limits
                            </h4>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest)" }}>
                              Total Indian Stock: {formIndianTotal}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem", padding: "3px 10px", cursor: "pointer" }}
                            onClick={async () => {
                              const custom = window.prompt("Enter new custom Indian T-Shirt size (e.g. 48\", Special):");
                              if (custom && custom.trim()) {
                                await handleAddCustomSize(custom.trim());
                              }
                            }}
                          >
                            ➕ Add Custom Size
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                          {activeIndianSizes.map(sz => (
                            <div key={sz} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, background: "rgba(0,0,0,0.02)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                              <label style={{ fontSize: "0.8rem", fontWeight: 700, width: 65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={sz}>{sz}</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                style={{ height: 30, fontSize: "0.8rem", padding: "2px 6px", width: 70 }}
                                value={stockFormIndian[sz] !== undefined ? stockFormIndian[sz] : ""}
                                placeholder="No limit"
                                onChange={e => setStockFormIndian(prev => ({ ...prev, [sz]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--forest)" }}>
                        Overall Total Inventory Limit: {formUsTotal + formIndianTotal} shirts
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setIsStockModalOpen(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={savingStock}>
                          {savingStock ? "Saving Limits..." : "Save Inventory Limits"}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
