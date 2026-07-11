import React, { useState } from "react";
import api from "../utils/api";

const TSHIRT_SIZES = [
  "2T", "3T", "4T", "5T",
  "YXXS", "YXS", "YS", "YM", "YL", "YXL",
  "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [familyGroup, setFamilyGroup] = useState("");
  const [attendees, setAttendees] = useState([
    { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", kayaking: 0, boat_tour: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [registeredList, setRegisteredList] = useState([]);

  const addAttendee = () => {
    setAttendees([...attendees, { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", kayaking: 0, boat_tour: 0 }]);
  };

  const removeAttendee = (index) => {
    if (attendees.length === 1) return;
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const handleAttendeeChange = (index, field, value) => {
    const updated = [...attendees];
    updated[index] = { ...updated[index], [field]: value };
    setAttendees(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate phone and family group
    if (!phone.strip) {
      // standard validation
    }

    // Client side validation for child age
    for (let i = 0; i < attendees.length; i++) {
      const att = attendees[i];
      if (!att.first_name.trim() || !att.last_name.trim()) {
        setError(`First name and Last name are required for Attendee #${i + 1}`);
        setLoading(false);
        return;
      }
      const ageVal = parseInt(att.age);
      if (!isNaN(ageVal) && ageVal < 18) {
        if (att.age === "" || att.age === null || ageVal < 0) {
          setError(`Please specify a valid age for child attendee: ${att.first_name}`);
          setLoading(false);
          return;
        }
      }
    }

    try {
      const payload = {
        email: email.trim() || null,
        phone: phone.trim(),
        attendees: attendees.map(a => ({
          first_name: a.first_name.trim(),
          last_name: a.last_name.trim(),
          age: a.age !== "" ? parseInt(a.age) : null,
          gender: a.gender || null,
          allergies: a.allergies.trim() || null,
          tshirt_size: a.tshirt_size || null,
          kayaking: a.kayaking !== "" ? parseInt(a.kayaking) : 0,
          boat_tour: a.boat_tour !== "" ? parseInt(a.boat_tour) : 0
        }))
      };

      const res = await api.post("/api/campers/public-signup", payload);
      setFamilyGroup(res.data.family_group || "");
      setRegisteredList(res.data.campers || []);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f8", padding: 20 }}>
        <div className="card" style={{ maxWidth: 600, width: "100%", textAlign: "center", padding: 40, boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "var(--forest)", marginBottom: 12 }}>Registration Successful!</h1>
          <p className="text-muted" style={{ marginBottom: 24 }}>
            Thank you for registering with Grace Covenant Academy Camp. Your family group code is <strong>#{familyGroup}</strong>.
          </p>

          <div style={{ textAlign: "left", background: "#f9fafb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: "var(--forest-mid)", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 8 }}>Registered Attendees:</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {registeredList.map((c, idx) => (
                <li key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.95rem" }}>
                  <span>👤 <strong>{c.full_name}</strong> {c.age ? `(Age: ${c.age})` : ""}</span>
                  <span style={{ color: "var(--gold)", display: "flex", gap: 8, alignItems: "center" }}>
                    <span>👕 {c.tshirts && c.tshirts.length > 0 ? c.tshirts[0].tshirt_size : "No T-shirt"}</span>
                    {(c.kayaking > 0 || c.boat_tour > 0) && (
                      <span style={{ fontSize: "0.85rem", color: "var(--forest-mid)", background: "#eef2f3", padding: "2px 6px", borderRadius: 4 }}>
                        {c.kayaking > 0 ? `🛶 ${c.kayaking} ` : ""}
                        {c.boat_tour > 0 ? `⛵ ${c.boat_tour}` : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button className="btn btn-primary" onClick={() => {
            setSuccess(false);
            setEmail("");
            setPhone("");
            setFamilyGroup("");
            setAttendees([{ first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", kayaking: 0, boat_tour: 0 }]);
          }}>
            Register Another Family Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", display: "flex", flexDirection: "column", padding: "40px 20px" }}>
      <div style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/grace-logo.png" alt="GCA Logo" style={{ height: 72, width: 72, marginBottom: 16, background: "white", borderRadius: "50%", padding: 2, boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }} />
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "var(--forest)", fontSize: "2.25rem", margin: 0 }}>GCA Camp Registration</h1>
          <p className="text-muted" style={{ marginTop: 8, fontSize: "1rem" }}>Please fill in the form below to sign up your family.</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}><span>⚠️</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          
          {/* Section 1: Contact Information */}
          <div className="card" style={{ marginBottom: 24, padding: "24px 30px" }}>
            <h2 style={{ fontSize: "1.2rem", color: "var(--forest-mid)", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 20 }}>
              📞 Contact Information
            </h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="e.g. 555-0199" 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. parent@example.com" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Attendees */}
          <div className="card" style={{ padding: "24px 30px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.2rem", color: "var(--forest-mid)", margin: 0 }}>
                👥 Attendees
              </h2>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={addAttendee}
                style={{ color: "var(--forest)", border: "1px solid var(--forest)", display: "flex", alignItems: "center", gap: 6 }}
              >
                ➕ Add Attendee
              </button>
            </div>

            {attendees.map((att, idx) => (
              <div 
                key={idx} 
                style={{ 
                  background: "#f9fafb", 
                  border: "1px solid #e5e7eb", 
                  borderRadius: 8, 
                  padding: 20, 
                  marginBottom: idx < attendees.length - 1 ? 24 : 0,
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, color: "var(--forest-mid)", fontSize: "0.95rem" }}>
                    Attendee #{idx + 1}
                  </span>
                  {attendees.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeAttendee(idx)}
                      style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={att.first_name} 
                      onChange={e => handleAttendeeChange(idx, "first_name", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={att.last_name} 
                      onChange={e => handleAttendeeChange(idx, "last_name", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age {parseInt(att.age) < 18 ? "*" : "(Optional)"}</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={att.age} 
                      placeholder="Required if under 18" 
                      onChange={e => handleAttendeeChange(idx, "age", e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select 
                      className="form-select" 
                      value={att.gender} 
                      onChange={e => handleAttendeeChange(idx, "gender", e.target.value)}
                    >
                      <option value="">— Select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">T-shirt Size</label>
                    <select 
                      className="form-select" 
                      value={att.tshirt_size} 
                      onChange={e => handleAttendeeChange(idx, "tshirt_size", e.target.value)}
                    >
                      <option value="">— Select Size —</option>
                      {TSHIRT_SIZES.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Allergies (Optional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={att.allergies} 
                      placeholder="e.g. Peanuts, none" 
                      onChange={e => handleAttendeeChange(idx, "allergies", e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kayaking Spots</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={att.kayaking} 
                      min="0"
                      max="10"
                      onChange={e => handleAttendeeChange(idx, "kayaking", e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Boat Tour Spots</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={att.boat_tour} 
                      min="0"
                      max="10"
                      onChange={e => handleAttendeeChange(idx, "boat_tour", e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ padding: "12px 32px", fontSize: "1rem", fontWeight: 600 }}
            >
              {loading ? "Submitting Registration..." : "Submit Registration"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
