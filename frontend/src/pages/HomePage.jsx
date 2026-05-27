import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  PieChart,
  Database,
  Target,
  Sparkles,
  Pin,
  Upload,
  Layers,
  ShieldCheck,
} from "lucide-react";

import { getSystemOverview } from "../api/userApi";
import { listDashboards } from "../api/dashboardApi";
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
  const [pinned, setPinned] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSystemOverview(),
      listDashboards({ pinned: "true" }),
    ])
      .then(([statsRes, pinnedRes]) => {
        setStats(statsRes.data);
        setPinned(pinnedRes.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Закреплённые показываем отдельным блоком, поэтому в «Недавние» их
  // не повторяем (бэкенд сортирует закреплённые наверх).
  const recentWithoutPinned = useMemo(() => {
    const pinnedIds = new Set(pinned.map((d) => d.id));
    return (stats?.recent_dashboards || []).filter(
      (d) => !pinnedIds.has(d.id)
    );
  }, [stats, pinned]);

  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const hasAnyDashboard = pinned.length > 0 || recentWithoutPinned.length > 0;

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-7 text-white shadow-sm">
        <p className="text-sm capitalize text-slate-300">{today}</p>
        <h1 className="mt-1 text-3xl font-bold">
          С возвращением, {user.username}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Информационный центр предприятия атомной отрасли. Здесь собраны
          ваши панели аналитики — закреплённые и недавно открытые.
        </p>
      </div>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {/* Закреплённые дашборды */}
      {pinned.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Pin size={16} className="text-amber-600" fill="currentColor" />
              Закреплённые дашборды
            </h2>
            <Link
              to="/dashboards"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Все →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pinned.map((d) => (
              <Link
                key={d.id}
                to={`/dashboards/${d.id}`}
                className="group block rounded-xl border border-amber-200 bg-amber-50/40 p-4 transition hover:border-amber-400 hover:bg-amber-50"
              >
                <div className="flex items-start gap-2">
                  <Pin
                    size={14}
                    className="mt-1 shrink-0 text-amber-600"
                    fill="currentColor"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-amber-900">
                      {d.name}
                    </p>
                    {d.description && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {d.description}
                      </p>
                    )}
                    {d.category_name && (
                      <p className="mt-2 inline-block rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">
                        {d.category_name}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Недавние дашборды */}
      {recentWithoutPinned.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
            {recentWithoutPinned.map((d) => (
              <Link
                key={d.id}
                to={`/dashboards/${d.id}`}
                className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-medium">{d.name}</p>
                {d.description && (
                  <p className="line-clamp-2 text-xs text-slate-500">
                    {d.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Создан {new Date(d.created_at).toLocaleDateString("ru-RU")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Пустое состояние: нет доступных дашбордов */}
      {!loading && !hasAnyDashboard && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <LayoutDashboard size={28} />
          </div>
          <h2 className="text-lg font-semibold">Пока нет доступных дашбордов</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Доступ к панелям, виджетам и показателям выдаётся через ролевые
            группы. Если вы ничего не видите, попросите администратора
            добавить вас в нужную группу.
          </p>
          <Link
            to="/dashboards"
            className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Перейти к дашбордам
          </Link>
        </section>
      )}

      {/* Справка по работе в системе */}
      {!loading && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Как пользоваться системой</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GuideStep
              icon={Database}
              step="1"
              title="Подключите данные"
              text="Загрузите CSV или Excel, либо подключите базу PostgreSQL или MySQL как источник данных."
            />
            <GuideStep
              icon={PieChart}
              step="2"
              title="Соберите виджеты"
              text="В конструкторе выберите набор данных, метрики и измерения — получится график или таблица."
            />
            <GuideStep
              icon={LayoutDashboard}
              step="3"
              title="Скомпонуйте дашборд"
              text="Перетащите виджеты и показатели на панель и закрепите важные дашборды на главной."
            />
            <GuideStep
              icon={Target}
              step="4"
              title="Следите за KPI"
              text="Задайте целевые значения показателей и отслеживайте их выполнение в реальном времени."
            />
          </div>
        </section>
      )}

      {/* Что важно знать: роли и доступ */}
      {!loading && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Что важно знать о доступе</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoTile
              icon={ShieldCheck}
              title="Роли в группах"
              text="Доступ выдаётся через ролевые группы. В группе вы либо «эксперт» (можете редактировать), либо «зритель» (только просмотр)."
            />
            <InfoTile
              icon={Layers}
              title="Категории"
              text="Каждый источник, виджет, дашборд и показатель относится к категории. Группе открывают доступ именно к категориям."
            />
            <InfoTile
              icon={Upload}
              title="Не видите данные?"
              text="Если разделы пусты, значит вас ещё не добавили в нужную группу. Обратитесь к администратору системы."
            />
          </div>
        </section>
      )}
    </div>
  );
}


function GuideStep({ icon: Icon, step, title, text }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          {step}
        </span>
        <Icon size={18} className="text-slate-500" />
      </div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  );
}


function InfoTile({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        <Icon size={18} />
      </div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  );
}
