import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function CampInfoPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("camp_info", "edit");

  const [settings, setSettings] = useState({});
  const [places, setPlaces] = useState({ hospitals: [], restaurants: [], is_mock: true, camp_address: "" });
  const [hospitalsExpanded, setHospitalsExpanded] = useState(false);
  const [restaurantsExpanded, setRestaurantsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formFields, setFormFields] = useState({
    signup_title: "",
    camp_description: "",
    signup_location: "",
    camp_poc_name: "",
    camp_poc_email: "",
    camp_poc_phone: "",
    google_places_api_key: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/settings/");
      if (res.data.settings) {
        setSettings(res.data.settings);
        setFormFields({
          signup_title: res.data.settings.signup_title || "",
          camp_description: res.data.settings.camp_description || "",
          signup_location: res.data.settings.signup_location || "",
          camp_poc_name: res.data.settings.camp_poc_name || "",
          camp_poc_email: res.data.settings.camp_poc_email || "",
          camp_poc_phone: res.data.settings.camp_poc_phone || "",
          google_places_api_key: res.data.settings.google_places_api_key || ""
        });
      }
    } catch (err) {
      setError("Failed to load camp settings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaces = async () => {
    try {
      setPlacesLoading(true);
      const res = await api.get("/api/settings/places");
      setPlaces(res.data);
    } catch (err) {
      // Ignored - fall back gracefully
    } finally {
      setPlacesLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPlaces();
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSuccess("");
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/api/settings/", formFields);
      setSuccess("Camp details updated successfully!");
      setIsModalOpen(false);
      fetchData();
      fetchPlaces();
    } catch (err) {
      setError("Failed to update camp details.");
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating) => {
    if (rating === "N/A" || !rating) return <span style={{ color: "var(--muted)" }}>No rating</span>;
    const num = Math.round(rating);
    return (
      <span style={{ color: "var(--gold)", fontWeight: 700 }}>
        {"★".repeat(num) + "☆".repeat(5 - num)} <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: 4 }}>({rating})</span>
      </span>
    );
  };

  const customStyles = `
    .info-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }

    .places-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }

    .accordion-header {
      background: #f1f8f4;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      font-weight: 700;
      color: var(--forest-dark);
      font-size: 1rem;
      user-select: none;
      transition: background 0.2s ease;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .accordion-header:hover {
      background: #e2f0e6;
    }

    .accordion-content {
      padding: 8px 4px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 480px;
      overflow-y: auto;
      border-radius: 8px;
    }

    .place-card {
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .place-title {
      font-weight: 700;
      color: var(--forest-dark);
      font-size: 0.9rem;
    }

    .place-link {
      color: inherit;
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .place-link:hover {
      color: var(--forest) !important;
      text-decoration: underline !important;
    }

    .place-address {
      font-size: 0.78rem;
      color: var(--muted);
    }

    .place-status {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    @media (max-width: 820px) {
      .info-grid, .places-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  return (
    <>
      <style>{customStyles}</style>

      <div className="top-bar">
        <div>
          <h1 style={{ margin: 0 }}>⛺ Camp Info & Location</h1>
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            Overview of camp details, point of contact, and local resources
          </span>
        </div>

        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenModal}>
            ⚙️ Edit Camp Info
          </button>
        )}
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
            Loading camp information…
          </div>
        ) : (
          <>
            {/* Row 1: Camp details & POC */}
            <div className="info-grid">
              {/* Camp Overview */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ color: "var(--forest-dark)", fontWeight: 700, fontSize: "1.15rem", margin: 0, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  🏫 {settings.signup_title || "Camp Details"}
                </h3>
                <p style={{ fontSize: "0.92rem", color: "var(--charcoal)", lineHeight: 1.6, margin: 0 }}>
                  {settings.camp_description || "No description configured."}
                </p>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem", fontWeight: 600, color: "var(--forest)" }}>
                  <span>📍 Camp Address:</span>
                  <span className="badge badge-gray" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                    {settings.signup_location || "Not Set"}
                  </span>
                </div>
              </div>

              {/* Point of Contact */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ color: "var(--forest-dark)", fontWeight: 700, fontSize: "1.15rem", margin: 0, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  📞 Point of Contact
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Name</span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{settings.camp_poc_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Email Address</span>
                    {settings.camp_poc_email ? (
                      <a href={`mailto:${settings.camp_poc_email}`} style={{ textDecoration: "none", color: "var(--forest)", fontWeight: 700, fontSize: "0.9rem" }}>
                        ✉️ {settings.camp_poc_email}
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>N/A</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Phone Number</span>
                    {settings.camp_poc_phone ? (
                      <a href={`tel:${settings.camp_poc_phone}`} style={{ textDecoration: "none", color: "var(--forest)", fontWeight: 700, fontSize: "0.9rem" }}>
                        📞 {settings.camp_poc_phone}
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>N/A</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Google Places nearby search */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                <h3 style={{ color: "var(--forest-dark)", fontWeight: 700, fontSize: "1.15rem", margin: 0 }}>
                  🗺️ Nearest Local Services
                </h3>
                {places.is_mock && (
                  <span className="badge badge-gold" style={{ fontSize: "0.72rem", padding: "2px 8px" }} title="API Key is not configured. Displaying local directory fallback.">
                    📁 Offline Sandbox Fallback
                  </span>
                )}
              </div>

              {placesLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                  Querying local services from camp address…
                </div>
              ) : (
                <div className="places-grid">
                  {/* Hospitals Section */}
                  <div>
                    <div 
                      className="accordion-header" 
                      onClick={() => setHospitalsExpanded(!hospitalsExpanded)}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        🏥 Hospitals & Care Centers ({places.hospitals?.length || 0})
                      </span>
                      <span>{hospitalsExpanded ? "▲" : "▼"}</span>
                    </div>
                    {hospitalsExpanded && (
                      <div className="accordion-content">
                        {places.hospitals && places.hospitals.length > 0 ? (
                          places.hospitals.map((item, idx) => (
                            <div key={idx} className="place-card">
                              <div className="place-title">
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ", " + item.address)}&query_place_id=${item.place_id || ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="place-link"
                                >
                                  {item.name} <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>↗</span>
                                </a>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                {renderStars(item.rating)}
                                <span className="place-status" style={{ color: item.open_now ? "var(--forest)" : "#ef4444" }}>
                                  {item.open_now ? "🟢 Open Now" : "🔴 Closed"}
                                </span>
                              </div>
                              <div className="place-address">{item.address}</div>
                              {(item.distance || item.phone) && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)", fontSize: "0.76rem" }}>
                                  {item.distance && <span style={{ color: "var(--forest)", fontWeight: 700 }}>📍 {item.distance}</span>}
                                  {item.phone && (
                                    <a href={`tel:${item.phone}`} style={{ textDecoration: "none", color: "var(--charcoal)", fontWeight: 600 }}>
                                      📞 {item.phone}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: 8 }}>No hospitals found.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Restaurants Section */}
                  <div>
                    <div 
                      className="accordion-header" 
                      onClick={() => setRestaurantsExpanded(!restaurantsExpanded)}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        🍔 Restaurants & Dining ({places.restaurants?.length || 0})
                      </span>
                      <span>{restaurantsExpanded ? "▲" : "▼"}</span>
                    </div>
                    {restaurantsExpanded && (
                      <div className="accordion-content">
                        {places.restaurants && places.restaurants.length > 0 ? (
                          places.restaurants.map((item, idx) => (
                            <div key={idx} className="place-card">
                              <div className="place-title">
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ", " + item.address)}&query_place_id=${item.place_id || ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="place-link"
                                >
                                  {item.name} <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>↗</span>
                                </a>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                {renderStars(item.rating)}
                                <span className="place-status" style={{ color: item.open_now ? "var(--forest)" : "#ef4444" }}>
                                  {item.open_now ? "🟢 Open Now" : "🔴 Closed"}
                                </span>
                              </div>
                              <div className="place-address">{item.address}</div>
                              {(item.distance || item.phone) && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)", fontSize: "0.76rem" }}>
                                  {item.distance && <span style={{ color: "var(--forest)", fontWeight: 700 }}>📍 {item.distance}</span>}
                                  {item.phone && (
                                    <a href={`tel:${item.phone}`} style={{ textDecoration: "none", color: "var(--charcoal)", fontWeight: 600 }}>
                                      📞 {item.phone}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: 8 }}>No restaurants found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal Dialog */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 560, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--forest-dark)", fontWeight: 700 }}>
              ⚙️ Edit Camp Configurations
            </h3>
            
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Camp Name / Header</label>
                <input
                  className="form-input"
                  value={formFields.signup_title}
                  onChange={e => setFormFields(prev => ({ ...prev, signup_title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Camp Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={formFields.camp_description}
                  onChange={e => setFormFields(prev => ({ ...prev, camp_description: e.target.value }))}
                  style={{ resize: "vertical", padding: "8px 12px" }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Camp Location Address</label>
                <input
                  className="form-input"
                  value={formFields.signup_location}
                  onChange={e => setFormFields(prev => ({ ...prev, signup_location: e.target.value }))}
                  placeholder="e.g. Camp Name, Address, City"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>POC Name</label>
                  <input
                    className="form-input"
                    value={formFields.camp_poc_name}
                    onChange={e => setFormFields(prev => ({ ...prev, camp_poc_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>POC Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={formFields.camp_poc_email}
                    onChange={e => setFormFields(prev => ({ ...prev, camp_poc_email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>POC Phone Number</label>
                <input
                  className="form-input"
                  value={formFields.camp_poc_phone}
                  onChange={e => setFormFields(prev => ({ ...prev, camp_poc_phone: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Google Places API Key (Optional)
                </label>
                <input
                  className="form-input"
                  type="password"
                  value={formFields.google_places_api_key}
                  onChange={e => setFormFields(prev => ({ ...prev, google_places_api_key: e.target.value }))}
                  placeholder="Paste your API key here (Optional)"
                />
                <span className="text-muted" style={{ fontSize: "0.72rem", marginTop: 4, display: "block" }}>
                  Used secure server-side for Geocoding and Place searches. If empty, local directory fallbacks are displayed.
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
