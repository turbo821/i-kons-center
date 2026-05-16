import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";


const AuthContext = createContext(null);

const TOKEN_KEY = "token";


/**
 * Возвращает storage, в котором сейчас лежит токен.
 * Сначала ищем в localStorage (запомнил меня), потом в sessionStorage.
 */
function getActiveStorage() {
  if (localStorage.getItem(TOKEN_KEY)) return localStorage;
  if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
  return null;
}


function getToken() {
  const storage = getActiveStorage();
  return storage ? storage.getItem(TOKEN_KEY) : null;
}


function setToken(token, remember) {
  // Сначала чистим оба storage, чтобы не было дубликатов
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
}


function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // При монтировании пытаемся восстановить сессию через /me
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password, remember = true) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token, remember);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}


// Экспортируем геттер токена для использования в HTTP-клиенте axios
export { getToken };
