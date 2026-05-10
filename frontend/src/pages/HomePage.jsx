import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  PieChart,
  BarChart3,
  Database,
  Users,
  Target,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { getSystemOverview } from "../api/userApi";
import { useAuth } from "../context/AuthContext";


export default function HomePage() {
  const { user } = useAuth();

  // Гостевая главная — приглашение к входу
  if (!user) return <GuestHome />;

  // Авторизованный — дашборд статистики
  return <AuthedHome />;
}


function GuestHome() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <Sparkles size={32} />
        </div>
        <h1 className="text-4xl font-bold">I-Kons Center</h1>
        <p className="mt-3 text-lg text-slate-600">
          Инструмент бизнес-аналитики для информационного центра
          предприятия атомной отрасли
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FeatureCard
          icon={Database}
          title="Любые источники данных"
          text="CSV, Excel, PostgreSQL и MySQL — единый интерфейс работы с данными"
        />
        <FeatureCard
          icon={PieChart}
          title="Конструктор виджетов"
          text="Создавайте графики и таблицы из ваших данных без программирования"
        />
        <FeatureCard
          icon={LayoutDashboard}
          title="Интерактивные дашборды"
          text="Перетаскивайте элементы и компонуйте панели аналитики"
        />
        <FeatureCard
          icon={Target}
          title="KPI с целевыми значениями"
          text="Мониторинг ключевых показателей с учётом направления цели"
        />
      </div>

      <div className="flex justify-center gap-3">
        <Link
          to="/login"
          className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500"
        >
          Войти
        </Link>
        <Link
          to="/register"
          className="rounded-xl bg-slate-100 px-6 py-3 font-medium text-slate-700 hover:bg-slate-200"
        >
          Зарегистрироваться
        </Link>
      </div>
    </div>
  );
}


function FeatureCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={20} />
      </div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}


function AuthedHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemOverview()
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user?.roles?.includes("admin");

  const cards = stats
    ? [
        {
          label: "Дашборды",
          value: stats.counts.dashboards,
          icon: LayoutDashboard,
          color: "bg-blue-50 text-blue-600",
          link: "/dashboards",
        },
        {
          label: "Виджеты",
          value: stats.counts.widgets,
          icon: PieChart,
          color: "bg-purple-50 text-purple-600",
          link: "/widgets",
        },
        {
          label: "Показатели KPI",
          value: stats.counts.kpis,
          icon: BarChart3,
          color: "bg-emerald-50 text-emerald-600",
          link: "/kpi",
        },
        {
          label: "Источники данных",
          value: stats.counts.datasources,
          icon: Database,
          color: "bg-amber-50 text-amber-600",
          link: "/datasources",
        },
        ...(isAdmin
          ? [
              {
                label: "Пользователи",
                value: stats.counts.users,
                icon: Users,
                color: "bg-rose-50 text-rose-600",
                link: "/admin/users",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div>
        <h1 className="text-3xl font-bold">
          С возвращением, {user.username}!
        </h1>
        <p className="text-slate-600">
          Информационный центр предприятия — обзор системы
        </p>
      </div>

      {loading && <p className="text-slate-500">Загрузка статистики...</p>}

      {/* Карточки счётчиков */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.label}
                to={c.link}
                className="group rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className={`rounded-xl p-2 ${c.color}`}>
                    <Icon size={20} />
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-slate-300 transition group-hover:text-slate-700"
                  />
                </div>
                <p className="text-3xl font-bold">{c.value}</p>
                <p className="text-sm text-slate-500">{c.label}</p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Последние дашборды */}
      {stats?.recent_dashboards?.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Недавние дашборды</h2>
            <Link
              to="/dashboards"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Все →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.recent_dashboards.map((d) => (
              <Link
                key={d.id}
                to={`/dashboards/${d.id}`}
                className="block rounded-xl border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-medium">{d.name}</p>
                {d.description && (
                  <p className="line-clamp-1 text-xs text-slate-500">
                    {d.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(d.created_at).toLocaleDateString("ru-RU")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Быстрые действия */}
      {(user.roles?.includes("admin") || user.roles?.includes("expert")) && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Быстрые действия</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/datasources"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              + Подключить источник
            </Link>
            <Link
              to="/widgets/new"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              + Создать виджет
            </Link>
            <Link
              to="/dashboards"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              + Новый дашборд
            </Link>
            <Link
              to="/kpi"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              + Добавить KPI
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
