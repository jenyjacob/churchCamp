import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const EMPTY_CAMPER = {
  first_name: "", last_name: "", age: "", gender: "",
  cabin_group: "", family_group: "", guardian_name: "", guardian_phone: "",
  allergies: "",
  registration_status: "registered", notes: "",
  kayaking: 0, boat_tour: 0
};

function CamperModal({ camper, onClose, onSave }) {
  const [form, setForm] = useState(camper || EMPTY_CAMPER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] || "", onChange: e => set(k, e.target.value), className: "form-input" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let res;
      if (camper?.id) {
        res = await api.put(`/api/campers/${camper.id}`, form);
      } else {
        res = await api.post("/api/campers/", form);
      }
      onSave(res.data.camper);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save camper.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2>{camper?.id ? "Edit Camper" : "Register New Camper"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 12 }}>Personal Info</div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">First Name *</label><input {...inp("first_name")} required /></div>
            <div className="form-group"><label className="form-label">Last Name *</label><input {...inp("last_name")} required /></div>
            <div className="form-group"><label className="form-label">Age</label><input {...inp("age")} type="number" min="1" max="100" /></div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender || ""} onChange={e => set("gender", e.target.value)}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Cabin / Group</label><input {...inp("cabin_group")} /></div>
            <div className="form-group"><label className="form-label">Family Group</label><input {...inp("family_group")} placeholder="e.g. 101" /></div>
          </div>

          <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, margin: "16px 0 12px" }}>Guardian & Emergency</div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Guardian Name</label><input {...inp("guardian_name")} /></div>
            <div className="form-group"><label className="form-label">Guardian Phone</label><input {...inp("guardian_phone")} type="tel" /></div>
          </div>

          <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, margin: "16px 0 12px" }}>Medical</div>
          <div className="form-group"><label className="form-label">Allergies</label><textarea {...inp("allergies")} className="form-textarea" rows={2} /></div>

          <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, margin: "16px 0 12px" }}>Outdoor Activities</div>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Kayaking Spots</label>
              <input {...inp("kayaking")} type="number" min="0" max="10" />
            </div>
            <div className="form-group">
              <label className="form-label">Boat Tour Spots</label>
              <input {...inp("boat_tour")} type="number" min="0" max="10" />
            </div>
          </div>

          <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, margin: "16px 0 12px" }}>Status</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Registration Status</label>
              <select className="form-select" value={form.registration_status} onChange={e => set("registration_status", e.target.value)}>
                <option value="registered">Registered</option>
                <option value="waitlist">Waitlist</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "center", height: "100%", paddingTop: 28 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, color: "var(--forest-mid)" }}>
                <input
                  type="checkbox"
                  checked={form.waiver_submitted || false}
                  onChange={e => set("waiver_submitted", e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Waiver Form Submitted
              </label>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea {...inp("notes")} className="form-textarea" rows={2} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : (camper?.id ? "Save Changes" : "Register Camper")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const REG_BADGE = { registered: "badge-green", waitlist: "badge-gold", cancelled: "badge-red" };

export default function CampersPage() {
  const { isAdmin } = useAuth();
  const [campers, setCampers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "add" | camper object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");

  const fetchCampers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, per_page: 20 });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api.get(`/api/campers/?${params}`)
      .then(r => { setCampers(r.data.campers); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => setError("Failed to load campers."))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchCampers(); }, [fetchCampers]);

  const handleSave = (camper) => {
    fetchCampers();
    setModal(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/campers/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchCampers();
    } catch {
      setError("Failed to delete camper.");
    }
  };

  return (
    <>
      <div className="top-bar">
        <h1>Campers</h1>
        <button className="btn btn-primary" onClick={() => setModal("add")}>
          ➕ Register Camper
        </button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="form-input"
              placeholder="Search by name or guardian…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="registered">Registered</option>
            <option value="waitlist">Waitlist</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="text-muted">{total} camper{total !== 1 ? "s" : ""}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Cabin / Group</th>
                <th>Family Group</th>
                <th>Registration</th>
                <th>Check-In</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center" style={{ padding: 32 }}>Loading…</td></tr>
              ) : campers.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center" style={{ padding: 32, color: "var(--muted)" }}>No campers found.</td></tr>
              ) : campers.map((c, i) => (
                <tr 
                  key={c.id}
                  style={c.family_group ? { 
                    borderLeft: "4px solid var(--gold)",
                    backgroundColor: "rgba(180, 151, 90, 0.02)"
                  } : {}}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                    {c.guardian_name && <div className="text-muted">{c.guardian_name}</div>}
                  </td>
                  <td>{c.age ?? "—"}</td>
                  <td>{c.cabin_group || "—"}</td>
                  <td>
                    {c.family_group ? (
                      <span className="badge badge-gold" style={{ fontSize: "0.75rem", padding: "4px 8px", fontWeight: 600 }}>
                        👨‍👩‍👧‍👦 Family #{c.family_group}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td><span className={`badge ${REG_BADGE[c.registration_status] || "badge-gray"}`}>{c.registration_status}</span></td>
                  <td>{c.checked_in ? <span className="badge badge-green">Checked In</span> : <span className="badge badge-gray">Not In</span>}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(c)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-muted" style={{ lineHeight: "32px" }}>Page {page} of {pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {(modal === "add" || (modal && modal.id)) && (
        <CamperModal camper={modal === "add" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Delete Camper</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p>Are you sure you want to delete <strong>{deleteTarget.full_name}</strong>? This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
