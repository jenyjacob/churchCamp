import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/",        icon: "🏠", label: "Dashboard",  exact: true },
  { to: "/campers", icon: "👤", label: "Campers"  },
  { to: "/checkin", icon: "✅", label: "Check-In"  },
  { to: "/cabins",  icon: "⛺", label: "Cabins"  },
  { to: "/app/schedule", icon: "📅", label: "Schedule" },
  { to: "/outdoor", icon: "🛶", label: "Outdoor Activities" },
];

const adminItems = [
  { to: "/users",   icon: "⚙️", label: "Users"  },
  { to: "/logs",    icon: "📄", label: "Audit Logs" },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {/* Mobile Sticky Header */}
      <header className="mobile-header">
        <div className="mobile-brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/grace-logo.png" alt="GCA Logo" style={{ height: 28, width: 28, objectFit: "contain", background: "white", borderRadius: "50%", padding: 1 }} />
          <span>GCA Camp Manager</span>
        </div>
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Backdrop overlay for closing the drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: 16 }}>
          <img src="/grace-logo.png" alt="GCA Logo" style={{ height: 52, width: 52, marginBottom: 12, objectFit: "contain", background: "white", borderRadius: "50%", padding: 2 }} />
          <h2 style={{ fontSize: "1rem" }}>GCA Camp Registration</h2>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => {
              const isStaff = user?.role === "user";
              if (isStaff) {
                return ["/", "/campers", "/checkin"].includes(item.to);
              }
              // Directors (role === 'director') can access both check-in, campers, AND outdoor activities!
              const isDirector = user?.role === "director";
              if (isDirector) {
                return ["/", "/campers", "/checkin", "/outdoor", "/app/schedule", "/cabins"].includes(item.to);
              }
              return true;
            })
            .map(item => (
              <NavItem key={item.to} {...item} />
            ))
          }
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
