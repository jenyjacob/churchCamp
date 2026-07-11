import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    api.post("/api/auth/logout").catch(() => {});
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
    setPermissions(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setLoading(true);
      Promise.all([
        api.get("/api/auth/me"),
        api.get("/api/permissions/my-permissions")
      ])
        .then(([meRes, permRes]) => {
          setUser(meRes.data.user);
          setPermissions(permRes.data.permissions);
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [logout]);

  const login = async (username, password) => {
    const res = await api.post("/api/auth/login", { username, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("token", access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(userData);
    
    try {
      const permRes = await api.get("/api/permissions/my-permissions");
      setPermissions(permRes.data.permissions);
    } catch (e) {
      console.error("Failed to load permissions during login", e);
    }
    
    return userData;
  };

  const loginPasskey = async (access_token, userData) => {
    localStorage.setItem("token", access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(userData);
    
    try {
      const permRes = await api.get("/api/permissions/my-permissions");
      setPermissions(permRes.data.permissions);
    } catch (e) {
      console.error("Failed to load permissions during passkey login", e);
    }
    
    return userData;
  };

  const hasPermission = useCallback((pageKey, level = "read") => {
    if (user?.role === "owner") return true;
    if (!permissions) return false;
    
    const userLevel = permissions[pageKey] || "hide";
    if (level === "hide") {
      // Used to check if route/page is visible (i.e. NOT hidden)
      return userLevel !== "hide";
    }
    if (level === "edit") {
      return userLevel === "edit";
    }
    return userLevel === "read" || userLevel === "edit";
  }, [user, permissions]);

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  return (
    <AuthContext.Provider value={{ user, permissions, hasPermission, login, loginPasskey, logout, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
