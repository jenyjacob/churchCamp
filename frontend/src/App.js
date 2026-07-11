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
import SchedulePage from "./pages/SchedulePage";
import AuditLogsPage from "./pages/AuditLogsPage";
import OutdoorPage from "./pages/OutdoorPage";
import SignupPage from "./pages/SignupPage";
import TShirtsPage from "./pages/TShirtsPage";
import RoleAssignerPage from "./pages/RoleAssignerPage";


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
        <Route path="checkin" element={<RequirePermission pageKey="checkin"><CheckInPage /></RequirePermission>} />
        <Route path="cabins" element={<RequirePermission pageKey="cabins"><CabinsPage /></RequirePermission>} />
        <Route path="app/schedule" element={<RequirePermission pageKey="schedule"><SchedulePage /></RequirePermission>} />
        <Route path="outdoor" element={<RequirePermission pageKey="outdoor"><OutdoorPage /></RequirePermission>} />
        <Route path="tshirts" element={<RequirePermission pageKey="apparel"><TShirtsPage /></RequirePermission>} />
        <Route path="users" element={<RequirePermission pageKey="users"><UsersPage /></RequirePermission>} />
        <Route path="logs" element={<RequirePermission pageKey="logs"><AuditLogsPage /></RequirePermission>} />
        <Route path="role-assigner" element={<RequirePermission pageKey="role_assigner"><RoleAssignerPage /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
