import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = ["Not started", "In progress", "Done", "Delayed"];
const DAY_OPTIONS = ["Friday", "Saturday", "Sunday"];

// 5-minute increments, formatted exactly like the migration script's output
// (e.g. "02:00 PM") so dropdown values line up with data imported from Excel.
const formatTime12 = (h, m) => {
  const period = h < 12 ? "AM" : "PM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_OPTIONS.push(formatTime12(h, m));
  }
}
// If a stored value doesn't land on a 15-min mark (older/odd data), keep it
// selectable instead of silently blanking it out.
const timeOptionsFor = (value) => {
  if (value && !TIME_OPTIONS.includes(value)) return [value, ...TIME_OPTIONS];
  return TIME_OPTIONS;
};

const STATUS_STYLES = {
  "Not started": { bg: "#F3F4F6", color: "#374151" },
  "In progress": { bg: "#FEF3C7", color: "#92400E" },
  "Done":        { bg: "#D1FAE5", color: "#065F46" },
  "Delayed":     { bg: "#FEE2E2", color: "#991B1B" },
};
const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES["Not started"];

const Chip = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    background: "var(--cream)", border: "1px solid var(--border)",
    borderRadius: 999, padding: "2px 10px", fontSize: "0.78rem", color: "var(--charcoal)",
  }}>
    {children}
  </span>
);

const StatusBadge = ({ status, onChange, editable }) => {
  const { bg, color } = statusStyle(status);
  if (!editable) {
    return (
      <span style={{ background: bg, color, borderRadius: 999, padding: "3px 12px", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
        {status}
      </span>
    );
  }
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{ background: bg, color, borderRadius: 999, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer" }}
    >
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
};

const Field = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: "0.85rem", overflowWrap: "break-word" }}>{value}</div>
  </div>
);

const IconBtn = ({ onClick, danger, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      border: `1px solid ${danger ? "#B02A2A" : "var(--border)"}`,
      color: danger ? "#B02A2A" : "var(--charcoal)",
      background: "var(--white)", borderRadius: 6, width: 30, height: 30,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.85rem", cursor: "pointer", flexShrink: 0,
    }}
  >
    {children}
  </button>
);

function Section({ title, children, action }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const getDeadlineSortScore = (task, blocks = []) => {
  const deadline = task.deadline;
  if (!deadline) return 999999;
  const str = deadline.trim().toLowerCase();
  
  if (str.includes("pre-camp") || str.includes("pre camp")) {
    return -10000;
  }
  
  // 1. Determine day
  let dayScore = 3;
  if (str.includes("fri")) dayScore = 0;
  else if (str.includes("sat")) dayScore = 1;
  else if (str.includes("sun")) dayScore = 2;
  
  // 2. Parse time if present
  const timeMatch = str.match(/(\d+):(\d+)\s*(am|pm)?/);
  if (timeMatch) {
    let hr = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3];
    
    if (ampm === "pm" && hr < 12) hr += 12;
    else if (ampm === "am" && hr === 12) hr = 0;
    
    return dayScore * 1440 + hr * 60 + min;
  }
  
  // 3. Fallback: try matching with "for_block"
  if (task.for_block && blocks.length > 0) {
    const matchedBlock = blocks.find(
      b => b.block_title && b.block_title.trim().toLowerCase() === task.for_block.trim().toLowerCase()
    );
    if (matchedBlock) {
      let bDayScore = 3;
      if (matchedBlock.day.toLowerCase().includes("fri")) bDayScore = 0;
      else if (matchedBlock.day.toLowerCase().includes("sat")) bDayScore = 1;
      else if (matchedBlock.day.toLowerCase().includes("sun")) bDayScore = 2;
      
      const bTimeMatch = (matchedBlock.start_time || "").trim().toLowerCase().match(/(\d+):(\d+)\s*(am|pm)?/);
      if (bTimeMatch) {
        let bHr = parseInt(bTimeMatch[1], 10);
        let bMin = parseInt(bTimeMatch[2], 10);
        const bAmpm = bTimeMatch[3];
        
        if (bAmpm === "pm" && bHr < 12) bHr += 12;
        else if (bAmpm === "am" && bHr === 12) bHr = 0;
        
        let totalMin = bDayScore * 1440 + bHr * 60 + bMin;
        
        if (str.includes("pre-session") || str.includes("pre")) {
          const offsetMatch = str.match(/(\d+)\s*min/);
          const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 30;
          totalMin -= offset;
        }
        return totalMin;
      }
    }
  }
  
  return dayScore * 1440 + 1199;
};

export default function RetreatOpsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("retreat_ops", "edit");

  const [tab, setTab] = useState("run_of_show");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);

  const [blocks, setBlocks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);

  const [newBlock, setNewBlock] = useState(null);
  const [editBlockId, setEditBlockId] = useState(null);
  const [editBlockDraft, setEditBlockDraft] = useState(null);
  const [newTeam, setNewTeam] = useState(null);
  const [editTeamId, setEditTeamId] = useState(null);
  const [editTeamDraft, setEditTeamDraft] = useState(null);
  const [newTask, setNewTask] = useState(null);
  const [newPlan, setNewPlan] = useState(null);
  const [editPlanId, setEditPlanId] = useState(null);
  const [editPlanDraft, setEditPlanDraft] = useState(null);

  const [expandedBlocks, setExpandedBlocks] = useState({});
  const toggleBlockExpanded = (id) => {
    setExpandedBlocks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const showFlash = (type, text) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 3000);
  };

  const fetchAll = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/api/retreat-ops/run-of-show"),
      api.get("/api/retreat-ops/roster"),
      api.get("/api/retreat-ops/setup-tasks"),
      api.get("/api/retreat-ops/contingency"),
    ])
      .then(([a, b, c, d]) => {
        setBlocks(a.data.blocks || []);
        setTeams(b.data.teams || []);
        setTasks(c.data.tasks || []);
        setPlans(d.data.plans || []);
      })
      .catch(() => setError("Failed to load retreat ops data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- Run of Show handlers ----
  const blankBlock = () => ({
    day: "Friday", start_time: "", end_time: "", block_title: "", location: "",
    point_person: "", supporting_teams: "", setup_time: "", setup_notes: "",
    tech_cues: "", kidz_corner_note: "", contingency: "", status: "Not started",
  });

  const saveNewBlock = async () => {
    try {
      await api.post("/api/retreat-ops/run-of-show", newBlock);
      setNewBlock(null);
      showFlash("success", "Block added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add block.");
    }
  };

  const saveBlock = async (block) => {
    try {
      await api.put(`/api/retreat-ops/run-of-show/${block.id}`, block);
      setEditBlockId(null);
      setEditBlockDraft(null);
      showFlash("success", "Block updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to update block.");
    }
  };

  const quickSetStatus = async (block, status) => {
    try {
      await api.put(`/api/retreat-ops/run-of-show/${block.id}`, { status });
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update status.");
    }
  };

  const deleteBlock = async (id) => {
    if (!await window.confirm("Delete this block?")) return;
    try {
      await api.delete(`/api/retreat-ops/run-of-show/${id}`);
      showFlash("success", "Block deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete block.");
    }
  };

  // ---- Roster handlers ----
  const blankTeam = () => ({ name: "", lead: "", phone: "", members: "", owns_blocks: "", notes: "" });

  const saveNewTeam = async () => {
    try {
      await api.post("/api/retreat-ops/roster", newTeam);
      setNewTeam(null);
      showFlash("success", "Team added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add team.");
    }
  };

  const saveTeam = async (team) => {
    try {
      await api.put(`/api/retreat-ops/roster/${team.id}`, team);
      setEditTeamId(null);
      setEditTeamDraft(null);
      showFlash("success", "Team updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update team.");
    }
  };

  const deleteTeam = async (id) => {
    if (!await window.confirm("Delete this team?")) return;
    try {
      await api.delete(`/api/retreat-ops/roster/${id}`);
      showFlash("success", "Team deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete team.");
    }
  };

  // ---- Setup task handlers ----
  const blankTask = () => ({ item: "", for_block: "", owner: "", deadline: "", qty_detail: "" });

  const saveNewTask = async () => {
    try {
      await api.post("/api/retreat-ops/setup-tasks", newTask);
      setNewTask(null);
      showFlash("success", "Task added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add task.");
    }
  };

  const toggleTaskDone = async (task) => {
    try {
      await api.put(`/api/retreat-ops/setup-tasks/${task.id}`, { done: !task.done });
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update task.");
    }
  };

  const deleteTask = async (id) => {
    if (!await window.confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/retreat-ops/setup-tasks/${id}`);
      showFlash("success", "Task deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete task.");
    }
  };

  // ---- Contingency handlers ----
  const blankPlan = () => ({ scenario: "", trigger: "", action: "", who_decides: "" });

  const saveNewPlan = async () => {
    try {
      await api.post("/api/retreat-ops/contingency", newPlan);
      setNewPlan(null);
      showFlash("success", "Scenario added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add scenario.");
    }
  };

  const savePlan = async (plan) => {
    try {
      await api.put(`/api/retreat-ops/contingency/${plan.id}`, plan);
      setEditPlanId(null);
      setEditPlanDraft(null);
      showFlash("success", "Scenario updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update scenario.");
    }
  };

  const deletePlan = async (id) => {
    if (!await window.confirm("Delete this scenario?")) return;
    try {
      await api.delete(`/api/retreat-ops/contingency/${id}`);
      showFlash("success", "Scenario deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete scenario.");
    }
  };

  const getTimeMinutes = (timeStr) => {
    if (!timeStr) return 9999;
    const str = timeStr.trim().toLowerCase();
    const match = str.match(/(\d+):(\d+)\s*(am|pm)?/);
    if (match) {
      let hr = parseInt(match[1], 10);
      const min = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm === "pm" && hr < 12) hr += 12;
      else if (ampm === "am" && hr === 12) hr = 0;
      return hr * 60 + min;
    }
    return 9999;
  };

  const blocksByDay = DAY_OPTIONS.map(day => {
    const dayItems = blocks.filter(b => b.day === day);
    dayItems.sort((a, b) => getTimeMinutes(a.start_time) - getTimeMinutes(b.start_time));
    return {
      day,
      items: dayItems,
    };
  });

  const doneCount = tasks.filter(t => t.done).length;

  const sortedTasks = [...tasks].sort((a, b) => {
    return getDeadlineSortScore(a, blocks) - getDeadlineSortScore(b, blocks);
  });

  const tabs = [
    { key: "run_of_show", label: "🗓️ Run of Show" },
    { key: "roster", label: "👥 Team Roster" },
    { key: "setup", label: "📦 Setup & Supplies" },
    { key: "contingency", label: "⚠️ Contingency" },
  ];

  return (
    <>
      <div className="top-bar">
        <h1>⛺ Retreat Ops</h1>
        <span className="text-muted">Internal run-of-show, roster, setup checklist &amp; contingency plans</span>
      </div>

      <div className="page-body">
        {flash && (
          <div className={`alert alert-${flash.type === "success" ? "success" : "error"}`} style={{ marginBottom: 20 }}>
            {flash.text}
          </div>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={tab === t.key ? "btn btn-primary" : "btn btn-outline"}
              style={{ padding: "8px 16px", fontSize: "0.85rem", fontWeight: 600 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted">Loading retreat ops data...</p>
        ) : (
          <>
            {tab === "run_of_show" && (
              <Section
                title="Internal Run of Show"
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewBlock(blankBlock())}>
                    ➕ Add Block
                  </button>
                )}
              >
                {newBlock && (
                  <BlockForm block={newBlock} setBlock={setNewBlock} onSave={saveNewBlock} onCancel={() => setNewBlock(null)} />
                )}
                {blocksByDay.map(({ day, items }) => (
                  items.length > 0 && (
                    <div key={day} style={{ marginBottom: 24 }}>
                      <h4 style={{ margin: "8px 0 10px", color: "var(--forest)" }}>{day}</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {items.map(b => (
                          editBlockId === b.id ? (
                            <div key={b.id} className="card" style={{ padding: 16 }}>
                              <BlockForm
                                block={editBlockDraft}
                                setBlock={setEditBlockDraft}
                                onSave={() => saveBlock(editBlockDraft)}
                                onCancel={() => { setEditBlockId(null); setEditBlockDraft(null); }}
                              />
                            </div>
                          ) : (
                            <div
                              key={b.id}
                              className="card"
                              style={{ padding: "14px 16px", cursor: "pointer" }}
                              onClick={() => toggleBlockExpanded(b.id)}
                            >
                              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                                <div style={{ minWidth: 92, flexShrink: 0 }}>
                                  <div style={{ fontWeight: 700, color: "var(--forest)", fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                                    {b.start_time || "—"}
                                  </div>
                                  {b.end_time && (
                                    <div className="text-muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                                      – {b.end_time}
                                    </div>
                                  )}
                                </div>

                                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{
                                      color: "var(--forest)", display: "inline-block", flexShrink: 0,
                                      transform: expandedBlocks[b.id] ? "rotate(90deg)" : "rotate(0deg)",
                                      transition: "transform 0.15s ease",
                                    }}>▶</span>
                                    <strong style={{ fontSize: "0.98rem" }}>{b.block_title}</strong>
                                  </div>
                                  {b.location && (
                                    <div className="text-muted" style={{ fontSize: "0.82rem", marginTop: 3, marginLeft: 18 }}>
                                      📍 {b.location}
                                    </div>
                                  )}
                                  {(b.point_person || b.supporting_teams) && (
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginLeft: 18 }}>
                                      {b.point_person && <Chip>👤 {b.point_person}</Chip>}
                                      {b.supporting_teams && <Chip>🤝 {b.supporting_teams}</Chip>}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
                                  <StatusBadge status={b.status} editable={canEdit} onChange={(status) => quickSetStatus(b, status)} />
                                  {canEdit && (
                                    <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                                      <IconBtn title="Edit" onClick={() => { setEditBlockId(b.id); setEditBlockDraft({ ...b }); }}>✏️</IconBtn>
                                      <IconBtn title="Delete" danger onClick={() => deleteBlock(b.id)}>🗑️</IconBtn>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {expandedBlocks[b.id] && (b.setup_time || b.setup_notes || b.tech_cues || b.kidz_corner_note || b.contingency) && (
                                <div
                                  style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {(b.setup_time || b.setup_notes) && (
                                    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 8 }}>
                                      <span style={{ fontWeight: 700, display: "block", color: "var(--forest)", marginBottom: 6, fontSize: "0.85rem" }}>🔧 Setup Details</span>
                                      {b.setup_time && <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 4 }}><strong>Done By:</strong> {b.setup_time}</div>}
                                      {b.setup_notes && <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{b.setup_notes}</div>}
                                    </div>
                                  )}
                                  {b.tech_cues && (
                                    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 8 }}>
                                      <span style={{ fontWeight: 700, display: "block", color: "var(--gold)", marginBottom: 6, fontSize: "0.85rem" }}>🎧 Tech &amp; Production Cues</span>
                                      <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{b.tech_cues}</div>
                                    </div>
                                  )}
                                  {b.kidz_corner_note && (
                                    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 8 }}>
                                      <span style={{ fontWeight: 700, display: "block", color: "#7b68ee", marginBottom: 6, fontSize: "0.85rem" }}>👶 Kidz Corner</span>
                                      <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{b.kidz_corner_note}</div>
                                    </div>
                                  )}
                                  {b.contingency && (
                                    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 8 }}>
                                      <span style={{ fontWeight: 700, display: "block", color: "var(--danger)", marginBottom: 6, fontSize: "0.85rem" }}>⚠️ Contingency</span>
                                      <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{b.contingency}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {blocks.length === 0 && !newBlock && <p className="text-muted">No blocks yet.</p>}
              </Section>
            )}

            {tab === "roster" && (
              <Section
                title="Team Roster & Contacts"
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewTeam(blankTeam())}>
                    ➕ Add Team
                  </button>
                )}
              >
                {newTeam && <TeamForm team={newTeam} setTeam={setNewTeam} onSave={saveNewTeam} onCancel={() => setNewTeam(null)} />}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  {teams.map(t => (
                    editTeamId === t.id ? (
                      <div key={t.id} className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
                        <TeamForm
                          team={editTeamDraft}
                          setTeam={setEditTeamDraft}
                          onSave={() => saveTeam(editTeamDraft)}
                          onCancel={() => { setEditTeamId(null); setEditTeamDraft(null); }}
                        />
                      </div>
                    ) : (
                      <div key={t.id} className="card" style={{ padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <strong style={{ fontSize: "1rem" }}>{t.name}</strong>
                            {t.lead && <div className="text-muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>Lead: {t.lead}</div>}
                          </div>
                          {canEdit && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <IconBtn title="Edit" onClick={() => { setEditTeamId(t.id); setEditTeamDraft({ ...t }); }}>✏️</IconBtn>
                              <IconBtn title="Delete" danger onClick={() => deleteTeam(t.id)}>🗑️</IconBtn>
                            </div>
                          )}
                        </div>
                        {t.phone && <div style={{ marginTop: 8 }}><Chip>📞 {t.phone}</Chip></div>}
                        {t.members && (
                          <div style={{ marginTop: 10, fontSize: "0.82rem" }}>
                            <span className="text-muted">Members:</span> {t.members}
                          </div>
                        )}
                        {t.owns_blocks && (
                          <div style={{ marginTop: 6, fontSize: "0.82rem" }}>
                            <span className="text-muted">Owns:</span> {t.owns_blocks}
                          </div>
                        )}
                        {t.notes && (
                          <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
                            {t.notes}
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
                {teams.length === 0 && !newTeam && <p className="text-muted">No teams yet.</p>}
              </Section>
            )}

            {tab === "setup" && (
              <Section
                title={`Setup & Supplies Checklist  (${doneCount}/${tasks.length} done)`}
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewTask(blankTask())}>
                    ➕ Add Task
                  </button>
                )}
              >
                {newTask && <TaskForm task={newTask} setTask={setNewTask} onSave={saveNewTask} onCancel={() => setNewTask(null)} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedTasks.map(t => (
                    <div key={t.id} className="card" style={{ padding: "12px 16px", opacity: t.done ? 0.6 : 1 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <input
                          type="checkbox" checked={t.done} disabled={!canEdit} onChange={() => toggleTaskDone(t)}
                          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, textDecoration: t.done ? "line-through" : "none" }}>{t.item}</div>
                          {(t.for_block || t.owner || t.deadline || t.qty_detail) && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 8 }}>
                              {t.for_block && <Field label="For block" value={t.for_block} />}
                              {t.owner && <Field label="Owner" value={t.owner} />}
                              {t.deadline && <Field label="Deadline" value={t.deadline} />}
                              {t.qty_detail && <Field label="Qty / detail" value={t.qty_detail} />}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <IconBtn title="Delete" danger onClick={() => deleteTask(t.id)}>🗑️</IconBtn>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {tasks.length === 0 && !newTask && <p className="text-muted">No tasks yet.</p>}
              </Section>
            )}

            {tab === "contingency" && (
              <Section
                title="Contingency & Safety Protocols"
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewPlan(blankPlan())}>
                    ➕ Add Scenario
                  </button>
                )}
              >
                {newPlan && <PlanForm plan={newPlan} setPlan={setNewPlan} onSave={saveNewPlan} onCancel={() => setNewPlan(null)} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plans.map(p => (
                    editPlanId === p.id ? (
                      <div key={p.id} className="card" style={{ padding: 16 }}>
                        <PlanForm
                          plan={editPlanDraft}
                          setPlan={setEditPlanDraft}
                          onSave={() => savePlan(editPlanDraft)}
                          onCancel={() => { setEditPlanId(null); setEditPlanDraft(null); }}
                        />
                      </div>
                    ) : (
                      <div key={p.id} className="card" style={{ padding: 16, borderLeft: "4px solid var(--danger)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "0.98rem" }}>⚠️ {p.scenario}</strong>
                          {canEdit && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <IconBtn title="Edit" onClick={() => { setEditPlanId(p.id); setEditPlanDraft({ ...p }); }}>✏️</IconBtn>
                              <IconBtn title="Delete" danger onClick={() => deletePlan(p.id)}>🗑️</IconBtn>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10, fontSize: "0.85rem" }}>
                          {p.trigger && <div><span className="text-muted">Trigger:</span> {p.trigger}</div>}
                          {p.action && <div><span className="text-muted">Action:</span> {p.action}</div>}
                          {p.who_decides && <div><span className="text-muted">Who decides:</span> {p.who_decides}</div>}
                        </div>
                      </div>
                    )
                  ))}
                </div>
                {plans.length === 0 && !newPlan && <p className="text-muted">No scenarios yet.</p>}
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}

// --- Small inline form components ---

function fieldStyle() {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 140, flex: "1 1 160px" };
}

function BlockForm({ block, setBlock, onSave, onCancel }) {
  const set = (k, v) => setBlock(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ background: "#f7f7f5", padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Day</label>
          <select className="form-select" value={block.day} onChange={e => set("day", e.target.value)}>
            {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Start Time</label>
          <select className="form-select" value={block.start_time || ""} onChange={e => set("start_time", e.target.value)}>
            <option value="">—</option>
            {timeOptionsFor(block.start_time).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>End Time</label>
          <select className="form-select" value={block.end_time || ""} onChange={e => set("end_time", e.target.value)}>
            <option value="">—</option>
            {timeOptionsFor(block.end_time).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Block / Event *</label>
          <input className="form-input" value={block.block_title || ""} onChange={e => set("block_title", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Location</label>
          <input className="form-input" value={block.location || ""} onChange={e => set("location", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Point Person</label>
          <input className="form-input" value={block.point_person || ""} onChange={e => set("point_person", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Supporting Teams</label>
          <input className="form-input" value={block.supporting_teams || ""} onChange={e => set("supporting_teams", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Setup Done By</label>
          <select className="form-select" value={block.setup_time || ""} onChange={e => set("setup_time", e.target.value)}>
            <option value="">—</option>
            {timeOptionsFor(block.setup_time).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Status</label>
          <select className="form-select" value={block.status} onChange={e => set("status", e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Setup / Teardown Notes</label>
          <input className="form-input" value={block.setup_notes || ""} onChange={e => set("setup_notes", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Tech & Production Cues</label>
          <input className="form-input" value={block.tech_cues || ""} onChange={e => set("tech_cues", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Kidz Corner</label>
          <input className="form-input" value={block.kidz_corner_note || ""} onChange={e => set("kidz_corner_note", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Contingency</label>
          <input className="form-input" value={block.contingency || ""} onChange={e => set("contingency", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ padding: "6px 16px" }} onClick={onSave}>Save</button>
        <button className="btn btn-outline" style={{ padding: "6px 16px" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function TeamForm({ team, setTeam, onSave, onCancel }) {
  const set = (k, v) => setTeam(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ background: "#f7f7f5", padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Team Name *</label>
          <input className="form-input" value={team.name || ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Lead</label>
          <input className="form-input" value={team.lead || ""} onChange={e => set("lead", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Phone</label>
          <input className="form-input" value={team.phone || ""} onChange={e => set("phone", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Members</label>
          <input className="form-input" value={team.members || ""} onChange={e => set("members", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Owns These Blocks</label>
          <input className="form-input" value={team.owns_blocks || ""} onChange={e => set("owns_blocks", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Notes</label>
          <input className="form-input" value={team.notes || ""} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ padding: "6px 16px" }} onClick={onSave}>Save</button>
        <button className="btn btn-outline" style={{ padding: "6px 16px" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function TaskForm({ task, setTask, onSave, onCancel }) {
  const set = (k, v) => setTask(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ background: "#f7f7f5", padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={{ ...fieldStyle(), minWidth: 240, flex: "2 1 240px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Item / Task *</label>
          <input className="form-input" value={task.item || ""} onChange={e => set("item", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>For Which Block</label>
          <input className="form-input" value={task.for_block || ""} onChange={e => set("for_block", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Owner</label>
          <input className="form-input" value={task.owner || ""} onChange={e => set("owner", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Deadline</label>
          <input className="form-input" placeholder="Fri 3:30 PM" value={task.deadline || ""} onChange={e => set("deadline", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Qty / Detail</label>
          <input className="form-input" value={task.qty_detail || ""} onChange={e => set("qty_detail", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ padding: "6px 16px" }} onClick={onSave}>Save</button>
        <button className="btn btn-outline" style={{ padding: "6px 16px" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function PlanForm({ plan, setPlan, onSave, onCancel }) {
  const set = (k, v) => setPlan(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ background: "#f7f7f5", padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Scenario *</label>
          <input className="form-input" value={plan.scenario || ""} onChange={e => set("scenario", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 220, flex: "2 1 220px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Trigger</label>
          <input className="form-input" value={plan.trigger || ""} onChange={e => set("trigger", e.target.value)} />
        </div>
        <div style={{ ...fieldStyle(), minWidth: 260, flex: "2 1 260px" }}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Action</label>
          <input className="form-input" value={plan.action || ""} onChange={e => set("action", e.target.value)} />
        </div>
        <div style={fieldStyle()}>
          <label className="text-muted" style={{ fontSize: "0.75rem" }}>Who Decides</label>
          <input className="form-input" value={plan.who_decides || ""} onChange={e => set("who_decides", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ padding: "6px 16px" }} onClick={onSave}>Save</button>
        <button className="btn btn-outline" style={{ padding: "6px 16px" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
