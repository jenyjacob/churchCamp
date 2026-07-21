import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const BIBLE_VERSES = [
  { text: "He makes me to lie down in green pastures; He leads me beside the still waters. He restores my soul; He leads me in the paths of righteousness For His name’s sake.", ref: "Psalm 23:2-3" },
  { text: "Let the heavens rejoice, and let the earth be glad; Let the sea roar, and all its fullness; Let the field be joyful, and all that is in it. Then all the trees of the woods will rejoice.", ref: "Psalm 96:11-12" },
  { text: "As iron sharpens iron, So a man sharpens the countenance of his friend.", ref: "Proverbs 27:17" },
  { text: "The Lord your God in your midst, The Mighty One, will save; He will rejoice over you with gladness, He will quiet you with His love, He will rejoice over you with singing.", ref: "Zephaniah 3:17" },
  { text: "For where two or three are gathered together in My name, I am there in the midst of them.", ref: "Matthew 18:20" },
  { text: "You are the light of the world. A city that is set on a hill cannot be hidden.", ref: "Matthew 5:14" },
  { text: "Let no one despise your youth, but be an example to the believers in word, in conduct, in love, in spirit, in faith, in purity.", ref: "1 Timothy 4:12" },
  { text: "But those who wait on the Lord Shall renew their strength; They shall mount up with wings like eagles, They shall run and not be weary, They shall walk and not faint.", ref: "Isaiah 40:31" },
  { text: "This is the day the Lord has made; We will rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Let all that you do be done with love.", ref: "1 Corinthians 16:14" },
  { text: "Be strong and of good courage, do not fear nor be afraid of them; for the Lord your God, He is the One who goes with you. He will not leave you nor forsake you.", ref: "Deuteronomy 31:6" },
  { text: "For I know the thoughts that I think toward you, says the Lord, thoughts of peace and not of evil, to give you a future and a hope.", ref: "Jeremiah 29:11" },
  { text: "Create in me a clean heart, O God, And renew a steadfast spirit within me.", ref: "Psalm 51:10" },
  { text: "The heavens declare the glory of God; And the firmament shows His handiwork.", ref: "Psalm 19:1" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "Trust in the Lord with all your heart, And lean not on your own understanding; In all your ways acknowledge Him, And He shall direct your paths.", ref: "Proverbs 3:5-6" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope by the power of the Holy Spirit.", ref: "Romans 15:13" },
  { text: "Come to Me, all you who labor and are heavy laden, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "Oh, give thanks to the Lord, for He is good! For His mercy endures forever.", ref: "Psalm 107:1" },
  { text: "The Lord is my light and my salvation; Whom shall I fear? The Lord is the strength of my life; Of whom shall I be afraid?", ref: "Psalm 27:1" },
  { text: "Commit your works to the Lord, And your thoughts will be established.", ref: "Proverbs 16:3" },
  { text: "A soft answer turns away wrath, But a harsh word stirs up anger.", ref: "Proverbs 15:1" },
  { text: "Peace I leave with you, My peace I give to you; not as the world gives do I give to you. Let not your heart be troubled, neither let it be afraid.", ref: "John 14:27" },
  { text: "Therefore comfort each other and edify one another, just as you also are doing.", ref: "1 Thessalonians 5:11" },
  { text: "The name of the Lord is a strong tower; The righteous run to it and are safe.", ref: "Proverbs 18:10" },
  { text: "And above all things have fervent love for one another, for \"love will cover a multitude of sins.\"", ref: "1 Peter 4:8" },
  { text: "And we know that all things work together for good to those who love God, to those who are the called according to His purpose.", ref: "Romans 8:28" },
  { text: "Bless the Lord, O my soul; And all that is within me, bless His holy name!", ref: "Psalm 103:1" },
  { text: "Fear not, for I am with you; Be not dismayed, for I am your God. I will strengthen you, Yes, I will help you, I will uphold you with My righteous right hand.", ref: "Isaiah 41:10" },
  { text: "Behold, how good and how pleasant it is For brethren to dwell together in unity!", ref: "Psalm 133:1" }
];

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  const getDailyVerse = () => {
    const dateStr = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % BIBLE_VERSES.length;
    return BIBLE_VERSES[index];
  };
  const verse = getDailyVerse();

  useEffect(() => {
    api.get("/api/campers/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Error fetching camper stats:", err))
      .finally(() => setLoading(false));

    api.get("/api/checkin/?active_only=true&per_page=8")
      .then((res) => setRecentCheckins(res.data.logs || []))
      .catch(() => setRecentCheckins([]));
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
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "var(--forest)", marginBottom: 0 }}>
            {greeting()}, {user?.full_name?.split(" ")[0] || user?.username}! 👋
          </h2>
        </div>

        <div className="card" style={{
          borderLeft: "4px solid var(--forest)",
          background: "linear-gradient(135deg, rgba(34, 76, 56, 0.04) 0%, rgba(34, 76, 56, 0.01) 100%)",
          padding: "16px 20px",
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{ 
            fontSize: "0.7rem", 
            textTransform: "uppercase", 
            letterSpacing: "0.08em", 
            fontWeight: 700, 
            color: "var(--forest-mid)",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            <span>📖</span> Verse of the Day
          </div>
          <blockquote style={{ 
            margin: 0, 
            fontFamily: "'Playfair Display', Georgia, serif", 
            fontSize: "1.05rem", 
            fontStyle: "italic", 
            color: "var(--charcoal)",
            lineHeight: 1.5
          }}>
            "{verse.text}"
          </blockquote>
          <div style={{ 
            textAlign: "right", 
            fontSize: "0.8rem", 
            fontWeight: 600, 
            color: "var(--muted)" 
          }}>
            — {verse.ref}
          </div>
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>
            <div className="spinner" style={{ border: "3px solid #eee", borderTopColor: "var(--forest-mid)", width: 32, height: 32, margin: "0 auto" }} />
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
                <div className="label">Family Groups</div>
                <div className="value" style={{ color: "var(--gold)" }}>{stats?.total_families ?? "—"}</div>
                <div className="sub">families registered</div>
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
            </div>

            <div className="dashboard-grid">
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
