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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh" }}><div className="spinner" style={{border:"3px solid #ccc",borderTopColor:"#1E4D2B"}} /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? children : <Navigate to="/" replace />;
}

function RequireAdminOrDirector({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const hasAccess = user?.role === "admin" || user?.role === "owner" || user?.role === "director";
  return hasAccess ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      
      {/* Public Schedule Path - Redirects to /app/schedule if logged in */}
      <Route path="/schedule" element={user ? <Navigate to="/app/schedule" replace /> : <SchedulePage />} />
      
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="campers" element={<CampersPage />} />
        <Route path="checkin" element={<CheckInPage />} />
        <Route path="cabins" element={<RequireAdminOrDirector><CabinsPage /></RequireAdminOrDirector>} />
        <Route path="app/schedule" element={<RequireAdminOrDirector><SchedulePage /></RequireAdminOrDirector>} />
        <Route path="outdoor" element={<RequireAdminOrDirector><OutdoorPage /></RequireAdminOrDirector>} />
        <Route path="users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
        <Route path="logs" element={<RequireAdmin><AuditLogsPage /></RequireAdmin>} />
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
