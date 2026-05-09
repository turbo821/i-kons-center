import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Table as TableIcon,
  Hash,
} from "lucide-react";

import { listWidgets, getWidgetData } from "../api/widgetApi";
import { useAuth } from "../context/AuthContext";
import WidgetRenderer from "../components/WidgetRenderer";


const TYPE_ICON = {
  bar: BarChart3,
  line: LineIcon,
  pie: PieIcon,
  table: TableIcon,
  kpi_card: Hash,
};

const TYPE_LABEL = {
  bar: "Столбцы",
  line: "Линия",
  pie: "Круг",
  table: "Таблица",
  kpi_card: "KPI",
};


export default function WidgetsPage() {
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWidgets().then(({ data }) => {
      setWidgets(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Виджеты</h1>
          <p className="text-slate-600">
            Конструктор аналитических элементов
          </p>
        </div>

        {canEdit && (
          <Link
            to="/widgets/new"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus size={18} />
            Создать виджет
          </Link>
        )}
      </div>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && widgets.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <BarChart3 className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">Пока нет виджетов</p>
          {canEdit && (
            <p className="mt-2 text-sm text-slate-500">
              Создайте первый виджет, чтобы визуализировать данные
            </p>
          )}
        </div>
      )}

      {widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} />
          ))}
        </div>
      )}
    </div>
  );
}


function WidgetCard({ widget }) {
  const Icon = TYPE_ICON[widget.type] || BarChart3;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWidgetData(widget.id)
      .then(({ data }) => {
        if (active) setData(data);
      })
      .catch((e) => {
        if (active) setError(e?.response?.data?.message || "Ошибка");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [widget.id]);

  return (
    <Link
      to={`/widgets/${widget.id}/edit`}
      className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
            <Icon size={16} />
          </div>
          <div>
            <p className="font-semibold leading-tight">{widget.title}</p>
            <p className="text-xs text-slate-500">
              {TYPE_LABEL[widget.type]} · {widget.dataset_name}
            </p>
          </div>
        </div>
      </div>

      <div className="h-48 rounded-lg bg-slate-50 p-2">
        <WidgetRenderer
          type={widget.type}
          data={data}
          isLoading={loading}
          error={error}
        />
      </div>
    </Link>
  );
}
