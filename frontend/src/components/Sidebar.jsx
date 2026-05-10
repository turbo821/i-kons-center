import {
  LayoutDashboard,
  Users,
  Database,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
} from "lucide-react";

import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";


export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    {
      title: "Дашборды",
      icon: LayoutDashboard,
      path: "/dashboards",
    },
    {
      title: "Виджеты",
      icon: PieChart,
      path: "/widgets",
    },
    {
      title: "Показатели KPI",
      icon: BarChart3,
      path: "/kpi",
    },
    {
      title: "Источники данных",
      icon: Database,
      path: "/datasources",
    },
  ];

  const adminItems = [
    {
      title: "Пользователи",
      icon: Users,
      path: "/admin/users",
    },
    {
      title: "Настройки",
      icon: Settings,
      path: "/settings",
    },
  ];

  const isActive = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(path + "/");

  const renderItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`
          flex items-center
          rounded-xl px-4 py-3 text-sm font-medium transition
          ${collapsed ? "justify-center" : "gap-3"}
          ${
            active
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }
        `}
      >
        <Icon size={20} />
        {!collapsed && item.title}
      </Link>
    );
  };

  return (
    <aside
      className={`
        flex h-screen flex-col border-r border-slate-800
        bg-slate-900 text-white transition-all duration-300
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      <div className="flex items-center justify-between border-b border-slate-800 p-5">
        {!collapsed && (
          <div>
            <h1 className="text-2xl font-bold tracking-wide">I-Kons Center</h1>
            <p className="mt-1 text-sm text-slate-400">Бизнес-аналитика</p>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 transition hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div>
          {!collapsed && (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Аналитика
            </p>
          )}
          <div className="flex flex-col gap-1">
            {menuItems.map(renderItem)}
          </div>
        </div>

        {user?.roles?.includes("admin") && (
          <div>
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Администрирование
              </p>
            )}
            <div className="flex flex-col gap-1">
              {adminItems.map(renderItem)}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
