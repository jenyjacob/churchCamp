import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function CheckInPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("checkin", "edit");
  const [search, setSearch] = useState("");
  const [campers, setCampers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeCheckins, setActiveCheckins] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [stats, setStats] = useState({ total_registered: 0, active_registered: 0, checked_in: 0, waivers_submitted: 0 });
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }
  const [allCampers, setAllCampers] = useState([]);
  const [checkedInSummary, setCheckedInSummary] = useState(null); // array of campers recently checked in
  const [settings, setSettings] = useState({ team_1_name: "Team Peter", team_2_name: "Team Paul", teams_published: "true", require_waiver_confirmation: "true", show_breakfast_option: "true" });
  const [breakfastMenuItems, setBreakfastMenuItems] = useState(["Pancakes", "Eggs", "Cereal", "Fruit"]);
  const [answeredBreakfastIds, setAnsweredBreakfastIds] = useState(new Set());
  const [breakfastOrdersByCamperId, setBreakfastOrdersByCamperId] = useState({});
  const [breakfastFlow, setBreakfastFlow] = useState({
    isOpen: false,
    members: [],        // full list of campers to ask (one at a time)
    currentIndex: 0,    // which member we're currently on
    step: "ask",        // "ask" | "items"
    selectedCounts: {},
    pendingOrders: [],  // [{camper, wants_breakfast, items}] collected so far
    onAllDone: null,
    isEdit: false
  });

  const showTeams = settings.teams_published !== "false";
  const requireWaiverConfirmation = settings.require_waiver_confirmation !== "false";
  const breakfastOptionEnabled = settings.show_breakfast_option !== "false";

  const getDisplayTeamName = (rawTeam) => {
    if (!rawTeam) return null;
    const clean = String(rawTeam).trim();
    const lower = clean.toLowerCase();
    if (lower === "team 1" || lower.includes("team 1") || lower.includes("peter")) {
      return settings.team_1_name || "Team 1";
    }
    if (lower === "team 2" || lower.includes("team 2") || lower.includes("paul")) {
      return settings.team_2_name || "Team 2";
    }
    return clean;
  };
  const [expandedGroups, setExpandedGroups] = useState({});
  const [activeTab, setActiveTab] = useState("onsite");
  const [checkedOut, setCheckedOut] = useState([]);
  const [checkoutSearch, setCheckoutSearch] = useState("");
  const [waiverModal, setWaiverModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    warningMessage: "",
    showWarning: false,
    onConfirm: null
  });

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleExportOnSite = () => {
    const escapeCell = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const headers = ["Camper Name", "Family Group", "Checked In At", "Checked In By", "Notes"];
    const rows = activeCheckins.map(ci => [
      ci.camper_name || "",
      ci.family_group || "",
      ci.checked_in_at ? new Date(ci.checked_in_at).toLocaleString() : "",
      ci.checked_in_by || "",
      ci.notes || "",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gca_currently_on_site_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleGroupExpand = (fg) => {
    setExpandedGroups(prev => ({
      ...prev,
      [fg]: prev[fg] === false ? true : false
    }));
  };

  const fetchActive = useCallback(() => {
    setLoadingActive(true);
    api.get("/api/checkin/?active_only=true&per_page=-1")
      .then(r => setActiveCheckins(r.data.checkins))
      .catch(() => {})
      .finally(() => setLoadingActive(false));
  }, []);

  const fetchStats = useCallback(() => {
    api.get("/api/campers/stats")
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  const fetchAllCampers = useCallback(() => {
    api.get("/api/campers/?page=1&per_page=-1&exclude_cancelled=true")
      .then(r => setAllCampers(r.data.campers || []))
      .catch(() => {});
  }, []);

  const fetchCheckedOut = useCallback(() => {
    api.get("/api/checkin/?per_page=-1")
      .then(r => setCheckedOut((r.data.checkins || []).filter(ci => ci.checked_out_at)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchActive();
    fetchStats();
    fetchAllCampers();
    fetchCheckedOut();

    const onVisible = () => { if (document.visibilityState === "visible") { fetchAllCampers(); fetchActive(); fetchCheckedOut(); } };
    document.addEventListener("visibilitychange", onVisible);

    // Fetch dynamic configurations
    api.get("/api/settings/")
      .then(res => {
        if (res.data.settings) {
          setSettings(res.data.settings);
          if (res.data.settings.breakfast_menu_items) {
            try {
              const parsed = JSON.parse(res.data.settings.breakfast_menu_items);
              if (Array.isArray(parsed)) setBreakfastMenuItems(parsed);
            } catch {
              // keep default list if stored value is malformed
            }
          }
        }
      })
      .catch(() => {});

    // Fetch campers who've already been asked about breakfast, so we don't re-prompt them
    api.get("/api/breakfast/answered-camper-ids")
      .then(res => setAnsweredBreakfastIds(new Set(res.data.camper_ids || [])))
      .catch(() => {});

    fetchBreakfastOrders();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchActive, fetchStats, fetchAllCampers, fetchCheckedOut]);

  const fetchBreakfastOrders = () => {
    api.get("/api/breakfast/orders")
      .then(res => {
        const map = {};
        (res.data.orders || []).forEach(o => { map[o.camper_id] = o; });
        setBreakfastOrdersByCamperId(map);
      })
      .catch(() => {});
  };

  const renderBreakfastBadge = (camperId) => {
    const order = breakfastOrdersByCamperId[camperId];
    if (!order || !order.wants_breakfast) return null;
    const itemEntries = Object.entries(order.items || {});
    return (
      <span
        className="badge badge-gold"
        title={itemEntries.length > 0 ? itemEntries.map(([name, count]) => `${count}x ${name}`).join(", ") : "Wants breakfast"}
        style={{ fontSize: "0.68rem", padding: "2px 6px", marginLeft: 8, whiteSpace: "nowrap" }}
      >
        🥞 {itemEntries.length > 0 ? itemEntries.map(([name, count]) => `${count}x ${name}`).join(", ") : "Breakfast"}
      </span>
    );
  };

  const renderCabinBadge = (camperId) => {
    const camper = allCampers.find(c => String(c.id) === String(camperId));
    if (!camper || !camper.cabin_group) return null;
    const [cabinName, roomName] = camper.cabin_group.split(" | ");
    const label = roomName ? `${cabinName} - ${roomName}` : cabinName;
    return (
      <span
        className="badge badge-blue"
        title={`Cabin: ${label}`}
        style={{ fontSize: "0.68rem", padding: "2px 6px", marginLeft: 8, whiteSpace: "nowrap" }}
      >
        🏠 {label}
      </span>
    );
  };

  const startBreakfastFlow = (camperList, onAllDone) => {
    const needsAsking = breakfastOptionEnabled
      ? camperList.filter(c => c && !answeredBreakfastIds.has(c.id))
      : [];

    if (needsAsking.length === 0) {
      onAllDone();
      return;
    }

    setBreakfastFlow({
      isOpen: true,
      members: needsAsking,
      currentIndex: 0,
      step: "ask",
      selectedCounts: {},
      pendingOrders: [],
      onAllDone,
      isEdit: false
    });
  };

  const RESET_FLOW = { isOpen: false, members: [], currentIndex: 0, step: "ask", selectedCounts: {}, pendingOrders: [], onAllDone: null, isEdit: false };

  const recordCurrentAndAdvance = async (wantsBreakfast, items) => {
    const { members, currentIndex, pendingOrders, onAllDone } = breakfastFlow;
    const currentMember = members[currentIndex];
    const newPending = [...pendingOrders, { camper: currentMember, wants_breakfast: wantsBreakfast, items }];
    const nextIndex = currentIndex + 1;

    if (nextIndex < members.length) {
      // More members to ask — advance to the next one
      setBreakfastFlow(prev => ({ ...prev, currentIndex: nextIndex, step: "ask", selectedCounts: {}, pendingOrders: newPending }));
      return;
    }

    // All members answered — close modal then submit individually
    setBreakfastFlow(RESET_FLOW);
    try {
      await Promise.all(newPending.map(o =>
        api.post("/api/breakfast/orders", {
          camper_ids: [o.camper.id],
          wants_breakfast: o.wants_breakfast,
          items: o.items
        })
      ));
      setAnsweredBreakfastIds(prev => {
        const next = new Set(prev);
        newPending.forEach(o => next.add(o.camper.id));
        return next;
      });
      fetchBreakfastOrders();
    } catch {
      // Non-fatal — check-in flow must not be blocked
    }
    if (onAllDone) onAllDone();
  };

  const submitBreakfastAnswer = (wantsBreakfast) => {
    if (wantsBreakfast) {
      setBreakfastFlow(prev => ({ ...prev, step: "items" }));
      return;
    }
    recordCurrentAndAdvance(false, {});
  };

  const handleBreakfastCountChange = (itemName, count) => {
    setBreakfastFlow(prev => ({
      ...prev,
      selectedCounts: { ...prev.selectedCounts, [itemName]: count }
    }));
  };

  const handleEditBreakfast = (ci) => {
    const camper = allCampers.find(c => String(c.id) === String(ci.camper_id));
    if (!camper) return;
    const existing = breakfastOrdersByCamperId[ci.camper_id];
    setBreakfastFlow({
      isOpen: true,
      members: [camper],
      currentIndex: 0,
      step: existing?.wants_breakfast ? "items" : "ask",
      selectedCounts: existing?.items || {},
      pendingOrders: [],
      onAllDone: () => {},
      isEdit: true
    });
  };

  const submitBreakfastItems = () => {
    recordCurrentAndAdvance(true, breakfastFlow.selectedCounts);
  };

  const searchCampers = useCallback(() => {
    if (!search.trim()) {
      setCampers([]);
      return;
    }
    setSearching(true);
    api.get(`/api/campers/?search=${encodeURIComponent(search)}&per_page=15&exclude_cancelled=true`)
      .then(r => setCampers(r.data.campers))
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(searchCampers, 300);
    return () => clearTimeout(t);
  }, [searchCampers]);

  const performCheckIn = async (camperId, fullName) => {
    try {
      await api.post("/api/checkin/", { camper_id: camperId });
      flash("success", `✅ ${fullName} checked in successfully!`);
      
      const camperDetails = allCampers.find(c => c.id === camperId);
      if (camperDetails) {
        startBreakfastFlow([camperDetails], () => setCheckedInSummary([camperDetails]));
      }

      setSearch("");
      setCampers([]);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", err.response?.data?.error || "Check-in failed.");
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckIn = (camper) => {
    if (camper.waiver_submitted || !requireWaiverConfirmation) {
      performCheckIn(camper.id, camper.full_name);
      return;
    }
    setWaiverModal({
      isOpen: true,
      title: "Waiver Form Confirmation",
      message: `Has ${camper.full_name} submitted their waiver form?`,
      warningMessage: `Please ask ${camper.full_name} to submit the waiver form before checking in.`,
      showWarning: false,
      onConfirm: () => performCheckIn(camper.id, camper.full_name)
    });
  };

  const performCheckInFamily = async (familyGroup, uncheckedCampers) => {
    try {
      // Execute sequentially to avoid concurrent database deadlock locks in MySQL
      for (const c of uncheckedCampers) {
        await api.post("/api/checkin/", { camper_id: c.id });
      }
      flash("success", `✅ Family Group ${familyGroup} checked in successfully (${uncheckedCampers.length} members)!`);
      
      const detailsList = uncheckedCampers.map(uc => allCampers.find(c => c.id === uc.id)).filter(Boolean);
      if (detailsList.length > 0) {
        startBreakfastFlow(detailsList, () => setCheckedInSummary(detailsList));
      }

      setSearch("");
      setCampers([]);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", "Failed to check in all family members.");
      fetchActive();
      fetchStats();
      fetchAllCampers();
    }
    setWaiverModal({ isOpen: false });
  };

  const handleCheckInFamily = (familyGroup, uncheckedCampers) => {
    const isWaiverSubmitted = uncheckedCampers.some(c => c.waiver_submitted);
    if (isWaiverSubmitted || !requireWaiverConfirmation) {
      performCheckInFamily(familyGroup, uncheckedCampers);
      return;
    }
    const names = uncheckedCampers.map(c => c.full_name).join(", ");
    setWaiverModal({
      isOpen: true,
      title: "Waiver Form Confirmation",
      message: `Have all members of Family Group ${familyGroup} (${names}) submitted their waiver forms?`,
      warningMessage: "Please ask all family members to submit their waiver forms before checking in.",
      showWarning: false,
      onConfirm: () => performCheckInFamily(familyGroup, uncheckedCampers)
    });
  };

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmBtnClass: "btn-primary",
    onConfirm: null,
    sharedRoommates: [],
    targetCheckin: null,
    cabinName: "",
    checkoutScope: "all"
  });

  const handleCheckOut = (checkin) => {
    const camperObj = allCampers.find(c => c.id === checkin.camper_id);
    const cabinInfo = camperObj?.cabin_group || "";
    const familyInfo = camperObj?.family_group || checkin.family_group || "";

    let sharedRoommates = [];
    let groupLabel = "";

    if (cabinInfo) {
      groupLabel = cabinInfo;
      sharedRoommates = activeCheckins.filter(ci => {
        const co = allCampers.find(c => c.id === ci.camper_id);
        return co && co.cabin_group === cabinInfo;
      });
    } else if (familyInfo) {
      groupLabel = `Family #${familyInfo}`;
      sharedRoommates = activeCheckins.filter(ci => {
        const co = allCampers.find(c => c.id === ci.camper_id);
        return (co && co.family_group === familyInfo) || ci.family_group === familyInfo;
      });
    }

    if (sharedRoommates.length > 1) {
      setConfirmModal({
        isOpen: true,
        title: `🔑 Shared Checkout (${groupLabel})`,
        message: `${checkin.camper_name} shares ${groupLabel} with ${sharedRoommates.length - 1} other camper(s) currently on site.`,
        sharedRoommates: sharedRoommates,
        targetCheckin: checkin,
        cabinName: groupLabel,
        checkoutScope: "all",
        confirmBtnClass: "btn-primary",
        onConfirm: (scope) => {
          const toCheckout = scope === "single" ? [checkin] : sharedRoommates;
          performCheckOutMultiple(toCheckout);
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: "Confirm Check Out",
        message: `Are you sure you want to check out ${checkin.camper_name}?`,
        detailsHeader: "🔑 Room Key & Cabin Details",
        detailsList: [
          { name: checkin.camper_name, cabin: cabinInfo || "Unassigned Cabin" }
        ],
        sharedRoommates: [],
        targetCheckin: checkin,
        cabinName: cabinInfo || "Unassigned Cabin",
        checkoutScope: "single",
        confirmBtnClass: "btn-primary",
        onConfirm: () => performCheckOutMultiple([checkin])
      });
    }
  };

  const performCheckOutMultiple = async (checkinList) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      await Promise.all(checkinList.map(ci => api.post(`/api/checkin/${ci.id}/checkout`)));
      const names = checkinList.map(c => c.camper_name).join(", ");
      flash("success", `👋 Checked out ${checkinList.length} camper(s): ${names}.`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
      fetchCheckedOut();
    } catch (err) {
      flash("error", "One or more check-outs failed.");
      fetchActive();
      fetchStats();
      fetchAllCampers();
      fetchCheckedOut();
    }
  };

  const handleCheckOutGroup = (fg, cis) => {
    const groupDetails = cis.map(ci => {
      const camperObj = allCampers.find(c => c.id === ci.camper_id);
      return {
        name: ci.camper_name,
        cabin: camperObj?.cabin_group || "Unassigned Cabin"
      };
    });

    setConfirmModal({
      isOpen: true,
      title: "Confirm Group Check Out",
      message: `Are you sure you want to check out all ${cis.length} members of Family #${fg}?`,
      detailsHeader: `🔑 Room Key Checklist (Family #${fg})`,
      detailsList: groupDetails,
      sharedRoommates: [],
      confirmText: `Confirm Keys Returned & Check Out (${cis.length})`,
      confirmBtnClass: "btn-primary",
      onConfirm: () => performCheckOutGroup(fg, cis)
    });
  };

  const performCheckOutGroup = async (fg, cis) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      await Promise.all(cis.map(ci => api.post(`/api/checkin/${ci.id}/checkout`)));
      flash("success", `👋 Family #${fg} group checked out (${cis.length} campers).`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
      fetchCheckedOut();
    } catch (err) {
      flash("error", "One or more check-outs failed during group checkout.");
      fetchActive();
      fetchStats();
      fetchAllCampers();
      fetchCheckedOut();
    }
  };

  const handleResetCheckIn = (checkin) => {
    setConfirmModal({
      isOpen: true,
      title: "🔄 Reset Check-In Status",
      message: `Are you sure you want to reset the check-in for ${checkin.camper_name}? This will completely delete the check-in record.`,
      confirmText: "Reset Record",
      confirmBtnClass: "btn-danger",
      onConfirm: () => performResetCheckIn(checkin)
    });
  };

  const performResetCheckIn = async (checkin) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      await api.delete(`/api/checkin/${checkin.id}`);
      flash("success", `🔄 Checked-in status reset for ${checkin.camper_name}.`);
      fetchActive();
      fetchStats();
      fetchAllCampers();
    } catch (err) {
      flash("error", err.response?.data?.error || "Failed to reset check-in.");
    }
  };

  // Extract unique family groups present in the search results
  const uniqueFamilyGroups = [...new Set(campers.map(c => c.family_group).filter(Boolean))];

  return (
    <>
      <div className="top-bar">
        <h1>Check-In / Check-Out</h1>
        <span className="text-muted">
          {activeCheckins.length} camper{activeCheckins.length !== 1 ? "s" : ""} on site
        </span>
      </div>

      <div className="page-body">
        {message && (
          <div className={`alert alert-${message.type === "success" ? "success" : "error"}`}>
            {message.text}
          </div>
        )}

        {/* Statistics Row */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 160px", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "1.8rem" }}>✅</div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--forest-mid)" }}>{stats.checked_in}</div>
              <div className="text-muted" style={{ fontSize: "0.78rem", fontWeight: 500 }}>On Site Now</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 160px", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "1.8rem" }}>👥</div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--charcoal)" }}>{Math.max(0, (stats.active_registered ?? stats.total_registered) - stats.checked_in)}</div>
              <div className="text-muted" style={{ fontSize: "0.78rem", fontWeight: 500 }}>Yet to Arrive</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 160px", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "1.8rem" }}>🚪</div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1B4965" }}>{checkedOut.length}</div>
              <div className="text-muted" style={{ fontSize: "0.78rem", fontWeight: 500 }}>Checked Out</div>
            </div>
          </div>
          <div className="card" style={{ flex: "1 1 160px", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "1.8rem" }}>📝</div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--gold)" }}>{stats.waivers_submitted}</div>
              <div className="text-muted" style={{ fontSize: "0.78rem", fontWeight: 500 }}>Waivers Submitted</div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "onsite",   icon: "🏕️", label: `On Site (${activeCheckins.length})`,  accent: "#2E6B3E", bg: "#E8F5EC" },
            { key: "checkin",  icon: "✅", label: "Check In",                              accent: "#1E4D2B", bg: "#D6EAD9" },
            { key: "checkout", icon: "🚪", label: `Checked Out (${checkedOut.length})`,    accent: "#1B4965", bg: "#E8F4FB" },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "9px 18px",
                  background: isActive ? tab.bg : "var(--parchment)",
                  border: `1.5px solid ${isActive ? tab.accent : "var(--border)"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? tab.accent : "var(--muted)",
                  fontSize: "0.88rem",
                  boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s"
                }}
              >
                {tab.icon} {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab: On Site */}
        {activeTab === "onsite" && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ color: "var(--forest)", fontSize: "1rem", margin: 0 }}>
                🏕️ Currently On Site ({activeCheckins.length})
              </h3>
              {activeCheckins.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleExportOnSite}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
                >
                  📥 Export Excel
                </button>
              )}
            </div>

            {loadingActive ? (
              <p className="text-muted">Loading…</p>
            ) : activeCheckins.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏕️</div>
                <p className="text-muted">No campers checked in yet.</p>
              </div>
            ) : (
              (() => {
                const groups = {};
                const individuals = [];
                activeCheckins.forEach(ci => {
                  if (ci.family_group) {
                    if (!groups[ci.family_group]) groups[ci.family_group] = [];
                    groups[ci.family_group].push(ci);
                  } else {
                    individuals.push(ci);
                  }
                });
                const sortedGroupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sortedGroupKeys.map(fg => {
                      const cis = groups[fg];
                      const isExpanded = expandedGroups[fg] !== false;
                      return (
                        <div key={`group-${fg}`} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md, 8px)", background: "#fff", overflow: "visible", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                          <div onClick={() => toggleGroupExpand(fg)} style={{ padding: "10px 14px", background: "rgba(180, 151, 90, 0.05)", borderBottom: isExpanded ? "1px solid var(--border)" : "none", borderTopLeftRadius: "7px", borderTopRightRadius: "7px", borderBottomLeftRadius: isExpanded ? "0px" : "7px", borderBottomRightRadius: isExpanded ? "0px" : "7px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, cursor: "pointer", userSelect: "none" }}>
                            <div className="tooltip-container tooltip-bottom">
                              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--forest)", display: "flex", alignItems: "center", gap: 6 }}>
                                👨‍👩‍👧‍👦 Family #{fg}
                                <span className="badge badge-gray" style={{ fontSize: "0.65rem", padding: "1px 5px", color: "var(--forest)" }}>{cis.length} on site</span>
                              </span>
                              <div className="tooltip-content" style={{ pointerEvents: "none" }}>
                                <strong style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, marginBottom: 4 }}>Currently On Site ({cis.length}):</strong>
                                {cis.map(ci => (
                                  <div key={ci.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", margin: "2px 0" }}>
                                    <span>{ci.camper_name}</span>
                                    <span style={{ fontSize: "0.75rem", color: "#a7f3d0" }}>🟢 In</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, minWidth: 68 }} disabled={!canEdit} title={`Check out all members of Family #${fg}`} onClick={(e) => { e.stopPropagation(); handleCheckOutGroup(fg, cis); }}>Check Out Group</button>
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{isExpanded ? "▲ Collapse" : "▼ Expand"}</span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "#fdfdfb" }}>
                              {cis.map(ci => (
                                <div key={ci.id} style={{ padding: "8px 12px", border: "1px solid #f1f0ea", borderRadius: "6px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--dark)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                                      {ci.camper_name}
                                      {renderCabinBadge(ci.camper_id)}
                                      {renderBreakfastBadge(ci.camper_id)}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                                      In {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      {ci.checked_in_by && ` · by ${ci.checked_in_by}`}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                                    <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, minWidth: 68 }} onClick={(e) => { e.stopPropagation(); handleCheckOut(ci); }} disabled={!canEdit}>Check Out</button>
                                    {canEdit && breakfastOptionEnabled && (
                                      <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, color: "#92400E", borderColor: "#D97706", background: breakfastOrdersByCamperId[ci.camper_id]?.wants_breakfast ? "#FEF3C7" : undefined }} title="Edit breakfast order" onClick={(e) => { e.stopPropagation(); handleEditBreakfast(ci); }}>🥞 Edit</button>
                                    )}
                                    {canEdit && <button className="btn btn-danger btn-sm" style={{ padding: "2px 6px", fontSize: "0.7rem", height: 24, minWidth: "auto" }} title="Reset Check-In" onClick={(e) => { e.stopPropagation(); handleResetCheckIn(ci); }}>Reset</button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {individuals.map(ci => (
                      <div key={ci.id} style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-md, 8px)", background: "var(--cream)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--dark)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                            {ci.camper_name}
                            {renderCabinBadge(ci.camper_id)}
                            {renderBreakfastBadge(ci.camper_id)}
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                            In {new Date(ci.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {ci.checked_in_by && ` · by ${ci.checked_in_by}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                          <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24 }} onClick={() => handleCheckOut(ci)} disabled={!canEdit}>Check Out</button>
                          {canEdit && breakfastOptionEnabled && (
                            <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", height: 24, color: "#92400E", borderColor: "#D97706", background: breakfastOrdersByCamperId[ci.camper_id]?.wants_breakfast ? "#FEF3C7" : undefined }} title="Edit breakfast order" onClick={() => handleEditBreakfast(ci)}>🥞 Edit</button>
                          )}
                          {canEdit && <button className="btn btn-danger btn-sm" style={{ padding: "2px 6px", fontSize: "0.7rem", height: 24, minWidth: "auto" }} title="Reset Check-In" onClick={() => handleResetCheckIn(ci)}>Reset</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Tab: Check In */}
        {activeTab === "checkin" && (
          <div className="card">
            <h3 style={{ color: "var(--forest)", fontSize: "1rem", marginBottom: 20 }}>✅ Check In a Camper</h3>

            <div className="form-group" style={{ marginBottom: 16, maxWidth: 540 }}>
              <label className="form-label">Search by name or Family Group number</label>
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className="form-input"
                  placeholder="Search by name or Family Group (e.g. 101)…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {searching && <p className="text-muted" style={{ marginTop: 8 }}>Searching…</p>}

            {campers.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {/* Family Group Quick Check-In Panels */}
                {uniqueFamilyGroups.map(fg => {
                  const familyCampers = allCampers.filter(c => c.family_group === fg);
                  const uncheckedFamilyCampers = familyCampers.filter(c => !c.checked_in);

                  if (uncheckedFamilyCampers.length === 0) return null;

                  return (
                    <div key={fg} style={{
                      background: "rgba(30, 77, 43, 0.04)",
                      border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "12px 16px",
                        marginBottom: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <div className="tooltip-container">
                            <div style={{ fontWeight: 600, color: "var(--forest)", display: "flex", alignItems: "center", gap: 4 }}>
                              Family Group {fg} <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>ℹ️</span>
                            </div>
                            <div className="tooltip-content">
                              <strong style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, marginBottom: 4 }}>
                                Family Members ({familyCampers.length}):
                              </strong>
                              {familyCampers.map(c => (
                                <div key={c.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", margin: "2px 0" }}>
                                  <span>{c.full_name}</span>
                                  <span style={{ fontSize: "0.75rem" }}>
                                    {c.checked_in ? "🟢 Checked In" : "⚪ Not Checked In"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {uncheckedFamilyCampers.length} of {familyCampers.length} members not checked in
                          </div>
                        </div>
                        {canEdit && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCheckInFamily(fg, uncheckedFamilyCampers)}
                          >
                            Check In All
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Individual Camper List */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                    {campers.map((c, i) => (
                      <div key={c.id} style={{
                        padding: "12px 16px",
                        borderBottom: i < campers.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--white)",
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                          <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                            {c.family_group && `Family ${c.family_group} · `}
                            {c.cabin_group && `${c.cabin_group} · `}
                            {showTeams && c.team_name && `${getDisplayTeamName(c.team_name)} · `}
                            {c.age && `Age ${c.age}`}
                          </div>
                          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                            <span className={`badge badge-${c.registration_status === "registered" ? "green" : "gray"}`}>
                              {c.registration_status}
                            </span>
                            {c.checked_in && <span className="badge badge-blue">Already In</span>}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckIn(c)}
                          disabled={!canEdit || c.checked_in}
                        >
                          {c.checked_in ? "Checked In" : "Check In"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {search && !searching && campers.length === 0 && (
                <p className="text-muted" style={{ marginTop: 8 }}>No campers found matching "{search}".</p>
              )}
          </div>
        )}

        {/* Tab: Checked Out */}
        {activeTab === "checkout" && (() => {
          const fmt = (iso) => iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
          const filtered = checkedOut.filter(c => {
            const q = checkoutSearch.toLowerCase();
            return !q ||
              (c.camper_name || "").toLowerCase().includes(q) ||
              (c.family_group || "").toLowerCase().includes(q) ||
              (allCampers.find(ac => ac.id === c.camper_id)?.cabin_group || "").toLowerCase().includes(q);
          });
          const handleExportCheckouts = () => {
            const escapeCell = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
            const headers = ["Camper Name", "Family Group", "Cabin", "Checked In At", "Checked In By", "Checked Out At", "Checked Out By"];
            const rows = filtered.map(c => {
              const cabin = allCampers.find(ac => ac.id === c.camper_id)?.cabin_group || "";
              return [c.camper_name || "", c.family_group || "", cabin, c.checked_in_at ? new Date(c.checked_in_at).toLocaleString() : "", c.checked_in_by || "", c.checked_out_at ? new Date(c.checked_out_at).toLocaleString() : "", c.checked_out_by || ""];
            });
            const csv = "﻿" + [headers.join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `gca_checked_out_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          };
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <div className="card" style={{ padding: "14px 20px", minWidth: 120, borderTop: "3px solid #1B4965", boxShadow: "var(--shadow-sm)" }}>
                    <div className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Checked Out</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1B4965" }}>{checkedOut.length}</div>
                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>campers departed</div>
                  </div>
                  <div className="card" style={{ padding: "14px 20px", minWidth: 120, borderTop: "3px solid var(--forest-mid)", boxShadow: "var(--shadow-sm)" }}>
                    <div className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Families</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--forest-mid)" }}>{new Set(checkedOut.map(c => c.family_group).filter(Boolean)).size}</div>
                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>unique family groups</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="search-input-wrap" style={{ maxWidth: 300, flex: "1 1 200px" }}>
                    <span className="search-icon">🔍</span>
                    <input type="text" className="form-input" placeholder="Search name, family, cabin…" value={checkoutSearch} onChange={e => setCheckoutSearch(e.target.value)} />
                  </div>
                  {checkedOut.length > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={handleExportCheckouts} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      📥 Export Excel
                    </button>
                  )}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="card" style={{ padding: "40px 0", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🚪</div>
                  <p className="text-muted">{checkedOut.length === 0 ? "No campers have checked out yet." : "No results match your search."}</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Camper</th>
                        <th>Family</th>
                        <th>Cabin</th>
                        <th>Checked In</th>
                        <th>In By</th>
                        <th>Checked Out</th>
                        <th>Out By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => {
                        const cabin = allCampers.find(ac => ac.id === c.camper_id)?.cabin_group || "";
                        return (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.camper_name}</td>
                            <td>{c.family_group || <span className="text-muted">—</span>}</td>
                            <td>{cabin ? <span className="badge badge-blue" style={{ fontSize: "0.72rem" }}>🏠 {cabin.replace(" | ", " – ")}</span> : <span className="text-muted">—</span>}</td>
                            <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{fmt(c.checked_in_at)}</td>
                            <td style={{ fontSize: "0.82rem" }}>{c.checked_in_by || <span className="text-muted">—</span>}</td>
                            <td style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1B4965" }}>{fmt(c.checked_out_at)}</td>
                            <td style={{ fontSize: "0.82rem" }}>{c.checked_out_by || <span className="text-muted">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Waiver Confirmation Dialog Box */}
      {waiverModal.isOpen && (
        <div className="waiver-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          backdropFilter: "blur(2px)"
        }}>
          <div className="waiver-modal-content" style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "480px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            borderTop: "5px solid var(--forest)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--forest)", fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              📝 {waiverModal.title}
            </h3>
            
            {!waiverModal.showWarning ? (
              <>
                <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                  {waiverModal.message}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => setWaiverModal(prev => ({ ...prev, showWarning: true }))}
                    style={{ padding: "8px 16px" }}
                  >
                    No, Not Yet
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={waiverModal.onConfirm}
                    style={{ padding: "8px 16px" }}
                  >
                    Yes, Confirmed
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  background: "#fffbeb", 
                  borderLeft: "4px solid #d97706", 
                  padding: "12px 16px", 
                  borderRadius: "4px", 
                  marginBottom: 20,
                  fontSize: "0.88rem",
                  color: "#92400e",
                  lineHeight: 1.4
                }}>
                  ⚠️ {waiverModal.warningMessage}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setWaiverModal({ isOpen: false })}
                    style={{ padding: "8px 16px" }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sunday Breakfast Prompt Modal */}
      {breakfastFlow.isOpen && breakfastFlow.members.length > 0 && (
        <div className="waiver-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1150,
          backdropFilter: "blur(2px)"
        }}>
          <div className="waiver-modal-content" style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "440px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            borderTop: "5px solid var(--gold)"
          }}>
            {/* Progress indicator for multi-member flows */}
            {breakfastFlow.members.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#E8F5EC", borderRadius: 6, padding: "6px 12px", marginBottom: 16 }}>
                <span style={{ fontSize: "0.82rem", color: "#2E6B3E", fontWeight: 700 }}>
                  👤 {breakfastFlow.members[breakfastFlow.currentIndex]?.full_name}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#5a7a63", fontWeight: 600 }}>
                  {breakfastFlow.currentIndex + 1} / {breakfastFlow.members.length}
                </span>
              </div>
            )}

            {breakfastFlow.step === "ask" ? (
              <>
                <h3 style={{ margin: "0 0 14px 0", color: "var(--forest)", fontSize: "1.1rem", fontWeight: 700 }}>
                  🥞 Sunday Breakfast
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                  Does <strong>{breakfastFlow.members[breakfastFlow.currentIndex]?.full_name}</strong> need breakfast on Sunday morning?
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  {breakfastFlow.isEdit && (
                    <button className="btn btn-outline" onClick={() => setBreakfastFlow(RESET_FLOW)} style={{ padding: "10px 20px", fontWeight: 600, marginRight: "auto" }}>
                      Cancel
                    </button>
                  )}
                  <button className="btn btn-outline" onClick={() => submitBreakfastAnswer(false)} style={{ padding: "10px 20px", fontWeight: 600 }}>
                    No
                  </button>
                  <button className="btn btn-primary" onClick={() => submitBreakfastAnswer(true)} style={{ padding: "10px 20px", fontWeight: 600 }}>
                    Yes
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 14px 0", color: "var(--forest)", fontSize: "1.1rem", fontWeight: 700 }}>
                  🍽️ Breakfast Selection
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                  What would <strong>{breakfastFlow.members[breakfastFlow.currentIndex]?.full_name}</strong> like, and how many?
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {breakfastMenuItems.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{item}</span>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        style={{ width: 80, textAlign: "center" }}
                        value={breakfastFlow.selectedCounts[item] || ""}
                        placeholder="0"
                        onChange={e => handleBreakfastCountChange(item, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  {breakfastFlow.isEdit && (
                    <button className="btn btn-outline" onClick={() => setBreakfastFlow(RESET_FLOW)} style={{ padding: "10px 20px", fontWeight: 600, marginRight: "auto" }}>
                      Cancel
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={submitBreakfastItems} style={{ padding: "10px 24px", fontWeight: 600 }}>
                    Confirm
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Check-In Details Confirmation Modal */}
      {checkedInSummary && checkedInSummary.length > 0 && (
        <div className="waiver-modal-overlay" style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          backdropFilter: "blur(2px)"
        }}>
          <div className="waiver-modal-content" style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "520px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            borderTop: "5px solid var(--forest)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--forest)", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              🎉 Check-In Successful!
            </h3>
            
            <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Please confirm the following assignments and details with the camper:
            </p>

            <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {checkedInSummary.map(camper => (
                <div key={camper.id} style={{ 
                  border: "1px solid var(--border)", 
                  borderRadius: "8px", 
                  padding: "14px", 
                  background: "rgba(34, 76, 56, 0.02)" 
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--forest)", marginBottom: 8 }}>
                    👤 {camper.full_name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.85rem" }}>
                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        Cabin / Room
                      </span>
                      <strong style={{ color: "var(--charcoal)" }}>
                        {camper.cabin_group || "Not Assigned"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        T-Shirt Size
                      </span>
                      <strong style={{ color: "var(--charcoal)" }}>
                        {camper.tshirt_size || camper.indian_size ? (
                          <>
                            {camper.tshirt_size && `${camper.tshirt_size} (US)`}
                            {camper.tshirt_size && camper.indian_size && " / "}
                            {camper.indian_size && `${camper.indian_size} (IN)`}
                          </>
                        ) : (
                          "None Selected"
                        )}
                      </strong>
                    </div>
                    {showTeams && (
                      <div style={{ gridColumn: "span 2", marginTop: 4 }}>
                        <span className="text-muted" style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                          Team
                        </span>
                        <span className={`badge ${
                          camper.team_name && (camper.team_name.toLowerCase().includes("1") || camper.team_name.toLowerCase().includes("peter"))
                            ? "badge-gold" 
                            : camper.team_name && (camper.team_name.toLowerCase().includes("2") || camper.team_name.toLowerCase().includes("paul"))
                            ? "badge-blue" 
                            : "badge-gray"
                        }`} style={{ display: "inline-block", marginTop: 4, padding: "4px 8px", fontSize: "0.8rem", fontWeight: 700 }}>
                          🏆 {getDisplayTeamName(camper.team_name) || "Not Allocated Yet"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setCheckedInSummary(null)}
                style={{ padding: "10px 24px", fontWeight: 600 }}
              >
                Complete & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔑</div>
            <h3 style={{ margin: "0 0 8px 0", color: "var(--forest-dark)", fontWeight: 700, fontSize: "1.2rem" }}>
              {confirmModal.title}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 16, lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>

            {/* Shared Cabin Scope Selector */}
            {confirmModal.sharedRoommates && confirmModal.sharedRoommates.length > 1 && (
              <div style={{
                background: "#f4f8f5",
                border: "1px solid #d1e2d7",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: 16,
                textAlign: "left"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  🛖 Shared Cabin Checkout Options ({confirmModal.cabinName})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.86rem", fontWeight: 600, color: "var(--dark)" }}>
                    <input 
                      type="radio" 
                      name="checkoutScope" 
                      checked={confirmModal.checkoutScope === "all"} 
                      onChange={() => setConfirmModal(prev => ({ ...prev, checkoutScope: "all" }))}
                    />
                    Check Out ALL {confirmModal.sharedRoommates.length} Roommates in {confirmModal.cabinName}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.86rem", fontWeight: 600, color: "var(--dark)" }}>
                    <input 
                      type="radio" 
                      name="checkoutScope" 
                      checked={confirmModal.checkoutScope === "single"} 
                      onChange={() => setConfirmModal(prev => ({ ...prev, checkoutScope: "single" }))}
                    />
                    Check Out ONLY {confirmModal.targetCheckin?.camper_name}
                  </label>
                </div>
              </div>
            )}

            {/* Room Key Checklist */}
            {(() => {
              const activeList = (confirmModal.sharedRoommates && confirmModal.sharedRoommates.length > 1)
                ? (confirmModal.checkoutScope === "single" ? [confirmModal.targetCheckin] : confirmModal.sharedRoommates)
                : null;
              const displayList = activeList 
                ? activeList.map(ci => ({ name: ci?.camper_name, cabin: confirmModal.cabinName }))
                : confirmModal.detailsList;

              return displayList && displayList.length > 0 ? (
                <div style={{
                  background: "rgba(180, 151, 90, 0.08)",
                  border: "1px solid rgba(180, 151, 90, 0.25)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: 20,
                  textAlign: "left"
                }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--gold-dark, #a37d24)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    🔑 Room Key Checklist ({displayList.length} Camper{displayList.length > 1 ? "s" : ""})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {displayList.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--dark)" }}>{item.name}</span>
                        <span style={{ fontSize: "0.78rem", background: "#fff", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "12px", color: "var(--forest)" }}>
                          ⛺ {item.cabin}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: 8, fontWeight: 600, borderTop: "1px dashed rgba(180, 151, 90, 0.3)", paddingTop: 6 }}>
                    ⚠️ Please collect all room keys before completing checkout!
                  </div>
                </div>
              ) : null;
            })()}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: "8px 20px", fontWeight: 600 }}
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className={`btn ${confirmModal.confirmBtnClass}`} 
                style={{ padding: "8px 24px", fontWeight: 600 }}
                onClick={() => confirmModal.onConfirm(confirmModal.checkoutScope)}
              >
                {confirmModal.sharedRoommates && confirmModal.sharedRoommates.length > 1
                  ? (confirmModal.checkoutScope === "single"
                      ? `Check Out ONLY ${confirmModal.targetCheckin?.camper_name}`
                      : `Confirm Keys Returned & Check Out All ${confirmModal.sharedRoommates.length} Roommates`)
                  : (confirmModal.confirmText || "Confirm Key Return & Check Out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
