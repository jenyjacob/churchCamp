import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import CampersPage from "./pages/CampersPage";
import CheckInPage from "./pages/CheckInPage";
import UsersPage from "./pages/UsersPage";
import CabinsPage from "./pages/CabinsPage";
import FinancePage from "./pages/FinancePage";
import SchedulePage from "./pages/SchedulePage";
import AuditLogsPage from "./pages/AuditLogsPage";
import OutdoorPage from "./pages/OutdoorPage";
import SignupPage from "./pages/SignupPage";
import TShirtsPage from "./pages/TShirtsPage";
import RoleAssignerPage from "./pages/RoleAssignerPage";
import CampInfoPage from "./pages/CampInfoPage";
import TeamsPage from "./pages/TeamsPage";


function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh" }}><div className="spinner" style={{border:"3px solid #ccc",borderTopColor:"#1E4D2B"}} /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RequirePermission({ pageKey, children }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh" }}><div className="spinner" style={{border:"3px solid #ccc",borderTopColor:"#1E4D2B"}} /></div>;
  return hasPermission(pageKey, "hide") ? children : <Navigate to="/" replace />;
}

function RequireFinanceOrReceiptPermission({ children }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh" }}><div className="spinner" style={{border:"3px solid #ccc",borderTopColor:"#1E4D2B"}} /></div>;
  const canAccess = hasPermission("finance", "hide") || hasPermission("receipt_upload", "hide");
  return canAccess ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      {/* Public Schedule Path - Redirects to /app/schedule if logged in */}
      <Route path="/schedule" element={user ? <Navigate to="/app/schedule" replace /> : <SchedulePage />} />
      
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<RequirePermission pageKey="dashboard"><HomePage /></RequirePermission>} />
        <Route path="campers" element={<RequirePermission pageKey="campers"><CampersPage /></RequirePermission>} />
        <Route path="teams" element={<RequirePermission pageKey="teams"><TeamsPage /></RequirePermission>} />
        <Route path="checkin" element={<RequirePermission pageKey="checkin"><CheckInPage /></RequirePermission>} />
        <Route path="cabins" element={<RequirePermission pageKey="cabins"><CabinsPage /></RequirePermission>} />
        <Route path="app/schedule" element={<RequirePermission pageKey="schedule"><SchedulePage /></RequirePermission>} />
        <Route path="outdoor" element={<RequirePermission pageKey="outdoor"><OutdoorPage /></RequirePermission>} />
        <Route path="tshirts" element={<RequirePermission pageKey="apparel"><TShirtsPage /></RequirePermission>} />
        <Route path="users" element={<RequirePermission pageKey="users"><UsersPage /></RequirePermission>} />
        <Route path="finance" element={<RequireFinanceOrReceiptPermission><FinancePage /></RequireFinanceOrReceiptPermission>} />
        <Route path="logs" element={<RequirePermission pageKey="logs"><AuditLogsPage /></RequirePermission>} />
        <Route path="role-assigner" element={<RequirePermission pageKey="role_assigner"><RoleAssignerPage /></RequirePermission>} />
        <Route path="camp-info" element={<RequirePermission pageKey="camp_info"><CampInfoPage /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

let activeConfirmCallback = null;
let activeAlertCallback = null;

if (typeof window !== "undefined") {
  if (!window._nativeConfirm) {
    window._nativeConfirm = window.confirm;
  }
  if (!window._nativeAlert) {
    window._nativeAlert = window.alert;
  }

  window.confirm = (message) => {
    return new Promise((resolve) => {
      if (activeConfirmCallback) {
        activeConfirmCallback(message, resolve);
      } else {
        resolve(window._nativeConfirm ? window._nativeConfirm(message) : true);
      }
    });
  };

  window.alert = (message) => {
    return new Promise((resolve) => {
      if (activeAlertCallback) {
        activeAlertCallback(message, resolve);
      } else {
        if (window._nativeAlert) window._nativeAlert(message);
        resolve();
      }
    });
  };
}

export default function App() {
  const [confirmConfig, setConfirmConfig] = React.useState(null);
  const [alertConfig, setAlertConfig] = React.useState(null);

  React.useEffect(() => {
    activeConfirmCallback = (message, resolve) => {
      setConfirmConfig({ message, resolve });
    };
    activeAlertCallback = (message, resolve) => {
      setAlertConfig({ message, resolve });
    };
    return () => {
      activeConfirmCallback = null;
      activeAlertCallback = null;
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>

      {confirmConfig && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 100000
        }}>
          <div className="modal-card" style={{
            background: "#fff", padding: 28, borderRadius: 12,
            width: "90%", maxWidth: 400, boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>❓</div>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--forest)", fontSize: "1.25rem", fontWeight: 600 }}>
              Confirmation Required
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              {confirmConfig.message}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button 
                className="btn btn-ghost" 
                style={{ padding: "8px 20px" }}
                onClick={() => {
                  confirmConfig.resolve(false);
                  setConfirmConfig(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ padding: "8px 24px", minWidth: 80 }}
                onClick={() => {
                  confirmConfig.resolve(true);
                  setConfirmConfig(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {alertConfig && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 100000
        }}>
          <div className="modal-card" style={{
            background: "#fff", padding: 28, borderRadius: 12,
            width: "90%", maxWidth: 400, boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--forest)", fontSize: "1.25rem", fontWeight: 600 }}>
              Alert
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              {alertConfig.message}
            </p>
            <button 
              className="btn btn-primary" 
              style={{ padding: "8px 24px", minWidth: 100, margin: "0 auto", display: "block" }}
              onClick={() => {
                alertConfig.resolve();
                setAlertConfig(null);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}
