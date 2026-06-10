import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/",        icon: "🏠", label: "Dashboard",  exact: true },
  { to: "/campers", icon: "👤", label: "Campers"  },
  { to: "/checkin", icon: "✅", label: "Check-In"  },
];

const adminItems = [
  { to: "/users",   icon: "⚙️", label: "Users"  },
];

function NavItem({ to, icon, label, exact }) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      className={`nav-item${active ? " active" : ""}`}
    >
      <span className="icon">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="cross">✝</span>
          <h2>Camp Registration</h2>
          <p>Church Camp Manager</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
          {isAdmin && (
            <>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "8px 0" }} />
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "4px 12px 2px" }}>Admin</div>
              {adminItems.map(item => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="avatar">{initials}</div>
            <div className="info">
              <div className="name">{user?.full_name || user?.username}</div>
              <div className="role-tag">{user?.role}</div>
            </div>
          </div>
          <button className="nav-item w-full" onClick={logout}>
            <span className="icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
