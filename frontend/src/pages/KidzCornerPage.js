import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const DAY_OPTIONS = [
  "Friday Night",
  "Saturday Morning",
  "Saturday Night",
  "Sunday Morning",
];

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

const inputStyle = {
  width: "100%", padding: "7px 10px", border: "1px solid var(--border)",
  borderRadius: 6, fontSize: "0.85rem", fontFamily: "inherit",
};

const Field = ({ label, children }) => (
  <div style={{ minWidth: 160, flex: "1 1 160px" }}>
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>
      {label}
    </div>
    {children}
  </div>
);

const FormRow = ({ children }) => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>{children}</div>
);

const FormActions = ({ onSave, onCancel }) => (
  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
    <button className="btn btn-ghost" style={{ padding: "6px 14px" }} onClick={onCancel}>Cancel</button>
    <button className="btn btn-primary" style={{ padding: "6px 16px" }} onClick={onSave}>Save</button>
  </div>
);

export default function KidzCornerPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("kidz_corner", "edit");

  const [tab, setTab] = useState("people");
  const [scheduleDay, setScheduleDay] = useState("Friday Night");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);

  const [volunteers, setVolunteers] = useState([]);
  const [kids, setKids] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [crafts, setCrafts] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [avLinks, setAvLinks] = useState([]);

  const [newVolunteer, setNewVolunteer] = useState(null);
  const [editVolunteerId, setEditVolunteerId] = useState(null);
  const [editVolunteerDraft, setEditVolunteerDraft] = useState(null);

  const [newKid, setNewKid] = useState(null);
  const [editKidId, setEditKidId] = useState(null);
  const [editKidDraft, setEditKidDraft] = useState(null);

  const [newScheduleItem, setNewScheduleItem] = useState(null);
  const [editScheduleId, setEditScheduleId] = useState(null);
  const [editScheduleDraft, setEditScheduleDraft] = useState(null);

  const [newCraft, setNewCraft] = useState(null);
  const [editCraftId, setEditCraftId] = useState(null);
  const [editCraftDraft, setEditCraftDraft] = useState(null);

  const [newBudgetItem, setNewBudgetItem] = useState(null);
  const [editBudgetId, setEditBudgetId] = useState(null);
  const [editBudgetDraft, setEditBudgetDraft] = useState(null);

  const [newAvLink, setNewAvLink] = useState(null);
  const [editAvLinkId, setEditAvLinkId] = useState(null);
  const [editAvLinkDraft, setEditAvLinkDraft] = useState(null);

  const showFlash = (type, text) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 3000);
  };

  const fetchAll = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/api/kidz-corner/volunteers"),
      api.get("/api/kidz-corner/kids"),
      api.get("/api/kidz-corner/schedule"),
      api.get("/api/kidz-corner/crafts"),
      api.get("/api/kidz-corner/budget"),
      api.get("/api/kidz-corner/av-links"),
    ])
      .then(([a, b, c, d, e, f]) => {
        setVolunteers(a.data.volunteers || []);
        setKids(b.data.kids || []);
        setScheduleItems(c.data.items || []);
        setCrafts(d.data.crafts || []);
        setBudgetItems(e.data.items || []);
        setAvLinks(f.data.links || []);
      })
      .catch(() => setError("Failed to load Kidz Corner data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- Volunteers ----
  const blankVolunteer = () => ({ name: "", assignment: "" });

  const saveNewVolunteer = async () => {
    try {
      await api.post("/api/kidz-corner/volunteers", newVolunteer);
      setNewVolunteer(null);
      showFlash("success", "Volunteer added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add volunteer.");
    }
  };

  const saveVolunteer = async (v) => {
    try {
      await api.put(`/api/kidz-corner/volunteers/${v.id}`, v);
      setEditVolunteerId(null);
      setEditVolunteerDraft(null);
      showFlash("success", "Volunteer updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update volunteer.");
    }
  };

  const deleteVolunteer = async (id) => {
    if (!await window.confirm("Remove this volunteer?")) return;
    try {
      await api.delete(`/api/kidz-corner/volunteers/${id}`);
      showFlash("success", "Volunteer removed.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to remove volunteer.");
    }
  };

  // ---- Kids ----
  const blankKid = () => ({ name: "", age: "", allergies: "" });

  const saveNewKid = async () => {
    try {
      await api.post("/api/kidz-corner/kids", newKid);
      setNewKid(null);
      showFlash("success", "Kid added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add kid.");
    }
  };

  const saveKid = async (k) => {
    try {
      await api.put(`/api/kidz-corner/kids/${k.id}`, k);
      setEditKidId(null);
      setEditKidDraft(null);
      showFlash("success", "Kid updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update kid.");
    }
  };

  const deleteKid = async (id) => {
    if (!await window.confirm("Remove this kid?")) return;
    try {
      await api.delete(`/api/kidz-corner/kids/${id}`);
      showFlash("success", "Kid removed.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to remove kid.");
    }
  };

  // ---- Schedule ----
  const blankScheduleItem = (day) => ({
    day: day || scheduleDay, date: "", time: "", activity: "",
    volunteers_needed: "", items_needed: "", notes: "",
  });

  const saveNewScheduleItem = async () => {
    try {
      await api.post("/api/kidz-corner/schedule", newScheduleItem);
      setNewScheduleItem(null);
      showFlash("success", "Schedule item added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add schedule item.");
    }
  };

  const saveScheduleItem = async (item) => {
    try {
      await api.put(`/api/kidz-corner/schedule/${item.id}`, item);
      setEditScheduleId(null);
      setEditScheduleDraft(null);
      showFlash("success", "Schedule item updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update schedule item.");
    }
  };

  const deleteScheduleItem = async (id) => {
    if (!await window.confirm("Delete this schedule item?")) return;
    try {
      await api.delete(`/api/kidz-corner/schedule/${id}`);
      showFlash("success", "Schedule item deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete schedule item.");
    }
  };

  // ---- Crafts ----
  const blankCraft = (day) => ({
    day: day || scheduleDay, title: "", materials: "", how_to: "", ages: "", things_to_bring: "",
  });

  const saveNewCraft = async () => {
    try {
      await api.post("/api/kidz-corner/crafts", newCraft);
      setNewCraft(null);
      showFlash("success", "Craft added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add craft.");
    }
  };

  const saveCraft = async (c) => {
    try {
      await api.put(`/api/kidz-corner/crafts/${c.id}`, c);
      setEditCraftId(null);
      setEditCraftDraft(null);
      showFlash("success", "Craft updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update craft.");
    }
  };

  const deleteCraft = async (id) => {
    if (!await window.confirm("Delete this craft?")) return;
    try {
      await api.delete(`/api/kidz-corner/crafts/${id}`);
      showFlash("success", "Craft deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete craft.");
    }
  };

  // ---- Budget ----
  const blankBudgetItem = () => ({
    month: "", income_actual: "", expenses_actual: "", expenses_projected: "", related_files: "", notes: "",
  });

  const saveNewBudgetItem = async () => {
    try {
      await api.post("/api/kidz-corner/budget", newBudgetItem);
      setNewBudgetItem(null);
      showFlash("success", "Budget line added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add budget line.");
    }
  };

  const saveBudgetItem = async (b) => {
    try {
      await api.put(`/api/kidz-corner/budget/${b.id}`, b);
      setEditBudgetId(null);
      setEditBudgetDraft(null);
      showFlash("success", "Budget line updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update budget line.");
    }
  };

  const deleteBudgetItem = async (id) => {
    if (!await window.confirm("Delete this budget line?")) return;
    try {
      await api.delete(`/api/kidz-corner/budget/${id}`);
      showFlash("success", "Budget line deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete budget line.");
    }
  };

  // ---- AV Links ----
  const blankAvLink = () => ({ category: "Action Song List", label: "", url: "" });

  const saveNewAvLink = async () => {
    try {
      await api.post("/api/kidz-corner/av-links", newAvLink);
      setNewAvLink(null);
      showFlash("success", "Link added.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to add link.");
    }
  };

  const saveAvLink = async (l) => {
    try {
      await api.put(`/api/kidz-corner/av-links/${l.id}`, l);
      setEditAvLinkId(null);
      setEditAvLinkDraft(null);
      showFlash("success", "Link updated.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to update link.");
    }
  };

  const deleteAvLink = async (id) => {
    if (!await window.confirm("Delete this link?")) return;
    try {
      await api.delete(`/api/kidz-corner/av-links/${id}`);
      showFlash("success", "Link deleted.");
      fetchAll();
    } catch (err) {
      showFlash("error", "Failed to delete link.");
    }
  };

  const tabs = [
    { key: "people", label: "👥 People" },
    { key: "schedule", label: "🗓️ Schedule" },
    { key: "budget", label: "💰 Budget" },
    { key: "av", label: "🎬 Audio/Video" },
  ];

  const scheduleForDay = scheduleItems
    .filter(i => i.day === scheduleDay)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const craftsForDay = crafts.filter(c => c.day === scheduleDay);

  const budgetTotals = budgetItems.reduce(
    (acc, b) => ({
      income: acc.income + (parseFloat(b.income_actual) || 0),
      actual: acc.actual + (parseFloat(b.expenses_actual) || 0),
      projected: acc.projected + (parseFloat(b.expenses_projected) || 0),
    }),
    { income: 0, actual: 0, projected: 0 }
  );

  const avByCategory = avLinks.reduce((acc, l) => {
    const cat = l.category || "Other";
    acc[cat] = acc[cat] || [];
    acc[cat].push(l);
    return acc;
  }, {});

  return (
    <>
      <div className="top-bar">
        <h1>🧸 Kidz Corner</h1>
        <span className="text-muted">Volunteers, kids, session schedule, budget &amp; audio/video for Kidz Corner</span>
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
          <p className="text-muted">Loading Kidz Corner data...</p>
        ) : (
          <>
            {/* ---------------- PEOPLE ---------------- */}
            {tab === "people" && (
              <>
                <Section
                  title="Volunteers"
                  action={canEdit && (
                    <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewVolunteer(blankVolunteer())}>
                      ➕ Add Volunteer
                    </button>
                  )}
                >
                  {newVolunteer && (
                    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                      <FormRow>
                        <Field label="Name"><input style={inputStyle} value={newVolunteer.name} onChange={e => setNewVolunteer({ ...newVolunteer, name: e.target.value })} /></Field>
                        <Field label="Assignment"><input style={inputStyle} value={newVolunteer.assignment} onChange={e => setNewVolunteer({ ...newVolunteer, assignment: e.target.value })} /></Field>
                      </FormRow>
                      <FormActions onSave={saveNewVolunteer} onCancel={() => setNewVolunteer(null)} />
                    </div>
                  )}
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr><th>Name</th><th>Assignment</th>{canEdit && <th style={{ width: 90 }}></th>}</tr>
                    </thead>
                    <tbody>
                      {volunteers.map(v => (
                        editVolunteerId === v.id ? (
                          <tr key={v.id}>
                            <td><input style={inputStyle} value={editVolunteerDraft.name} onChange={e => setEditVolunteerDraft({ ...editVolunteerDraft, name: e.target.value })} /></td>
                            <td><input style={inputStyle} value={editVolunteerDraft.assignment || ""} onChange={e => setEditVolunteerDraft({ ...editVolunteerDraft, assignment: e.target.value })} /></td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <IconBtn title="Save" onClick={() => saveVolunteer(editVolunteerDraft)}>✔️</IconBtn>
                                <IconBtn title="Cancel" onClick={() => { setEditVolunteerId(null); setEditVolunteerDraft(null); }}>✖️</IconBtn>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={v.id}>
                            <td>{v.name}</td>
                            <td>{v.assignment || "—"}</td>
                            {canEdit && (
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <IconBtn title="Edit" onClick={() => { setEditVolunteerId(v.id); setEditVolunteerDraft(v); }}>✏️</IconBtn>
                                  <IconBtn title="Delete" danger onClick={() => deleteVolunteer(v.id)}>🗑️</IconBtn>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      ))}
                      {volunteers.length === 0 && <tr><td colSpan={3} className="text-muted">No volunteers yet.</td></tr>}
                    </tbody>
                  </table>
                </Section>

                <Section
                  title="Kids"
                  action={canEdit && (
                    <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewKid(blankKid())}>
                      ➕ Add Kid
                    </button>
                  )}
                >
                  {newKid && (
                    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                      <FormRow>
                        <Field label="Name"><input style={inputStyle} value={newKid.name} onChange={e => setNewKid({ ...newKid, name: e.target.value })} /></Field>
                        <Field label="Age"><input type="number" style={inputStyle} value={newKid.age} onChange={e => setNewKid({ ...newKid, age: e.target.value })} /></Field>
                        <Field label="Allergies / Notes"><input style={inputStyle} value={newKid.allergies} onChange={e => setNewKid({ ...newKid, allergies: e.target.value })} /></Field>
                      </FormRow>
                      <FormActions onSave={saveNewKid} onCancel={() => setNewKid(null)} />
                    </div>
                  )}
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr><th>Name</th><th>Age</th><th>Allergies / Notes</th>{canEdit && <th style={{ width: 90 }}></th>}</tr>
                    </thead>
                    <tbody>
                      {kids.map(k => (
                        editKidId === k.id ? (
                          <tr key={k.id}>
                            <td><input style={inputStyle} value={editKidDraft.name} onChange={e => setEditKidDraft({ ...editKidDraft, name: e.target.value })} /></td>
                            <td><input type="number" style={inputStyle} value={editKidDraft.age || ""} onChange={e => setEditKidDraft({ ...editKidDraft, age: e.target.value })} /></td>
                            <td><input style={inputStyle} value={editKidDraft.allergies || ""} onChange={e => setEditKidDraft({ ...editKidDraft, allergies: e.target.value })} /></td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <IconBtn title="Save" onClick={() => saveKid(editKidDraft)}>✔️</IconBtn>
                                <IconBtn title="Cancel" onClick={() => { setEditKidId(null); setEditKidDraft(null); }}>✖️</IconBtn>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={k.id}>
                            <td>{k.name}</td>
                            <td>{k.age ?? "—"}</td>
                            <td>{k.allergies || "—"}</td>
                            {canEdit && (
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <IconBtn title="Edit" onClick={() => { setEditKidId(k.id); setEditKidDraft(k); }}>✏️</IconBtn>
                                  <IconBtn title="Delete" danger onClick={() => deleteKid(k.id)}>🗑️</IconBtn>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      ))}
                      {kids.length === 0 && <tr><td colSpan={4} className="text-muted">No kids yet.</td></tr>}
                    </tbody>
                  </table>
                </Section>
              </>
            )}

            {/* ---------------- SCHEDULE ---------------- */}
            {tab === "schedule" && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {DAY_OPTIONS.map(day => (
                    <button
                      key={day}
                      onClick={() => setScheduleDay(day)}
                      className={scheduleDay === day ? "btn btn-primary" : "btn btn-outline"}
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <Section
                  title={`${scheduleDay} — Run of Show`}
                  action={canEdit && (
                    <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewScheduleItem(blankScheduleItem(scheduleDay))}>
                      ➕ Add Item
                    </button>
                  )}
                >
                  {newScheduleItem && (
                    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                      <FormRow>
                        <Field label="Day">
                          <select style={inputStyle} value={newScheduleItem.day} onChange={e => setNewScheduleItem({ ...newScheduleItem, day: e.target.value })}>
                            {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </Field>
                        <Field label="Date"><input style={inputStyle} placeholder="e.g. 2026-08-14" value={newScheduleItem.date} onChange={e => setNewScheduleItem({ ...newScheduleItem, date: e.target.value })} /></Field>
                        <Field label="Time"><input style={inputStyle} placeholder="e.g. 9:15-9:30 AM" value={newScheduleItem.time} onChange={e => setNewScheduleItem({ ...newScheduleItem, time: e.target.value })} /></Field>
                      </FormRow>
                      <FormRow>
                        <Field label="Activity"><input style={inputStyle} value={newScheduleItem.activity} onChange={e => setNewScheduleItem({ ...newScheduleItem, activity: e.target.value })} /></Field>
                        <Field label="Volunteers Needed"><input style={inputStyle} value={newScheduleItem.volunteers_needed} onChange={e => setNewScheduleItem({ ...newScheduleItem, volunteers_needed: e.target.value })} /></Field>
                      </FormRow>
                      <FormRow>
                        <Field label="Items Needed"><textarea style={{ ...inputStyle, minHeight: 50 }} value={newScheduleItem.items_needed} onChange={e => setNewScheduleItem({ ...newScheduleItem, items_needed: e.target.value })} /></Field>
                        <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={newScheduleItem.notes} onChange={e => setNewScheduleItem({ ...newScheduleItem, notes: e.target.value })} /></Field>
                      </FormRow>
                      <FormActions onSave={saveNewScheduleItem} onCancel={() => setNewScheduleItem(null)} />
                    </div>
                  )}

                  {scheduleForDay.length === 0 && !newScheduleItem && (
                    <p className="text-muted">No schedule items for {scheduleDay} yet.</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {scheduleForDay.map(item => (
                      editScheduleId === item.id ? (
                        <div key={item.id} className="card" style={{ padding: 16 }}>
                          <FormRow>
                            <Field label="Day">
                              <select style={inputStyle} value={editScheduleDraft.day} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, day: e.target.value })}>
                                {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </Field>
                            <Field label="Date"><input style={inputStyle} value={editScheduleDraft.date || ""} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, date: e.target.value })} /></Field>
                            <Field label="Time"><input style={inputStyle} value={editScheduleDraft.time || ""} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, time: e.target.value })} /></Field>
                          </FormRow>
                          <FormRow>
                            <Field label="Activity"><input style={inputStyle} value={editScheduleDraft.activity} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, activity: e.target.value })} /></Field>
                            <Field label="Volunteers Needed"><input style={inputStyle} value={editScheduleDraft.volunteers_needed || ""} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, volunteers_needed: e.target.value })} /></Field>
                          </FormRow>
                          <FormRow>
                            <Field label="Items Needed"><textarea style={{ ...inputStyle, minHeight: 50 }} value={editScheduleDraft.items_needed || ""} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, items_needed: e.target.value })} /></Field>
                            <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={editScheduleDraft.notes || ""} onChange={e => setEditScheduleDraft({ ...editScheduleDraft, notes: e.target.value })} /></Field>
                          </FormRow>
                          <FormActions onSave={() => saveScheduleItem(editScheduleDraft)} onCancel={() => { setEditScheduleId(null); setEditScheduleDraft(null); }} />
                        </div>
                      ) : (
                        <div key={item.id} className="card" style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <div style={{ minWidth: 130, flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, color: "var(--forest)", fontSize: "0.9rem" }}>{item.time || "—"}</div>
                              {item.date && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{item.date}</div>}
                            </div>
                            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                              <strong style={{ fontSize: "0.98rem" }}>{item.activity}</strong>
                              {item.volunteers_needed && <div className="text-muted" style={{ fontSize: "0.82rem", marginTop: 3 }}>👤 {item.volunteers_needed}</div>}
                              {item.items_needed && <div className="text-muted" style={{ fontSize: "0.82rem", marginTop: 3 }}>🎒 {item.items_needed}</div>}
                              {item.notes && <div style={{ fontSize: "0.85rem", marginTop: 6 }}>{item.notes}</div>}
                            </div>
                            {canEdit && (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
                                <IconBtn title="Edit" onClick={() => { setEditScheduleId(item.id); setEditScheduleDraft(item); }}>✏️</IconBtn>
                                <IconBtn title="Delete" danger onClick={() => deleteScheduleItem(item.id)}>🗑️</IconBtn>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </Section>

                <Section
                  title={`${scheduleDay} — Craft / Activity`}
                  action={canEdit && (
                    <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewCraft(blankCraft(scheduleDay))}>
                      ➕ Add Craft
                    </button>
                  )}
                >
                  {newCraft && (
                    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                      <FormRow>
                        <Field label="Title"><input style={inputStyle} value={newCraft.title} onChange={e => setNewCraft({ ...newCraft, title: e.target.value })} /></Field>
                        <Field label="Ages"><input style={inputStyle} value={newCraft.ages} onChange={e => setNewCraft({ ...newCraft, ages: e.target.value })} /></Field>
                      </FormRow>
                      <FormRow>
                        <Field label="Materials"><textarea style={{ ...inputStyle, minHeight: 50 }} value={newCraft.materials} onChange={e => setNewCraft({ ...newCraft, materials: e.target.value })} /></Field>
                        <Field label="How-To"><textarea style={{ ...inputStyle, minHeight: 50 }} value={newCraft.how_to} onChange={e => setNewCraft({ ...newCraft, how_to: e.target.value })} /></Field>
                      </FormRow>
                      <FormRow>
                        <Field label="Things to Bring"><input style={inputStyle} value={newCraft.things_to_bring} onChange={e => setNewCraft({ ...newCraft, things_to_bring: e.target.value })} /></Field>
                      </FormRow>
                      <FormActions onSave={saveNewCraft} onCancel={() => setNewCraft(null)} />
                    </div>
                  )}

                  {craftsForDay.length === 0 && !newCraft && (
                    <p className="text-muted">No craft logged for {scheduleDay} yet.</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {craftsForDay.map(c => (
                      editCraftId === c.id ? (
                        <div key={c.id} className="card" style={{ padding: 16 }}>
                          <FormRow>
                            <Field label="Title"><input style={inputStyle} value={editCraftDraft.title || ""} onChange={e => setEditCraftDraft({ ...editCraftDraft, title: e.target.value })} /></Field>
                            <Field label="Ages"><input style={inputStyle} value={editCraftDraft.ages || ""} onChange={e => setEditCraftDraft({ ...editCraftDraft, ages: e.target.value })} /></Field>
                          </FormRow>
                          <FormRow>
                            <Field label="Materials"><textarea style={{ ...inputStyle, minHeight: 50 }} value={editCraftDraft.materials || ""} onChange={e => setEditCraftDraft({ ...editCraftDraft, materials: e.target.value })} /></Field>
                            <Field label="How-To"><textarea style={{ ...inputStyle, minHeight: 50 }} value={editCraftDraft.how_to || ""} onChange={e => setEditCraftDraft({ ...editCraftDraft, how_to: e.target.value })} /></Field>
                          </FormRow>
                          <FormRow>
                            <Field label="Things to Bring"><input style={inputStyle} value={editCraftDraft.things_to_bring || ""} onChange={e => setEditCraftDraft({ ...editCraftDraft, things_to_bring: e.target.value })} /></Field>
                          </FormRow>
                          <FormActions onSave={() => saveCraft(editCraftDraft)} onCancel={() => { setEditCraftId(null); setEditCraftDraft(null); }} />
                        </div>
                      ) : (
                        <div key={c.id} className="card" style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 300px" }}>
                              <strong>{c.title || "Craft"}</strong>{c.ages && <span className="text-muted" style={{ marginLeft: 8, fontSize: "0.8rem" }}>Ages: {c.ages}</span>}
                              {c.materials && <div style={{ fontSize: "0.85rem", marginTop: 6 }}><b>Materials:</b> {c.materials}</div>}
                              {c.how_to && <div style={{ fontSize: "0.85rem", marginTop: 6 }}><b>How-to:</b> {c.how_to}</div>}
                              {c.things_to_bring && <div className="text-muted" style={{ fontSize: "0.82rem", marginTop: 6 }}>🎒 {c.things_to_bring}</div>}
                            </div>
                            {canEdit && (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <IconBtn title="Edit" onClick={() => { setEditCraftId(c.id); setEditCraftDraft(c); }}>✏️</IconBtn>
                                <IconBtn title="Delete" danger onClick={() => deleteCraft(c.id)}>🗑️</IconBtn>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ---------------- BUDGET ---------------- */}
            {tab === "budget" && (
              <Section
                title="Budget & Expenses"
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewBudgetItem(blankBudgetItem())}>
                    ➕ Add Line
                  </button>
                )}
              >
                <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                  <Chip label="Total Income" value={`$${budgetTotals.income.toFixed(2)}`} />
                  <Chip label="Total Expenses (Actual)" value={`$${budgetTotals.actual.toFixed(2)}`} />
                  <Chip label="Total Expenses (Projected)" value={`$${budgetTotals.projected.toFixed(2)}`} />
                </div>

                {newBudgetItem && (
                  <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <FormRow>
                      <Field label="Month"><input style={inputStyle} value={newBudgetItem.month} onChange={e => setNewBudgetItem({ ...newBudgetItem, month: e.target.value })} /></Field>
                      <Field label="Income (actual)"><input type="number" step="0.01" style={inputStyle} value={newBudgetItem.income_actual} onChange={e => setNewBudgetItem({ ...newBudgetItem, income_actual: e.target.value })} /></Field>
                      <Field label="Expenses (actual)"><input type="number" step="0.01" style={inputStyle} value={newBudgetItem.expenses_actual} onChange={e => setNewBudgetItem({ ...newBudgetItem, expenses_actual: e.target.value })} /></Field>
                      <Field label="Expenses (projected)"><input type="number" step="0.01" style={inputStyle} value={newBudgetItem.expenses_projected} onChange={e => setNewBudgetItem({ ...newBudgetItem, expenses_projected: e.target.value })} /></Field>
                    </FormRow>
                    <FormRow>
                      <Field label="Related Files"><input style={inputStyle} value={newBudgetItem.related_files} onChange={e => setNewBudgetItem({ ...newBudgetItem, related_files: e.target.value })} /></Field>
                      <Field label="Notes"><input style={inputStyle} value={newBudgetItem.notes} onChange={e => setNewBudgetItem({ ...newBudgetItem, notes: e.target.value })} /></Field>
                    </FormRow>
                    <FormActions onSave={saveNewBudgetItem} onCancel={() => setNewBudgetItem(null)} />
                  </div>
                )}

                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Month</th><th>Income (actual)</th><th>Expenses (actual)</th><th>Expenses (projected)</th>
                      <th>Related Files</th><th>Notes</th>{canEdit && <th style={{ width: 90 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItems.map(b => (
                      editBudgetId === b.id ? (
                        <tr key={b.id}>
                          <td><input style={inputStyle} value={editBudgetDraft.month || ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, month: e.target.value })} /></td>
                          <td><input type="number" step="0.01" style={inputStyle} value={editBudgetDraft.income_actual ?? ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, income_actual: e.target.value })} /></td>
                          <td><input type="number" step="0.01" style={inputStyle} value={editBudgetDraft.expenses_actual ?? ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, expenses_actual: e.target.value })} /></td>
                          <td><input type="number" step="0.01" style={inputStyle} value={editBudgetDraft.expenses_projected ?? ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, expenses_projected: e.target.value })} /></td>
                          <td><input style={inputStyle} value={editBudgetDraft.related_files || ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, related_files: e.target.value })} /></td>
                          <td><input style={inputStyle} value={editBudgetDraft.notes || ""} onChange={e => setEditBudgetDraft({ ...editBudgetDraft, notes: e.target.value })} /></td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <IconBtn title="Save" onClick={() => saveBudgetItem(editBudgetDraft)}>✔️</IconBtn>
                              <IconBtn title="Cancel" onClick={() => { setEditBudgetId(null); setEditBudgetDraft(null); }}>✖️</IconBtn>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={b.id}>
                          <td>{b.month || "—"}</td>
                          <td>{b.income_actual != null ? `$${Number(b.income_actual).toFixed(2)}` : "—"}</td>
                          <td>{b.expenses_actual != null ? `$${Number(b.expenses_actual).toFixed(2)}` : "—"}</td>
                          <td>{b.expenses_projected != null ? `$${Number(b.expenses_projected).toFixed(2)}` : "—"}</td>
                          <td>{b.related_files || "—"}</td>
                          <td>{b.notes || "—"}</td>
                          {canEdit && (
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <IconBtn title="Edit" onClick={() => { setEditBudgetId(b.id); setEditBudgetDraft(b); }}>✏️</IconBtn>
                                <IconBtn title="Delete" danger onClick={() => deleteBudgetItem(b.id)}>🗑️</IconBtn>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    ))}
                    {budgetItems.length === 0 && <tr><td colSpan={7} className="text-muted">No budget lines yet.</td></tr>}
                  </tbody>
                </table>
              </Section>
            )}

            {/* ---------------- AUDIO/VIDEO ---------------- */}
            {tab === "av" && (
              <Section
                title="Audio / Video Links"
                action={canEdit && (
                  <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewAvLink(blankAvLink())}>
                    ➕ Add Link
                  </button>
                )}
              >
                {newAvLink && (
                  <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <FormRow>
                      <Field label="Category"><input style={inputStyle} value={newAvLink.category} onChange={e => setNewAvLink({ ...newAvLink, category: e.target.value })} /></Field>
                      <Field label="Label"><input style={inputStyle} value={newAvLink.label} onChange={e => setNewAvLink({ ...newAvLink, label: e.target.value })} /></Field>
                      <Field label="URL"><input style={inputStyle} value={newAvLink.url} onChange={e => setNewAvLink({ ...newAvLink, url: e.target.value })} /></Field>
                    </FormRow>
                    <FormActions onSave={saveNewAvLink} onCancel={() => setNewAvLink(null)} />
                  </div>
                )}

                {Object.keys(avByCategory).length === 0 && !newAvLink && (
                  <p className="text-muted">No links added yet.</p>
                )}

                {Object.entries(avByCategory).map(([category, links]) => (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: "8px 0 10px", color: "var(--forest)" }}>{category}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {links.map(l => (
                        editAvLinkId === l.id ? (
                          <div key={l.id} className="card" style={{ padding: 16 }}>
                            <FormRow>
                              <Field label="Category"><input style={inputStyle} value={editAvLinkDraft.category || ""} onChange={e => setEditAvLinkDraft({ ...editAvLinkDraft, category: e.target.value })} /></Field>
                              <Field label="Label"><input style={inputStyle} value={editAvLinkDraft.label} onChange={e => setEditAvLinkDraft({ ...editAvLinkDraft, label: e.target.value })} /></Field>
                              <Field label="URL"><input style={inputStyle} value={editAvLinkDraft.url || ""} onChange={e => setEditAvLinkDraft({ ...editAvLinkDraft, url: e.target.value })} /></Field>
                            </FormRow>
                            <FormActions onSave={() => saveAvLink(editAvLinkDraft)} onCancel={() => { setEditAvLinkId(null); setEditAvLinkDraft(null); }} />
                          </div>
                        ) : (
                          <div key={l.id} className="card" style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <strong>{l.label}</strong>
                              {l.url && (
                                <div style={{ fontSize: "0.82rem", marginTop: 2 }}>
                                  <a href={l.url} target="_blank" rel="noreferrer">{l.url}</a>
                                </div>
                              )}
                            </div>
                            {canEdit && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <IconBtn title="Edit" onClick={() => { setEditAvLinkId(l.id); setEditAvLinkDraft(l); }}>✏️</IconBtn>
                                <IconBtn title="Delete" danger onClick={() => deleteAvLink(l.id)}>🗑️</IconBtn>
                              </div>
                            )}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}

const Chip = ({ label, value }) => (
  <div style={{
    background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 10,
    padding: "10px 16px", minWidth: 160,
  }}>
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--forest)" }}>{value}</div>
  </div>
);
