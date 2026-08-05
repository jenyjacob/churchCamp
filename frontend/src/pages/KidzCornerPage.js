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

const ExportBtn = ({ onClick, label = "Export Excel" }) => (
  <button
    className="btn btn-outline"
    style={{ padding: "0 14px", height: 38, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}
    onClick={onClick}
  >
    📥 {label}
  </button>
);

function exportToExcel(filename, headers, rows) {
  const escapeCell = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const todayStamp = () => new Date().toISOString().split("T")[0];

export default function KidzCornerPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("kidz_corner", "edit");
  const canCheckIn = hasPermission("kidz_corner_checkin", "edit");
  const canViewBudget = hasPermission("kidz_corner_budget", "read");
  const canEditBudget = hasPermission("kidz_corner_budget", "edit");

  const [tab, setTab] = useState(() => (canEdit ? "overview" : "checkin"));
  const [scheduleDay, setScheduleDay] = useState("Friday Night");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);

  const [volunteers, setVolunteers] = useState([]);
  const [kids, setKids] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [crafts, setCrafts] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [avLinks, setAvLinks] = useState([]);

  const [checkinSearch, setCheckinSearch] = useState("");
  const [checkinBusyId, setCheckinBusyId] = useState(null);
  const [editAllergyKidId, setEditAllergyKidId] = useState(null);
  const [editAllergyDraft, setEditAllergyDraft] = useState("");

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
    const budgetCall = canViewBudget
      ? api.get("/api/kidz-corner/budget")
      : Promise.resolve({ data: { items: [] } });

    Promise.all([
      api.get("/api/kidz-corner/volunteers"),
      api.get("/api/kidz-corner/kids"),
      api.get("/api/kidz-corner/checkins"),
      api.get("/api/kidz-corner/schedule"),
      api.get("/api/kidz-corner/crafts"),
      budgetCall,
      api.get("/api/kidz-corner/av-links"),
    ])
      .then(([a, b, c, d, e, f, g]) => {
        setVolunteers(a.data.volunteers || []);
        setKids(b.data.kids || []);
        setCheckins(c.data.checkins || []);
        setScheduleItems(d.data.items || []);
        setCrafts(e.data.crafts || []);
        setBudgetItems(f.data.items || []);
        setAvLinks(g.data.links || []);
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

  // ---- VBS Check-In ----
  const checkInKid = async (kidId, kidName) => {
    setCheckinBusyId(kidId);
    try {
      await api.post("/api/kidz-corner/checkins", { kid_id: kidId });
      showFlash("success", `✅ ${kidName} checked in.`);
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to check in.");
    } finally {
      setCheckinBusyId(null);
    }
  };

  const checkOutKid = async (checkinId, kidName) => {
    setCheckinBusyId(checkinId);
    try {
      await api.post(`/api/kidz-corner/checkins/${checkinId}/checkout`);
      showFlash("success", `👋 ${kidName} checked out.`);
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to check out.");
    } finally {
      setCheckinBusyId(null);
    }
  };

  const resetKidCheckin = async (checkinId) => {
    if (!await window.confirm("Reset this check-in record? This cannot be undone.")) return;
    try {
      await api.delete(`/api/kidz-corner/checkins/${checkinId}`);
      showFlash("success", "Check-in reset.");
      fetchAll();
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to reset check-in.");
    }
  };

  const startEditAllergy = (kid) => {
    setEditAllergyKidId(kid.id);
    setEditAllergyDraft(kid.allergies || "");
  };

  const cancelEditAllergy = () => {
    setEditAllergyKidId(null);
    setEditAllergyDraft("");
  };

  const saveAllergy = async (kidId) => {
    try {
      const res = await api.put(`/api/kidz-corner/kids/${kidId}/allergies`, { allergies: editAllergyDraft });
      setKids(prev => prev.map(k => (k.id === kidId ? res.data.kid : k)));
      setEditAllergyKidId(null);
      setEditAllergyDraft("");
      showFlash("success", "Allergies / notes updated.");
    } catch (err) {
      showFlash("error", err.response?.data?.error || "Failed to update allergies.");
    }
  };

  // ---- Excel exports ----
  const exportVolunteers = () => exportToExcel(
    `kidz_corner_volunteers_${todayStamp()}.csv`,
    ["Name", "Assignment"],
    volunteers.map(v => [v.name, v.assignment || ""])
  );

  const exportKids = () => exportToExcel(
    `kidz_corner_kids_${todayStamp()}.csv`,
    ["Name", "Age", "Allergies / Notes"],
    kids.map(k => [k.name, k.age ?? "", k.allergies || ""])
  );

  const exportCheckinStatus = () => exportToExcel(
    `kidz_corner_checkin_status_${todayStamp()}.csv`,
    ["Name", "Age", "Allergies / Notes", "Status", "Checked In At", "Checked In By"],
    visibleKidsForCheckin.map(k => {
      const active = activeCheckinByKidId[k.id];
      return [
        k.name, k.age ?? "", k.allergies || "",
        active ? "Checked In" : "Not Checked In",
        active ? new Date(active.checked_in_at).toLocaleString() : "",
        active ? (active.checked_in_by || "") : "",
      ];
    })
  );

  const exportRecentActivity = () => exportToExcel(
    `kidz_corner_checkin_activity_${todayStamp()}.csv`,
    ["Kid", "Checked In At", "Checked In By", "Checked Out At", "Checked Out By"],
    recentCheckins.map(c => [
      c.kid_name || "",
      c.checked_in_at ? new Date(c.checked_in_at).toLocaleString() : "",
      c.checked_in_by || "",
      c.checked_out_at ? new Date(c.checked_out_at).toLocaleString() : "",
      c.checked_out_by || "",
    ])
  );

  const exportAllergyList = () => exportToExcel(
    `kidz_corner_allergy_list_${todayStamp()}.csv`,
    ["Name", "Allergy / Medical Note"],
    kidsWithAllergies.map(k => [k.name, k.allergies])
  );

  const exportSchedule = () => exportToExcel(
    `kidz_corner_schedule_${todayStamp()}.csv`,
    ["Day", "Date", "Time", "Activity", "Volunteers Needed", "Items Needed", "Notes"],
    scheduleItems.map(i => [i.day, i.date || "", i.time || "", i.activity, i.volunteers_needed || "", i.items_needed || "", i.notes || ""])
  );

  const exportCrafts = () => exportToExcel(
    `kidz_corner_crafts_${todayStamp()}.csv`,
    ["Day", "Title", "Materials", "How To", "Ages", "Things To Bring"],
    crafts.map(c => [c.day, c.title || "", c.materials || "", c.how_to || "", c.ages || "", c.things_to_bring || ""])
  );

  const exportBudget = () => exportToExcel(
    `kidz_corner_budget_${todayStamp()}.csv`,
    ["Month", "Income (Actual)", "Expenses (Actual)", "Expenses (Projected)", "Related Files", "Notes"],
    budgetItems.map(b => [b.month || "", b.income_actual ?? "", b.expenses_actual ?? "", b.expenses_projected ?? "", b.related_files || "", b.notes || ""])
  );

  const exportAvLinks = () => exportToExcel(
    `kidz_corner_av_links_${todayStamp()}.csv`,
    ["Category", "Label", "URL"],
    avLinks.map(l => [l.category || "", l.label, l.url || ""])
  );

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
    { key: "overview", label: "📊 Overview" },
    { key: "people", label: "👥 People" },
    { key: "checkin", label: "✅ Check-In" },
    { key: "schedule", label: "🗓️ Schedule" },
    ...(canViewBudget ? [{ key: "budget", label: "💰 Budget" }] : []),
    { key: "av", label: "🎬 Audio/Video" },
  ];

  // Map kid_id -> active (not checked out) checkin record, if any
  const activeCheckinByKidId = checkins.reduce((acc, c) => {
    if (!c.checked_out_at) acc[c.kid_id] = c;
    return acc;
  }, {});

  const checkinSearchLower = checkinSearch.trim().toLowerCase();
  const visibleKidsForCheckin = kids
    .filter(k => !checkinSearchLower || k.name.toLowerCase().includes(checkinSearchLower))
    .sort((a, b) => a.name.localeCompare(b.name));

  const checkedInCount = kids.filter(k => activeCheckinByKidId[k.id]).length;

  const recentCheckins = [...checkins]
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at))
    .slice(0, 10);

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

  // ---- Overview / dashboard derived data ----
  const kidsWithAllergies = kids.filter(k => (k.allergies || "").trim().length > 0);
  const activeCheckinsSorted = checkins
    .filter(c => !c.checked_out_at)
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at));

  return (
    <>
      <div className="top-bar">
        <h1>🧸 Kidz Corner</h1>
        <span className="text-muted">Overview, volunteers, kids, check-in, session schedule, budget &amp; audio/video for Kidz Corner</span>
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
            {/* ---------------- OVERVIEW ---------------- */}
            {tab === "overview" && (
              <>
                <Section title="At a Glance">
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <Chip label="Kids Registered" value={kids.length} />
                    <Chip label="Currently Checked In" value={checkedInCount} />
                    <Chip label="Volunteers on Roster" value={volunteers.length} />
                    <Chip label="Allergy / Medical Notes" value={kidsWithAllergies.length} />
                  </div>
                </Section>

                <Section
                  title="⚠️ Allergy & Medical Notes"
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {kidsWithAllergies.length > 0 && <ExportBtn onClick={exportAllergyList} />}
                      <button className="btn btn-outline" style={{ padding: "0 14px", height: 38, fontSize: "0.8rem" }} onClick={() => setTab("checkin")}>
                        Manage in Check-In →
                      </button>
                    </div>
                  }
                >
                  {kidsWithAllergies.length === 0 ? (
                    <p className="text-muted">No allergies or medical notes on file.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {kidsWithAllergies.map(k => (
                        <div key={k.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "8px 14px", borderRadius: 8, background: "rgba(176, 42, 42, 0.06)",
                          border: "1px solid rgba(176, 42, 42, 0.2)",
                        }}>
                          <strong>{k.name}</strong>
                          <span style={{ color: "#B02A2A", fontSize: "0.85rem" }}>⚠️ {k.allergies}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  title="Who's Checked In Right Now"
                  action={
                    <button className="btn btn-outline" style={{ padding: "0 14px", height: 34, fontSize: "0.8rem" }} onClick={() => setTab("checkin")}>
                      Go to Check-In →
                    </button>
                  }
                >
                  {activeCheckinsSorted.length === 0 ? (
                    <p className="text-muted">No kids are currently checked in.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeCheckinsSorted.map(c => (
                        <span key={c.id} className="badge badge-green" style={{ fontSize: "0.8rem" }}>
                          {c.kid_name} · {new Date(c.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  title={`🗓️ ${scheduleDay} — Schedule Preview`}
                  action={
                    <button className="btn btn-outline" style={{ padding: "0 14px", height: 34, fontSize: "0.8rem" }} onClick={() => setTab("schedule")}>
                      Full Schedule →
                    </button>
                  }
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {DAY_OPTIONS.map(day => (
                      <button
                        key={day}
                        onClick={() => setScheduleDay(day)}
                        className={scheduleDay === day ? "btn btn-primary" : "btn btn-outline"}
                        style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  {scheduleForDay.length === 0 ? (
                    <p className="text-muted">No schedule items planned for {scheduleDay} yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {scheduleForDay.map(item => (
                        <div key={item.id} style={{
                          display: "flex", justifyContent: "space-between", gap: 12,
                          padding: "8px 12px", borderRadius: 8, background: "var(--cream)",
                          border: "1px solid var(--border)", fontSize: "0.85rem", flexWrap: "wrap",
                        }}>
                          <span><strong>{item.time || "—"}</strong> &nbsp; {item.activity}</span>
                          {item.volunteers_needed && <span className="text-muted">👥 {item.volunteers_needed}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {canViewBudget && (
                  <Section
                    title="💰 Budget Snapshot"
                    action={
                      <button className="btn btn-outline" style={{ padding: "0 14px", height: 34, fontSize: "0.8rem" }} onClick={() => setTab("budget")}>
                        Full Budget →
                      </button>
                    }
                  >
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      <Chip label="Total Income" value={`$${budgetTotals.income.toFixed(2)}`} />
                      <Chip label="Total Expenses (Actual)" value={`$${budgetTotals.actual.toFixed(2)}`} />
                      <Chip label="Total Expenses (Projected)" value={`$${budgetTotals.projected.toFixed(2)}`} />
                    </div>
                  </Section>
                )}
              </>
            )}

            {/* ---------------- PEOPLE ---------------- */}
            {tab === "people" && (
              <>
                <Section
                  title="Volunteers"
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ExportBtn onClick={exportVolunteers} />
                      {canEdit && (
                        <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewVolunteer(blankVolunteer())}>
                          ➕ Add Volunteer
                        </button>
                      )}
                    </div>
                  }
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
                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ width: "100%", minWidth: "500px" }}>
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
                  </div>
                </Section>

                <Section
                  title="Kids"
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ExportBtn onClick={exportKids} />
                      {canEdit && (
                        <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewKid(blankKid())}>
                          ➕ Add Kid
                        </button>
                      )}
                    </div>
                  }
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
                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ width: "100%", minWidth: "600px" }}>
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
                  </div>
                </Section>
              </>
            )}

            {/* ---------------- VBS CHECK-IN ---------------- */}
            {tab === "checkin" && (
              <>
                <Section
                  title="VBS Check-In Status"
                  action={<ExportBtn onClick={exportCheckinStatus} />}
                >
                  <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                    <Chip label="Registered Kids" value={kids.length} />
                    <Chip label="Currently Checked In" value={checkedInCount} />
                  </div>

                  <div style={{ marginBottom: 16, maxWidth: 340 }}>
                    <Field label="Search Kids">
                      <input
                        style={inputStyle}
                        placeholder="Search by name..."
                        value={checkinSearch}
                        onChange={e => setCheckinSearch(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ width: "100%", minWidth: "750px" }}>
                      <thead>
                        <tr>
                          <th>Name</th><th>Age</th><th>Allergies / Notes</th><th>Status</th><th style={{ width: 140 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleKidsForCheckin.map(k => {
                          const active = activeCheckinByKidId[k.id];
                          const busy = checkinBusyId === k.id || (active && checkinBusyId === active.id);
                          const editingAllergy = editAllergyKidId === k.id;
                          return (
                            <tr key={k.id}>
                              <td>{k.name}</td>
                              <td>{k.age ?? "—"}</td>
                              <td style={{ minWidth: 200 }}>
                                {editingAllergy ? (
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <input
                                      style={inputStyle}
                                      autoFocus
                                      placeholder="e.g. peanut allergy"
                                      value={editAllergyDraft}
                                      onChange={e => setEditAllergyDraft(e.target.value)}
                                    />
                                    <IconBtn title="Save" onClick={() => saveAllergy(k.id)}>✔️</IconBtn>
                                    <IconBtn title="Cancel" onClick={cancelEditAllergy}>✖️</IconBtn>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={k.allergies ? { color: "#B02A2A", fontWeight: 600 } : undefined}>
                                      {k.allergies ? `⚠️ ${k.allergies}` : "—"}
                                    </span>
                                    {canCheckIn && (
                                      <IconBtn title="Add / edit allergy note" onClick={() => startEditAllergy(k)}>✏️</IconBtn>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td>
                                {active ? (
                                  <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
                                    ✅ Checked in {new Date(active.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {active.checked_in_by ? ` by ${active.checked_in_by}` : ""}
                                  </span>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: "0.8rem" }}>Not checked in</span>
                                )}
                              </td>
                              <td>
                                {canCheckIn && (
                                  active ? (
                                    <button
                                      className="btn btn-outline"
                                      disabled={busy}
                                      style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                                      onClick={() => checkOutKid(active.id, k.name)}
                                    >
                                      Check Out
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-primary"
                                      disabled={busy}
                                      style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                                      onClick={() => checkInKid(k.id, k.name)}
                                    >
                                      Check In
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {visibleKidsForCheckin.length === 0 && (
                          <tr><td colSpan={5} className="text-muted">
                            {kids.length === 0 ? "No kids registered yet. Add them under the People tab." : "No kids match your search."}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section
                  title="Recent Activity"
                  action={<ExportBtn onClick={exportRecentActivity} />}
                >
                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ width: "100%", minWidth: "750px" }}>
                      <thead>
                        <tr>
                          <th>Kid</th><th>Checked In</th><th>By</th><th>Checked Out</th><th>By</th>{canEdit && <th style={{ width: 50 }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {recentCheckins.map(c => (
                          <tr key={c.id}>
                            <td>{c.kid_name || "—"}</td>
                            <td>{c.checked_in_at ? new Date(c.checked_in_at).toLocaleString() : "—"}</td>
                            <td>{c.checked_in_by || "—"}</td>
                            <td>{c.checked_out_at ? new Date(c.checked_out_at).toLocaleString() : "—"}</td>
                            <td>{c.checked_out_by || "—"}</td>
                            {canEdit && (
                              <td>
                                <IconBtn title="Reset check-in" danger onClick={() => resetKidCheckin(c.id)}>🗑️</IconBtn>
                              </td>
                            )}
                          </tr>
                        ))}
                        {recentCheckins.length === 0 && (
                          <tr><td colSpan={6} className="text-muted">No check-in activity yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ExportBtn onClick={exportSchedule} label="Export All Days" />
                      {canEdit && (
                        <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewScheduleItem(blankScheduleItem(scheduleDay))}>
                          ➕ Add Item
                        </button>
                      )}
                    </div>
                  }
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
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ExportBtn onClick={exportCrafts} label="Export All Days" />
                      {canEdit && (
                        <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewCraft(blankCraft(scheduleDay))}>
                          ➕ Add Craft
                        </button>
                      )}
                    </div>
                  }
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
            {tab === "budget" && canViewBudget && (
              <Section
                title="Budget & Expenses"
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ExportBtn onClick={exportBudget} />
                    {canEditBudget && (
                      <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewBudgetItem(blankBudgetItem())}>
                        ➕ Add Line
                      </button>
                    )}
                  </div>
                }
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

                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                    <thead>
                      <tr>
                        <th>Month</th><th>Income (actual)</th><th>Expenses (actual)</th><th>Expenses (projected)</th>
                        <th>Related Files</th><th>Notes</th>{canEditBudget && <th style={{ width: 90 }}></th>}
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
                            {canEditBudget && (
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
                </div>
              </Section>
            )}

            {/* ---------------- AUDIO/VIDEO ---------------- */}
            {tab === "av" && (
              <Section
                title="Audio / Video Links"
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ExportBtn onClick={exportAvLinks} />
                    {canEdit && (
                      <button className="btn btn-primary" style={{ padding: "0 16px", height: 38 }} onClick={() => setNewAvLink(blankAvLink())}>
                        ➕ Add Link
                      </button>
                    )}
                  </div>
                }
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
