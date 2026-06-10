import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/campers/stats"),
      api.get("/api/checkin/?active_only=true&per_page=8"),
    ])
      .then(([statsRes, checkinsRes]) => {
        setStats(statsRes.data);
        setRecentCheckins(checkinsRes.data.checkins);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <div className="top-bar">
        <h1>Dashboard</h1>
        <span className="text-muted">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "var(--forest)", marginBottom: 4 }}>
            {greeting()}, {user?.full_name?.split(" ")[0] || user?.username}! 👋
          </h2>
          <p className="text-muted">Here's what's happening at camp today.</p>
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>
            <div className="spinner" style={{ borderTopColor: "var(--forest-mid)", border: "3px solid #eee", borderTopColor: "var(--forest-mid)", width: 32, height: 32, margin: "0 auto" }} />
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card green-accent">
                <div className="label">Total Registered</div>
                <div className="value">{stats?.total_registered ?? "—"}</div>
                <div className="sub">campers enrolled</div>
              </div>
              <div className="stat-card gold-accent">
                <div className="label">Checked In Now</div>
                <div className="value" style={{ color: "var(--gold)" }}>{stats?.checked_in ?? "—"}</div>
                <div className="sub">currently on site</div>
              </div>
              <div className="stat-card green-accent">
                <div className="label">Confirmed</div>
                <div className="value">{stats?.status_registered ?? "—"}</div>
                <div className="sub">registration confirmed</div>
              </div>
              <div className="stat-card gold-accent">
                <div className="label">Paid</div>
                <div className="value" style={{ color: "var(--forest-mid)" }}>{stats?.paid ?? "—"}</div>
                <div className="sub">payment complete</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Quick Actions */}
              <div className="card">
                <h3 style={{ fontSize: "1rem", color: "var(--forest)", marginBottom: 16 }}>Quick Actions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Link to="/checkin" className="btn btn-primary" style={{ justifyContent: "flex-start" }}>
                    ✅ Go to Check-In
                  </Link>
                  <Link to="/campers" className="btn btn-outline" style={{ justifyContent: "flex-start" }}>
                    👤 View Camper List
                  </Link>
                  {isAdmin && (
                    <Link to="/campers?new=1" className="btn btn-ghost" style={{ justifyContent: "flex-start" }}>
                      ➕ Register New Camper
                    </Link>
                  )}
                </div>
              </div>

              {/* Recently Checked In */}
              <div className="card">
                <h3 style={{ fontSize: "1rem", color: "var(--forest)", marginBottom: 16 }}>Currently Checked In</h3>
                {recentCheckins.length === 0 ? (
                  <p className="text-muted">No campers are checked in right now.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentCheckins.slice(0, 6).map(ci => (
                      <div key={ci.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{ci.camper_name}</div>
                          <div className="text-muted">In at {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                        <span className="badge badge-green">Active</span>
                      </div>
                    ))}
                    {recentCheckins.length > 6 && (
                      <Link to="/checkin" className="text-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                        +{recentCheckins.length - 6} more →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
