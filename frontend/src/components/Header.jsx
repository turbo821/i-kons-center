import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  ChevronDown,
  LogOut,
  Shield,
  Search,
  LayoutDashboard,
  PieChart,
  BarChart3,
  Database,
  Table as TableIcon,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";


const PAGE_TITLES = {
  "/": "Главная",
  "/dashboards": "Дашборды",
  "/widgets": "Виджеты",
  "/widgets/new": "Новый виджет",
  "/datasources": "Источники данных",
  "/kpi": "Показатели KPI",
  "/admin/users": "Пользователи",
  "/profile": "Профиль",
  "/login": "Вход",
  "/register": "Регистрация",
};


function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/dashboards/")) return "Дашборд";
  if (pathname.startsWith("/datasources/")) return "Источник данных";
  if (pathname.match(/^\/widgets\/\d+\/edit/)) return "Редактирование виджета";
  return "";
}


export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white">
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm">
          {pageTitle && (
            <>
              <span className="text-slate-500">/</span>
              <span className="font-medium text-slate-100">{pageTitle}</span>
            </>
          )}
        </div>

        {/* Поиск (только для авторизованных, по центру) */}
        

        {/* Меню пользователя справа */}
        <div className="flex items-center gap-3">
          {!user && (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Вход
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600"
              >
                Регистрация
              </Link>
            </>
          )}

          {user && (
            <>
            <SearchBox />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-200">
                  <UserIcon size={16} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium leading-tight text-white">
                    {user.username}
                  </p>
                  <p className="text-xs leading-tight text-slate-400">
                    {user.roles?.join(", ")}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg">
                  <div className="border-b border-slate-100 p-3">
                    <p className="font-medium">{user.username}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles?.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/profile");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <UserIcon size={14} className="text-slate-500" />
                    Профиль
                  </button>

                  {user.roles?.includes("admin") && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/admin/users");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <Shield size={14} className="text-slate-500" />
                      Пользователи
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      navigate("/login");
                    }}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} />
                    Выйти
                  </button>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}


// ===========================================================================
// Глобальный поиск
// ===========================================================================
const KIND_META = {
  dashboard: { label: "Дашборд", icon: LayoutDashboard, color: "text-blue-600" },
  widget: { label: "Виджет", icon: PieChart, color: "text-purple-600" },
  kpi: { label: "KPI", icon: BarChart3, color: "text-emerald-600" },
  datasource: { label: "Источник", icon: Database, color: "text-amber-600" },
  dataset: { label: "Набор данных", icon: TableIcon, color: "text-cyan-600" },
};


function SearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Закрытие при клике вне
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl/Cmd+K — фокус на поиск
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Debounce поискового запроса
  const search = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/stats/search", { params: { q } });
      setResults(data.results || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => search(query), 250);
    return () => clearTimeout(handle);
  }, [query, search]);

  const handleSelect = (item) => {
    navigate(item.url);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative max-w-md flex-1">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Поиск (Ctrl+K)..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-9 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-700"
          >
            ×
          </button>
        )}
      </div>

      {/* Выпадающий список */}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg">
          {loading && (
            <p className="px-4 py-3 text-sm text-slate-500">Поиск...</p>
          )}

          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">Ничего не найдено</p>
          )}

          {!loading && results.length > 0 && (
            <div className="py-1">
              {results.map((r) => {
                const meta = KIND_META[r.kind] || {};
                const Icon = meta.icon;
                return (
                  <button
                    key={`${r.kind}_${r.id}`}
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-slate-50"
                  >
                    {Icon && (
                      <Icon
                        size={16}
                        className={`mt-0.5 shrink-0 ${meta.color || ""}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {meta.label}
                        {r.subtitle ? ` · ${r.subtitle}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
