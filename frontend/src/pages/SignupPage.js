import React, { useState, useEffect } from "react";
import api from "../utils/api";



export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [familyGroup, setFamilyGroup] = useState("");
  const [attendees, setAttendees] = useState([
    { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Public customization settings
  const [settings, setSettings] = useState({
    signup_title: "GCA 2026 Church Camp Sign-Up Form",
    signup_dates: "August 14–16, 2026",
    signup_location: "Camp Prothro",
    activity_names: '["KAYAKING", "BOAT TOUR"]'
  });

  const [activitiesResponses, setActivitiesResponses] = useState({
    0: { interest: "No", count: "" },
    1: { interest: "No", count: "" }
  });

  const getActivityNamesArray = () => {
    try {
      let parsed = JSON.parse(settings.activity_names);
      if (Array.isArray(parsed)) {
        if (parsed.length < 1 || !parsed[0]) parsed[0] = "KAYAKING";
        if (parsed.length < 2 || !parsed[1]) parsed[1] = "BOAT TOUR";
        return parsed;
      }
    } catch (e) {}
    return ["KAYAKING", "BOAT TOUR"];
  };

  const activitiesArray = getActivityNamesArray();

  useEffect(() => {
    api.get("/api/settings/public")
      .then(res => {
        if (res.data.settings) {
          setSettings(res.data.settings);
          try {
            const parsed = JSON.parse(res.data.settings.activity_names);
            if (Array.isArray(parsed)) {
              setActivitiesResponses(prev => {
                const updated = { ...prev };
                parsed.forEach((_, idx) => {
                  if (!updated[idx]) {
                    updated[idx] = { interest: "No", count: "" };
                  }
                });
                return updated;
              });
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, []);
  const [success, setSuccess] = useState(false);
  const [registeredList, setRegisteredList] = useState([]);
  
  // Jotform questionnaire states
  const [hasChildren, setHasChildren] = useState("No");
  const [hasAllergies, setHasAllergies] = useState("No");
  const [allergyDetails, setAllergyDetails] = useState("");

  const handleActivityResponseChange = (idx, field, value) => {
    setActivitiesResponses(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [field]: value
      }
    }));
  };

  const addAttendee = () => {
    setAttendees([...attendees, { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: false }]);
  };

  const addChildAttendee = () => {
    setAttendees([...attendees, { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: true }]);
  };

  const removeAttendee = (index) => {
    if (attendees.length === 1) return;
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const handleHasChildrenChange = (val) => {
    setHasChildren(val);
    if (val === "Yes") {
      // Add first child attendee if none exists
      if (!attendees.some(a => a.is_child)) {
        setAttendees([...attendees, { first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: true }]);
      }
    } else {
      // Filter out child attendees
      const remaining = attendees.filter(a => !a.is_child);
      if (remaining.length === 0) {
        setAttendees([{ first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: false }]);
      } else {
        setAttendees(remaining);
      }
    }
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
    if (!phone.trim()) {
      setError("Guardian Phone is required.");
      setLoading(false);
      return;
    }

    // Filter list to separate adults/children
    const adultAttendees = attendees.filter(a => !a.is_child);
    const childAttendees = hasChildren === "Yes" ? attendees.filter(a => a.is_child) : [];
    const finalAttendeesList = [...adultAttendees, ...childAttendees];

    if (finalAttendeesList.length === 0) {
      setError("At least one attendee is required.");
      setLoading(false);
      return;
    }

    // Client side validation for child age
    for (let i = 0; i < finalAttendeesList.length; i++) {
      const att = finalAttendeesList[i];
      const displayName = att.first_name.trim() ? `${att.first_name} ${att.last_name}` : `Attendee #${i + 1}`;
      
      if (!att.first_name.trim() || !att.last_name.trim()) {
        setError(`First name and Last name are required for ${displayName}`);
        setLoading(false);
        return;
      }
      
      if (att.is_child) {
        if (!att.age || !att.age.toString().trim()) {
          setError(`Please specify the age for child attendee: ${displayName}`);
          setLoading(false);
          return;
        }
        const ageVal = parseInt(att.age);
        if (isNaN(ageVal) || ageVal < 0 || ageVal >= 18) {
          setError(`Age must be under 18 for child attendee: ${displayName}`);
          setLoading(false);
          return;
        }
      }
    }

    // Activity counts mapping
    const kCount = (activitiesResponses[0] && activitiesResponses[0].interest === "Yes") ? parseInt(activitiesResponses[0].count) || 1 : 0;
    const bCount = (activitiesResponses[1] && activitiesResponses[1].interest === "Yes") ? parseInt(activitiesResponses[1].count) || 1 : 0;

    const otherActivities = [];
    activitiesArray.forEach((activityName, idx) => {
      if (idx >= 2) {
        const resp = activitiesResponses[idx];
        if (resp && resp.interest === "Yes") {
          const countVal = parseInt(resp.count) || 1;
          otherActivities.push(`${activityName} (${countVal} participants)`);
        }
      }
    });

    try {
      const payload = {
        email: email.trim() || null,
        phone: phone.trim(),
        attendees: finalAttendeesList.map((a, idx) => {
          // Set kayaking and boat tour count for the first K/B participants
          const isKayaking = idx < kCount ? 1 : 0;
          const isBoatTour = idx < bCount ? 1 : 0;
          
          // Save the dietary allergy string to the first attendee in the list
          let allergiesVal = null;
          if (hasAllergies === "Yes" && idx === 0) {
            allergiesVal = allergyDetails.trim() || "Yes (details unspecified)";
          }

          let camperNotes = null;
          if (idx === 0 && otherActivities.length > 0) {
            camperNotes = `Selected Custom Activities: ${otherActivities.join(", ")}`;
          }

          return {
            first_name: a.first_name.trim(),
            last_name: a.last_name.trim(),
            age: a.is_child && a.age !== "" ? parseInt(a.age) : null,
            gender: null,
            allergies: allergiesVal,
            notes: camperNotes,
            tshirt_size: a.tshirt_size || null,
            indian_size: null,
            kayaking: isKayaking,
            boat_tour: isBoatTour
          };
        })
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
      <div className="signup-body">
        <div className="form-container" style={{ maxWidth: 600, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🎉</div>
          <h1 style={{ color: "var(--forest)", marginBottom: 12, fontWeight: 800 }}>Registration Successful!</h1>
          <p className="text-muted" style={{ marginBottom: 24 }}>
            Thank you for registering with Grace Christian Assembly Camp. Your family group code is <strong>#{familyGroup}</strong>.
          </p>

          <div style={{ textAlign: "left", background: "#f9fafb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: "var(--forest-mid)", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 8, fontWeight: 700 }}>Registered Attendees:</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {registeredList.map((c, idx) => {
                const ts = c.tshirts && c.tshirts.length > 0 ? c.tshirts[0] : null;
                const sizeStr = ts 
                  ? (ts.indian_size ? `${ts.tshirt_size} (Indian: ${ts.indian_size})` : ts.tshirt_size)
                  : "No T-shirt";
                return (
                  <li key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.95rem" }}>
                    <span>👤 <strong>{c.full_name}</strong> {c.age ? `(Age: ${c.age})` : ""}</span>
                    <span style={{ color: "var(--gold)", display: "flex", gap: 8, alignItems: "center" }}>
                      <span>👕 {sizeStr}</span>
                      {(c.kayaking > 0 || c.boat_tour > 0) && (
                        <span style={{ fontSize: "0.85rem", color: "var(--forest-mid)", background: "#eef2f3", padding: "2px 6px", borderRadius: 4 }}>
                          {c.kayaking > 0 ? `🛶 ${c.kayaking} ` : ""}
                          {c.boat_tour > 0 ? `⛵ ${c.boat_tour}` : ""}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <button className="btn btn-primary" onClick={() => {
            setSuccess(false);
            setEmail("");
            setPhone("");
            setFamilyGroup("");
            setHasChildren("No");
            setHasAllergies("No");
            setAllergyDetails("");
            setActivitiesResponses({
              0: { interest: "No", count: "" },
              1: { interest: "No", count: "" }
            });
            setAttendees([{ first_name: "", last_name: "", age: "", gender: "", allergies: "", tshirt_size: "", indian_size: "", kayaking: 0, boat_tour: 0, is_child: false }]);
          }}>
            Register Another Family Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .signup-body,
        .signup-body input,
        .signup-body select,
        .signup-body textarea,
        .signup-body button,
        .signup-body label {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .signup-body h1,
        .signup-body h2,
        .signup-body h3,
        .signup-body h4,
        .signup-body h5 {
          font-family: 'Outfit', sans-serif;
        }

        .signup-body {
          min-height: 100vh;
          background: linear-gradient(135deg, #163626 0%, #2c5e43 100%);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 60px 20px;
          position: relative;
          overflow: hidden;
        }
        .signup-body::before {
          content: "";
          position: absolute;
          width: 500px;
          height: 500px;
          background: rgba(180, 151, 90, 0.12);
          border-radius: 50%;
          filter: blur(100px);
          top: -10%;
          left: -10%;
          z-index: 0;
          pointer-events: none;
        }
        .signup-body::after {
          content: "";
          position: absolute;
          width: 600px;
          height: 600px;
          background: rgba(34, 76, 56, 0.35);
          border-radius: 50%;
          filter: blur(120px);
          bottom: -10%;
          right: -10%;
          z-index: 0;
          pointer-events: none;
        }
        .form-container {
          position: relative;
          z-index: 1;
          max-width: 780px;
          width: 100%;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(8px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-top: 8px solid var(--gold, #B4975A);
          border-radius: 16px;
          overflow: hidden;
        }
        .form-header-banner {
          background: linear-gradient(to bottom, rgba(180, 151, 90, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          padding: 44px 40px 32px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }
        .form-header-logo {
          width: 240px;
          height: auto;
          margin-bottom: -4px;
        }
        .form-title-text {
          margin: 0;
          color: var(--forest, #224C38);
          font-size: 2.1rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.25;
        }
        .form-subtitle-text {
          margin: 12px 0 0 0;
          display: inline-flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .form-section-card {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02) !important;
          padding: 32px 40px !important;
          margin: 20px 40px !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .form-section-card:hover {
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.04) !important;
        }
        .form-section-title {
          font-size: 1.05rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--forest, #224C38);
          margin-bottom: 24px;
          border-bottom: 2px solid rgba(34, 76, 56, 0.08);
          padding-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .jotform-input {
          background-color: #fbfbfb !important;
          border: 1px solid #d1d5db !important;
          color: #1f2937 !important;
          border-radius: 8px !important;
          height: 42px;
          padding: 10px 14px;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .jotform-input:focus {
          outline: none;
          background-color: #ffffff !important;
          border-color: var(--forest, #224C38) !important;
          box-shadow: 0 0 0 4px rgba(34, 76, 56, 0.12) !important;
        }
        .jotform-select {
          background-color: #fbfbfb !important;
          border: 1px solid #d1d5db !important;
          color: #1f2937 !important;
          border-radius: 8px !important;
          height: 42px;
          padding: 10px 14px;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .jotform-select:focus {
          outline: none;
          background-color: #ffffff !important;
          border-color: var(--forest, #224C38) !important;
          box-shadow: 0 0 0 4px rgba(34, 76, 56, 0.12) !important;
        }
        .jotform-textarea {
          background-color: #fbfbfb !important;
          border: 1px solid #d1d5db !important;
          color: #1f2937 !important;
          border-radius: 8px !important;
          padding: 12px 14px;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          height: 100px;
          resize: vertical;
          transition: all 0.2s ease;
        }
        .jotform-textarea:focus {
          outline: none;
          background-color: #ffffff !important;
          border-color: var(--forest, #224C38) !important;
          box-shadow: 0 0 0 4px rgba(34, 76, 56, 0.12) !important;
        }
        .jotform-label {
          font-weight: 600;
          color: var(--charcoal, #2d312e);
          margin-bottom: 8px;
          display: block;
          font-size: 0.88rem;
        }
        .jotform-radio-group {
          display: flex;
          flex-direction: row;
          gap: 24px;
          margin-top: 8px;
        }
        .jotform-radio-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 600;
          color: var(--charcoal, #2d312e);
          font-size: 0.95rem;
        }
        .jotform-radio-input {
          width: 18px;
          height: 18px;
          accent-color: var(--forest, #224C38);
          cursor: pointer;
          margin: 0;
        }
        .jotform-btn-submit {
          background-color: var(--forest, #224C38);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 14px 40px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(34, 76, 56, 0.25);
          min-width: 200px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .jotform-btn-submit:hover {
          background-color: var(--forest-mid, #2e674c);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(34, 76, 56, 0.35);
        }
        .jotform-btn-submit:active {
          transform: translateY(0);
        }
        .jotform-btn-submit:disabled {
          background-color: var(--muted, #9ca3af);
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }
        .jotform-btn-secondary {
          background-color: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .jotform-btn-secondary:hover {
          background-color: #e5e7eb;
          color: #111827;
          border-color: #9ca3af;
        }
        .jotform-card-attendee {
          background: #fafbfb;
          border: 1px solid #e2e8f0;
          border-left: 4px solid var(--forest, #224C38);
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01);
          transition: all 0.25s ease;
        }
        .jotform-card-attendee:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.03);
          border-color: #cbd5e1;
          border-left-color: var(--forest-mid, #2e674c);
        }
        .jotform-card-attendee-child {
          background: #fffdf9;
          border: 1px solid rgba(180, 151, 90, 0.25);
          border-left: 4px solid var(--gold, #B4975A);
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01);
          transition: all 0.25s ease;
        }
        .jotform-card-attendee-child:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.03);
          border-color: rgba(180, 151, 90, 0.4);
          border-left-color: var(--gold-dark, #8a713b);
        }
      `}</style>

      <div className="form-container">
        
        {/* Header Banner */}
        <div className="form-header-banner">
          <img 
            className="form-header-logo" 
            src="/gca-logo-black.png" 
            alt="GCA Logo" 
          />
          <div>
            <h1 className="form-title-text">{settings.signup_title}</h1>
            <div className="form-subtitle-text">
              <span className="badge badge-gray" style={{ background: "rgba(180, 151, 90, 0.08)", color: "#8a713b", border: "1px solid rgba(180, 151, 90, 0.25)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.82rem", fontWeight: 600 }}>
                📍 {settings.signup_location}
              </span>
              <span className="badge badge-gray" style={{ background: "rgba(34, 76, 56, 0.08)", color: "var(--forest)", border: "1px solid rgba(34, 76, 56, 0.18)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.82rem", fontWeight: 600 }}>
                📅 {settings.signup_dates}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ margin: "20px 40px 0 40px", padding: "12px 20px", background: "#f8d7da", border: "1px solid #f5c6cb", color: "#721c24", borderRadius: 4, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {settings.registration_status === "not_open" ? (
          <div style={{ padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>⏳</div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--forest)", marginBottom: 12, fontWeight: 800 }}>
              Registration is not open yet
            </h2>
            <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 28px auto", fontSize: "0.95rem", lineHeight: 1.6 }}>
              We appreciate your interest! Registration for the church camp is not open yet. Please check back later or contact the camp administration for updates.
            </p>
          </div>
        ) : (settings.registration_status === "closed" || (!settings.registration_status && settings.registration_closed === "true")) ? (
          <div style={{ padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🚫</div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--forest)", marginBottom: 12, fontWeight: 800 }}>
              Registration is Closed
            </h2>
            <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 28px auto", fontSize: "0.95rem", lineHeight: 1.6 }}>
              We appreciate your interest! Registration for the church camp is currently closed. If you have any questions or require support, please contact the camp administration.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ paddingBottom: 40 }}>
          
          {/* Section 1: Contact Information */}
          <div className="form-section-card">
            <h2 className="form-section-title">📞 Primary Contact</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
              <div className="form-group">
                <label className="jotform-label">Phone Number *</label>
                <input 
                  type="tel" 
                  className="jotform-input" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="(000) 000-0000" 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="jotform-label">Email Address (Optional)</label>
                <input 
                  type="email" 
                  className="jotform-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="example@example.com" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Attendee Information */}
          <div className="form-section-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(50, 31, 22, 0.15)", paddingBottom: 8, marginBottom: 18 }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, textTransform: "uppercase", color: "#321F16", margin: 0 }}>
                👥 Attendee Information *
              </h2>
              <button 
                type="button" 
                className="jotform-btn-secondary" 
                onClick={addAttendee}
              >
                Add More Attendees
              </button>
            </div>

            {attendees.filter(a => !a.is_child).map((att, idx) => {
              const realIndex = attendees.indexOf(att);
              return (
                <div key={realIndex} className="jotform-card-attendee">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, color: "#321F16" }}>Attendee #{idx + 1}</span>
                    {attendees.filter(a => !a.is_child).length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeAttendee(realIndex)}
                        style={{ background: "none", border: "none", color: "#b91c1c", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                      >
                        x Remove
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                    <div className="form-group">
                      <label className="jotform-label">First Name *</label>
                      <input 
                        type="text" 
                        className="jotform-input" 
                        value={att.first_name} 
                        onChange={e => handleAttendeeChange(realIndex, "first_name", e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="jotform-label">Last Name *</label>
                      <input 
                        type="text" 
                        className="jotform-input" 
                        value={att.last_name} 
                        onChange={e => handleAttendeeChange(realIndex, "last_name", e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="jotform-label">T-shirt Size *</label>
                      <select 
                        className="jotform-select" 
                        value={att.tshirt_size} 
                        onChange={e => handleAttendeeChange(realIndex, "tshirt_size", e.target.value)}
                        required
                      >
                        <option value="">— Select Size —</option>
                        {["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"].map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 3: Children Questions & Information */}
          <div className="form-section-card">
            <div style={{ marginBottom: 20 }}>
              <label className="jotform-label" style={{ fontSize: "0.95rem" }}>Are you registering any children (under age 18)? *</label>
              <div className="jotform-radio-group">
                <label className="jotform-radio-label">
                  <input 
                    type="radio" 
                    className="jotform-radio-input"
                    name="hasChildrenRadio" 
                    value="Yes" 
                    checked={hasChildren === "Yes"} 
                    onChange={() => handleHasChildrenChange("Yes")} 
                  />
                  Yes
                </label>
                <label className="jotform-radio-label">
                  <input 
                    type="radio" 
                    className="jotform-radio-input"
                    name="hasChildrenRadio" 
                    value="No" 
                    checked={hasChildren === "No"} 
                    onChange={() => handleHasChildrenChange("No")} 
                  />
                  No
                </label>
              </div>
            </div>

            {hasChildren === "Yes" && (
              <div style={{ marginTop: 20, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(50, 31, 22, 0.15)", paddingBottom: 8, marginBottom: 18 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#b45309", margin: 0 }}>
                    👶 Children's Information
                  </h3>
                  <button 
                    type="button" 
                    className="jotform-btn-secondary"
                    onClick={addChildAttendee}
                    style={{ background: "#b45309", borderColor: "rgba(180, 151, 90, 0.5)" }}
                  >
                    Add Child
                  </button>
                </div>

                {attendees.filter(a => a.is_child).map((att, idx) => {
                  const realIndex = attendees.indexOf(att);
                  return (
                    <div key={realIndex} className="jotform-card-attendee-child">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ fontWeight: 700, color: "#b45309" }}>Child #{idx + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => removeAttendee(realIndex)}
                          style={{ background: "none", border: "none", color: "#b91c1c", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                        >
                          x Remove
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                        <div className="form-group">
                          <label className="jotform-label">First Name *</label>
                          <input 
                            type="text" 
                            className="jotform-input" 
                            value={att.first_name} 
                            onChange={e => handleAttendeeChange(realIndex, "first_name", e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="jotform-label">Last Name *</label>
                          <input 
                            type="text" 
                            className="jotform-input" 
                            value={att.last_name} 
                            onChange={e => handleAttendeeChange(realIndex, "last_name", e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="jotform-label">Age *</label>
                          <input 
                            type="number" 
                            className="jotform-input" 
                            value={att.age} 
                            placeholder="Age" 
                            min="0"
                            max="17"
                            onChange={e => handleAttendeeChange(realIndex, "age", e.target.value)} 
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="jotform-label">T-shirt Size *</label>
                          <select 
                            className="jotform-select" 
                            value={att.tshirt_size} 
                            onChange={e => handleAttendeeChange(realIndex, "tshirt_size", e.target.value)}
                            required
                          >
                            <option value="">— Select Size —</option>
                            {["YXXS", "YXS", "YS", "YM", "YL", "YXL", "XS", "S", "M", "L"].map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Dietary Allergies */}
          <div className="form-section-card">
            <h2 className="form-section-title">🥜 Dietary Allergies</h2>
            <div style={{ marginBottom: 20 }}>
              <label className="jotform-label">Do you have any dietary allergies? *</label>
              <div className="jotform-radio-group">
                <label className="jotform-radio-label">
                  <input 
                    type="radio" 
                    className="jotform-radio-input"
                    name="hasAllergiesRadio" 
                    value="Yes" 
                    checked={hasAllergies === "Yes"} 
                    onChange={() => setHasAllergies("Yes")} 
                  />
                  Yes
                </label>
                <label className="jotform-radio-label">
                  <input 
                    type="radio" 
                    className="jotform-radio-input"
                    name="hasAllergiesRadio" 
                    value="No" 
                    checked={hasAllergies === "No"} 
                    onChange={() => setHasAllergies("No")} 
                  />
                  No
                </label>
              </div>
            </div>

            {hasAllergies === "Yes" && (
              <div style={{ marginTop: 12 }}>
                <label className="jotform-label">If yes, please specify your dietary allergies *</label>
                <textarea 
                  className="jotform-textarea" 
                  value={allergyDetails} 
                  onChange={e => setAllergyDetails(e.target.value)} 
                  placeholder="Please specify here..." 
                  required
                />
              </div>
            )}
          </div>

          {/* Section 5: Activities */}
          {activitiesArray.length > 0 && (
            <div className="form-section-card">
              <h2 className="form-section-title">🛶 Activity Options</h2>
              <p style={{ fontSize: "0.85rem", color: "#796F6B", marginTop: -10, marginBottom: 20 }}>
                Interested in any of the activities below? Select all that apply. (Additional fees will be charged.)
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
                {activitiesArray.map((activityName, idx) => {
                  const response = activitiesResponses[idx] || { interest: "No", count: "" };
                  return (
                    <div key={idx} style={{ background: "rgba(255,255,255,0.25)", padding: 18, borderRadius: 4, border: "1px solid rgba(50,31,22,0.15)" }}>
                      <label className="jotform-label" style={{ fontSize: "0.95rem" }}>• {activityName}</label>
                      <div className="jotform-radio-group" style={{ marginBottom: 12 }}>
                        <label className="jotform-radio-label">
                          <input 
                            type="radio" 
                            className="jotform-radio-input"
                            name={`activityInterestRadio_${idx}`} 
                            value="Yes" 
                            checked={response.interest === "Yes"} 
                            onChange={() => handleActivityResponseChange(idx, "interest", "Yes")} 
                          />
                          Yes
                        </label>
                        <label className="jotform-radio-label">
                          <input 
                            type="radio" 
                            className="jotform-radio-input"
                            name={`activityInterestRadio_${idx}`} 
                            value="No" 
                            checked={response.interest === "No"} 
                            onChange={() => {
                              handleActivityResponseChange(idx, "interest", "No");
                              handleActivityResponseChange(idx, "count", "");
                            }} 
                          />
                          No
                        </label>
                      </div>
                      
                      {response.interest === "Yes" && (
                        <div>
                          <label className="jotform-label" style={{ fontSize: "0.8rem" }}>Number of participants (optional):</label>
                          <input 
                            type="number" 
                            className="jotform-input" 
                            value={response.count} 
                            onChange={e => handleActivityResponseChange(idx, "count", e.target.value)} 
                            placeholder="Defaults to 1" 
                            min="1"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Action Buttons */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 32, padding: "0 40px" }}>
            <button 
              type="submit" 
              className="jotform-btn-submit" 
              disabled={loading}
            >
              {loading ? "Please wait..." : "Submit"}
            </button>
          </div>

        </form>
      )}
      </div>
    </div>
  );
}
