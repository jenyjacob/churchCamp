import React, { useEffect, useState } from "react";
import api from "../utils/api";
export default function TeamsPage() {
  const [campers, setCampers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const handleExportExcel = () => {
    const escapeCell = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const headers = ["Team", "Camper Name", "Age"];
    const rows = [
      ...team1Members.map(c => [team1Name, `${c.first_name || ""} ${c.last_name || ""}`.trim(), c.age ?? ""]),
      ...team2Members.map(c => [team2Name, `${c.first_name || ""} ${c.last_name || ""}`.trim(), c.age ?? ""]),
      ...unassignedMembers.map(c => ["Unassigned", `${c.first_name || ""} ${c.last_name || ""}`.trim(), c.age ?? ""]),
    ];
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gca_team_assignments_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchTeamsData = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/api/campers/?per_page=-1"),
      api.get("/api/settings/")
    ])
      .then(([campersRes, settingsRes]) => {
        setCampers(campersRes.data.campers || []);
        if (settingsRes.data.settings) {
          setSettings(settingsRes.data.settings);
        }
      })
      .catch(() => {
        setError("Failed to load team data.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTeamsData();
  }, []);

  const team1Name = settings.team_1_name || "Team Peter";
  const team2Name = settings.team_2_name || "Team Paul";

  // Filter campers based on search
  const filteredCampers = campers.filter(c => {
    const term = search.toLowerCase();
    const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
    return fullName.includes(term) || (c.cabin_group || "").toLowerCase().includes(term);
  });

  // Group campers by team
  const team1Members = filteredCampers.filter(c => {
    const t = (c.team_name || "").toLowerCase();
    return t.includes("team 1") || t.includes("team1") || t.includes("peter") || t.includes(team1Name.toLowerCase());
  });

  const team2Members = filteredCampers.filter(c => {
    const t = (c.team_name || "").toLowerCase();
    return t.includes("team 2") || t.includes("team2") || t.includes("paul") || t.includes(team2Name.toLowerCase());
  });

  const unassignedMembers = filteredCampers.filter(c => {
    const t = (c.team_name || "").toLowerCase();
    const isTeam1 = t.includes("team 1") || t.includes("team1") || t.includes("peter") || t.includes(team1Name.toLowerCase());
    const isTeam2 = t.includes("team 2") || t.includes("team2") || t.includes("paul") || t.includes(team2Name.toLowerCase());
    return !isTeam1 && !isTeam2;
  });

  const sortByLastName = (a, b) => {
    const lnA = (a.last_name || "").toLowerCase();
    const lnB = (b.last_name || "").toLowerCase();
    if (lnA < lnB) return -1;
    if (lnA > lnB) return 1;
    const fnA = (a.first_name || "").toLowerCase();
    const fnB = (b.first_name || "").toLowerCase();
    if (fnA < fnB) return -1;
    if (fnA > fnB) return 1;
    return 0;
  };

  team1Members.sort(sortByLastName);
  team2Members.sort(sortByLastName);
  unassignedMembers.sort(sortByLastName);

  return (
    <>
      <div className="top-bar">
        <h1>🏆 Team Assignments</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm" disabled={loading}>
            📥 Export Excel
          </button>
          <button onClick={fetchTeamsData} className="btn btn-secondary btn-sm" disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 20, display: "flex", gap: 12 }}>
          <div className="search-box" style={{ flex: 1, maxWidth: 400 }}>
            <span className="icon">🔍</span>
            <input
              type="text"
              placeholder="Search campers by name or cabin..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>
            <div className="spinner" style={{ border: "3px solid #eee", borderTopColor: "var(--forest-mid)", width: 32, height: 32, margin: "0 auto" }} />
          </div>
        ) : (
          <>
            <div className="teams-container" style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              alignItems: "start",
              marginBottom: 32
            }}>
              {/* Team 1 Card */}
              <div className="card" style={{ padding: 20, borderTop: "4px solid var(--forest)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <h2 style={{ color: "var(--forest-dark)", fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                    🟢 {team1Name}
                  </h2>
                  <span className="badge badge-green" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                    {team1Members.length} Members
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Camper Name</th>
                        <th style={{ textAlign: "right", padding: "10px 12px" }}>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team1Members.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-muted text-center" style={{ padding: 20 }}>
                            No campers assigned to this team.
                          </td>
                        </tr>
                      ) : (
                        team1Members.map(c => (
                          <tr key={c.id}>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.first_name} {c.last_name}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>{c.age !== null && c.age !== undefined ? c.age : <span className="text-muted">—</span>}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team 2 Card */}
              <div className="card" style={{ padding: 20, borderTop: "4px solid var(--gold)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <h2 style={{ color: "var(--charcoal)", fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                    🟡 {team2Name}
                  </h2>
                  <span className="badge badge-gold" style={{ fontSize: "0.8rem", padding: "4px 10px", color: "var(--charcoal)" }}>
                    {team2Members.length} Members
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Camper Name</th>
                        <th style={{ textAlign: "right", padding: "10px 12px" }}>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team2Members.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-muted text-center" style={{ padding: 20 }}>
                            No campers assigned to this team.
                          </td>
                        </tr>
                      ) : (
                        team2Members.map(c => (
                          <tr key={c.id}>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.first_name} {c.last_name}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>{c.age !== null && c.age !== undefined ? c.age : <span className="text-muted">—</span>}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Unassigned Section */}
            {unassignedMembers.length > 0 && (
              <div className="card" style={{ padding: 20, borderTop: "4px solid var(--gray)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <h2 style={{ color: "var(--muted)", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                    ⚪ Unassigned Campers
                  </h2>
                  <span className="badge badge-gray" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                    {unassignedMembers.length} Campers
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Camper Name</th>
                        <th style={{ textAlign: "right", padding: "10px 12px" }}>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedMembers.map(c => (
                        <tr key={c.id}>
                          <td style={{ padding: "10px 12px" }}>{c.first_name} {c.last_name}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{c.age !== null && c.age !== undefined ? c.age : <span className="text-muted">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 820px) {
          .teams-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
