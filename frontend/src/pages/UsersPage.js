import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const EMPTY_USER = { username: "", password: "", full_name: "", email: "", role: "user" };

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user ? { ...user, password: "" } : EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let res;
      if (user?.id) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        res = await api.put(`/api/users/${user.id}`, payload);
      } else {
        res = await api.post("/api/users/", form);
      }
      onSave(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{user?.id ? "Edit User" : "Add Staff User"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input className="form-input" value={form.username} onChange={e => set("username", e.target.value)} required disabled={!!user?.id} />
          </div>
          <div className="form-group">
            <label className="form-label">{user?.id ? "New Password (leave blank to keep)" : "Password *"}</label>
            <input className="form-input" type="password" value={form.password} onChange={e => set("password", e.target.value)} required={!user?.id} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.full_name || ""} onChange={e => set("full_name", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-select" value={form.role} onChange={e => set("role", e.target.value)}>
              <option value="user">Staff (View Only)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>
          {user?.id && (
            <div className="form-group">
              <label className="form-label">Account Status</label>
              <select className="form-select" value={form.is_active ? "active" : "inactive"} onChange={e => set("is_active", e.target.value === "active")}>
                <option value="active">Active</option>
                <option value="inactive">Disabled</option>
              </select>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : (user?.id ? "Save Changes" : "Create User")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get("/api/users/")
      .then(r => setUsers(r.data.users))
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = () => { fetchUsers(); setModal(null); };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch { setError("Failed to delete user."); }
  };

  return (
    <>
      <div className="top-bar">
        <h1>Staff Users</h1>
        <button className="btn btn-primary" onClick={() => setModal("add")}>➕ Add User</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          ⚙️ <strong>Admin only.</strong> Manage staff accounts and permissions here.
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center" style={{ padding: 32 }}>Loading…</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.username}</div>
                    {u.id === currentUser?.id && <div className="text-muted" style={{ fontSize: "0.72rem" }}>← You</div>}
                  </td>
                  <td>{u.full_name || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "badge-gold" : "badge-blue"}`}>
                      {u.role === "admin" ? "Admin" : "Staff"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)}>Edit</button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === "add" || (modal && modal.id)) && (
        <UserModal user={modal === "add" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p>Delete <strong>{deleteTarget.username}</strong>? They will lose access to the system.</p>
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
