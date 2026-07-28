import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const EMPTY_USER = { username: "", password: "", full_name: "", email: "", role: "user" };

const getRoleLabel = (roleKey) => {
  switch (roleKey) {
    case "user": return "Registration Team (user)";
    case "director": return "Camp Director";
    case "finance": return "Finance Dept";
    case "admin": return "Camp Admin";
    case "owner": return "Camp Owner";
    default: return `${roleKey.charAt(0).toUpperCase() + roleKey.slice(1)} (Custom)`;
  }
};


function UserModal({ user, currentUser, onClose, onSave }) {
  const [form, setForm] = useState(user ? { ...user, password: "" } : EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rolesList, setRolesList] = useState(["user", "director", "finance", "admin"]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get("/api/permissions/roles")
      .then(res => {
        if (res.data.roles) {
          setRolesList(res.data.roles);
        }
      })
      .catch(() => {});
  }, []);

  const validatePassword = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number.";
    if (!/[@$!%*?&#^\-+=_]/.test(pwd)) return "Password must contain at least one special character (@$!%*?&#^-+=_).";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password) {
      const errStr = validatePassword(form.password);
      if (errStr) {
        setError(errStr);
        return;
      }
    }
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
          <h2>{user?.id ? "Edit User" : "Add Registration Team User"}</h2>
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
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4, display: "block" }}>
              Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&#^-+=_).
            </span>
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
              {rolesList.map(r => {
                if (r === "owner" && currentUser?.role !== "owner") {
                  return null;
                }
                return (
                  <option key={r} value={r}>
                    {getRoleLabel(r)}
                  </option>
                );
              })}
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
          {currentUser?.role === "owner" && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={!!form.must_change_password} 
                  onChange={e => set("must_change_password", e.target.checked)} 
                />
                🔑 Force user to change password on next login
              </label>
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
  const { user: currentUser, hasPermission } = useAuth();
  const canEdit = hasPermission("users", "edit");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [tempPasswordModal, setTempPasswordModal] = useState(null);

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

  const handleToggleForcePassword = async (u) => {
    try {
      await api.put(`/api/users/${u.id}`, { must_change_password: !u.must_change_password });
      fetchUsers();
    } catch {
      setError("Failed to update password requirement.");
    }
  };

  const handleUnlockAccount = async (u) => {
    try {
      await api.put(`/api/users/${u.id}`, { unlock_account: true });
      fetchUsers();
    } catch {
      setError("Failed to unlock user account.");
    }
  };

  const handleResetPassword = async (u) => {
    if (!window.confirm(`Are you sure you want to reset the password for "${u.username}"?`)) return;
    try {
      const res = await api.post(`/api/users/${u.id}/reset-password`);
      setTempPasswordModal({
        username: u.username,
        temp_password: res.data.temp_password
      });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password.");
    }
  };

  return (
    <>
      <div className="top-bar">
        <h1>Registration Team Users</h1>
        {canEdit && <button className="btn btn-primary" onClick={() => setModal("add")}>➕ Add User</button>}
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          ⚙️ <strong>Admin only.</strong> Manage Registration Team accounts and permissions here.
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
                    <span className={`badge ${u.role === "owner" ? "badge-red" : u.role === "admin" ? "badge-gold" : u.role === "director" ? "badge-green" : u.role === "finance" ? "badge-green" : "badge-blue"}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                    {u.failed_login_attempts >= 5 ? (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-red" style={{ fontSize: "0.68rem" }}>🔒 Locked Out (5/5)</span>
                      </div>
                    ) : u.failed_login_attempts > 0 ? (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-gold" style={{ fontSize: "0.68rem" }}>⚠️ {u.failed_login_attempts} Failed Hit(s)</span>
                      </div>
                    ) : null}
                    {u.must_change_password && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-gold" style={{ fontSize: "0.68rem" }}>🔑 Pwd Change Req.</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {((u.locked_until && new Date(u.locked_until) > new Date()) || u.failed_login_attempts > 0) && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => handleUnlockAccount(u)}
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            title="Unlock account and reset failed password attempts counter"
                          >
                            🔓 Unlock
                          </button>
                        )}
                        {currentUser?.role === "owner" && (
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => handleToggleForcePassword(u)}
                            disabled={u.role === "owner" && currentUser?.role !== "owner"}
                            style={{ color: u.must_change_password ? "#d97706" : "inherit" }}
                            title={u.must_change_password ? "Click to cancel password change requirement" : "Force user to change password on next login"}
                          >
                            {u.must_change_password ? "🔑 Pending Pwd Change" : "🔑 Force Pwd Change"}
                          </button>
                        )}
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => handleResetPassword(u)}
                          disabled={u.role === "owner" && currentUser?.role !== "owner"}
                          style={{ color: "var(--red)" }}
                          title="Generate temporary password and force change on next login"
                        >
                          🔄 Reset Pwd
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => setModal(u)}
                          disabled={u.role === "owner" && currentUser?.role !== "owner"}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(u)}
                          disabled={u.id === currentUser?.id || (u.role === "owner" && currentUser?.role !== "owner")}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === "add" || (modal && modal.id)) && (
        <UserModal user={modal === "add" ? null : modal} currentUser={currentUser} onClose={() => setModal(null)} onSave={handleSave} />
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

      {tempPasswordModal && (
        <div className="modal-overlay" onClick={() => setTempPasswordModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔑 Password Reset Succeeded</h2>
              <button className="modal-close" onClick={() => setTempPasswordModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: "0 20px 20px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                A new temporary password has been successfully generated for <strong>{tempPasswordModal.username}</strong>. They will be forced to change it on next login.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Temporary Password</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    className="form-input" 
                    readOnly 
                    value={tempPasswordModal.temp_password} 
                    style={{ fontSize: "1.1rem", fontFamily: "monospace", fontWeight: 700, backgroundColor: "#f9fafb", textAlign: "center" }}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPasswordModal.temp_password);
                      alert("Temporary password copied to clipboard!");
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setTempPasswordModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
