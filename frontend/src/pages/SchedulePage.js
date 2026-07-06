import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const generateTimeOptions = () => {
  const options = [];
  const periods = ["AM", "PM"];
  for (let p = 0; p < 2; p++) {
    const period = periods[p];
    for (let h = 0; h < 12; h++) {
      const displayHour = h === 0 ? 12 : h;
      for (let m = 0; m < 60; m += 15) {
        const displayMin = m === 0 ? "00" : m;
        options.push(`${displayHour}:${displayMin} ${period}`);
      }
    }
  }
  return options;
};
const TIME_INTERVALS = generateTimeOptions();

const EMPTY_EVENT = { day: "", time: "", title: "", location: "", description: "" };

export default function SchedulePage() {
  const { user, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);

  // Edit/Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchSchedule = () => {
    setLoading(true);
    api.get("/api/schedule/")
      .then(r => {
        setEvents(r.data.events);
      })
      .catch(() => setError("Failed to load schedule events."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const openAddModal = () => {
    setActiveEvent(EMPTY_EVENT);
    setStartTime("");
    setEndTime("");
    setModalOpen(true);
  };

  const openEditModal = (event) => {
    setActiveEvent(event);
    if (event.time && event.time.includes(" - ")) {
      const parts = event.time.split(" - ");
      setStartTime(parts[0].trim());
      setEndTime(parts[1].trim());
    } else {
      setStartTime(event.time || "");
      setEndTime("");
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeEvent.id) {
        await api.put(`/api/schedule/${activeEvent.id}`, activeEvent);
        flash("success", "Event updated successfully!");
      } else {
        await api.post("/api/schedule/", activeEvent);
        flash("success", "Event created successfully!");
      }
      setModalOpen(false);
      fetchSchedule();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to save event.";
      if (err.response?.status === 409) {
        alert(`⚠️ Time Conflict Alert\n\n${errorMsg}`);
      } else {
        flash("error", errorMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/schedule/${deleteTarget.id}`);
      flash("success", "Event deleted successfully.");
      setDeleteTarget(null);
      fetchSchedule();
    } catch (err) {
      flash("error", "Failed to delete event.");
    }
  };

  // Group events by day
  const groupedEvents = events.reduce((groups, event) => {
    const day = event.day || "General";
    if (!groups[day]) {
      groups[day] = [];
    }
    groups[day].push(event);
    return groups;
  }, {});

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.trim().match(/^(\d+):?(\d*)\s*(AM|PM)/i);
    if (!match) return 9999; // Put invalid/unparseable times at the end
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3].toUpperCase();
    
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };

  // Sort days logically (Day 1, Day 2, etc.)
  const sortedDays = Object.keys(groupedEvents).sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  const scheduleContent = (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {loading ? (
        <div className="text-center" style={{ padding: 40 }}>
          <div className="spinner" style={{ borderTopColor: "var(--forest-mid)", border: "3px solid #eee", width: 36, height: 36, margin: "0 auto" }} />
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📅</div>
          <p className="text-muted">No schedule events posted yet.</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal} style={{ marginTop: 16 }}>
              ➕ Create First Event
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {sortedDays.map(day => {
            const sortedEventsForDay = [...groupedEvents[day]].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            return (
              <div key={day} className="card" style={{ padding: "20px 24px" }}>
                <h3 style={{ fontFamily: "Playfair Display, serif", color: "var(--forest)", fontSize: "1.2rem", borderBottom: "1.5px solid var(--border)", paddingBottom: 8, marginBottom: 16 }}>
                  ☀️ {day}
                </h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sortedEventsForDay.map(evt => (
                  <div key={evt.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    paddingBottom: 16,
                    borderBottom: "1px dashed rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ display: "flex", gap: 16, flex: 1 }}>
                      {/* Time bar indicator */}
                      <div style={{
                        minWidth: 100,
                        fontWeight: 600,
                        color: "var(--forest-mid)",
                        fontSize: "0.85rem",
                        paddingTop: 2,
                      }}>
                        ⏰ {evt.time}
                      </div>

                      {/* Details */}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--charcoal)" }}>
                          {evt.title}
                        </div>
                        {evt.location && (
                          <div style={{ fontSize: "0.8rem", color: "var(--gold)", fontWeight: 500, marginTop: 2 }}>
                            📍 {evt.location}
                          </div>
                        )}
                        {evt.description && (
                          <div className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4, whiteSpace: "pre-line" }}>
                            {evt.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin edits */}
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(evt)} style={{ padding: "4px 8px" }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(evt)} style={{ padding: "4px 8px" }}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{activeEvent.id ? "Edit Schedule Event" : "Create Schedule Event"}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Day *</label>
                <select 
                  className="form-select" 
                  value={activeEvent.day} 
                  onChange={e => setActiveEvent({ ...activeEvent, day: e.target.value })} 
                  required
                >
                  <option value="">Select Day...</option>
                  <option value="Friday, Aug 14">Friday, Aug 14</option>
                  <option value="Saturday, Aug 15">Saturday, Aug 15</option>
                  <option value="Sunday, Aug 16">Sunday, Aug 16</option>
                </select>
              </div>

               <div className="form-group">
                 <label className="form-label">Time *</label>
                 <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                   <div style={{ flex: 1 }}>
                     <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>From</span>
                     <select
                       className="form-select"
                       value={startTime}
                       onChange={e => {
                         const newStart = e.target.value;
                         setStartTime(newStart);
                         if (newStart && endTime) {
                           setActiveEvent({ ...activeEvent, time: `${newStart} - ${endTime}` });
                         } else {
                           setActiveEvent({ ...activeEvent, time: newStart });
                         }
                       }}
                       required
                     >
                       <option value="">Start Time...</option>
                       {TIME_INTERVALS.map(t => (
                         <option key={`start-${t}`} value={t}>{t}</option>
                       ))}
                     </select>
                   </div>

                   <span style={{ marginTop: 20, color: "var(--muted)" }}>to</span>

                   <div style={{ flex: 1 }}>
                     <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>To (Optional)</span>
                     <select
                       className="form-select"
                       value={endTime}
                       onChange={e => {
                         const newEnd = e.target.value;
                         setEndTime(newEnd);
                         if (startTime && newEnd) {
                           setActiveEvent({ ...activeEvent, time: `${startTime} - ${newEnd}` });
                         } else {
                           setActiveEvent({ ...activeEvent, time: startTime });
                         }
                       }}
                     >
                       <option value="">No end time</option>
                       {TIME_INTERVALS.map(t => (
                         <option key={`end-${t}`} value={t}>{t}</option>
                       ))}
                     </select>
                   </div>
                 </div>
               </div>

              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input 
                  className="form-input" 
                  value={activeEvent.title} 
                  onChange={e => setActiveEvent({ ...activeEvent, title: e.target.value })} 
                  placeholder="e.g. Breakfast, Campfire Session" 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location (optional)</label>
                <input 
                  className="form-input" 
                  value={activeEvent.location || ""} 
                  onChange={e => setActiveEvent({ ...activeEvent, location: e.target.value })} 
                  placeholder="e.g. Dining Hall, Amphitheater" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea 
                  className="form-textarea" 
                  value={activeEvent.description || ""} 
                  onChange={e => setActiveEvent({ ...activeEvent, description: e.target.value })} 
                  placeholder="Any details about this activity..." 
                  rows={3} 
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DIALOG */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Delete Event</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p>Are you sure you want to delete <strong>{deleteTarget.title}</strong>?</p>
            <div className="modal-footer" style={{ marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Conditionally render inside navigation frame or standalone
  if (user) {
    return (
      <>
        <div className="top-bar">
          <h1>Camp Schedule</h1>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              ➕ Add Event
            </button>
          )}
        </div>
        <div className="page-body">
          {scheduleContent}
        </div>
      </>
    );
  }

  // Standalone public layout
  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      {/* Public Page Nav Header */}
      <header style={{
        background: "var(--forest)",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "var(--shadow)",
        borderBottom: "2px solid var(--gold)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/grace-logo.png" alt="GCA Logo" style={{ height: 28, width: 28, objectFit: "contain", background: "white", borderRadius: "50%", padding: 1 }} />
          <span style={{ fontFamily: "Playfair Display, serif", color: "var(--white)", fontSize: "1.25rem", fontWeight: 600 }}>
            GCA Camp Schedule
          </span>
        </div>
        <Link to="/login" className="btn btn-gold btn-sm">
          🔑 Admin Portal
        </Link>
      </header>

      {/* Public Body Container */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "1.75rem", color: "var(--forest)" }}>
            Camp Activities Timeline
          </h2>
        </div>
        {scheduleContent}
      </main>
    </div>
  );
}
