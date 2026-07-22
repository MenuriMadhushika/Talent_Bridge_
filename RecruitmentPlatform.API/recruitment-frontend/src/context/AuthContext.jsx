import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

function readStoredUser() {
  const raw = localStorage.getItem("tb_user");
  return raw ? JSON.parse(raw) : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [ready, setReady] = useState(true);

  const persist = useCallback((authResponse) => {
    localStorage.setItem("tb_token", authResponse.token);
    localStorage.setItem("tb_user", JSON.stringify(authResponse));
    setUser(authResponse);
  }, []);

  const login = useCallback(
    async (dto) => {
      const res = await authApi.login(dto);
      persist(res);
      return res;
    },
    [persist]
  );

  const register = useCallback(
    async (dto) => {
      const res = await authApi.register(dto);
      persist(res);
      return res;
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("tb_token");
    localStorage.removeItem("tb_user");
    setUser(null);
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
