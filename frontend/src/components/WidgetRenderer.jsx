import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#ea580c",
  "#9333ea", "#0891b2", "#ca8a04", "#db2777",
];

/**
 * Универсальный рендерер виджетов.
 *
 * props:
 *   type            — 'bar' | 'line' | 'pie' | 'table' | 'kpi_card'
 *   data            — { rows, metric_keys, dimension_keys } из /widgets/<id>/data
 *   isLoading       — bool
 *   error           — string | null
 */
export default function WidgetRenderer({ type, data, isLoading, error }) {
  if (isLoading) {
    return <Placeholder>Загрузка...</Placeholder>;
  }
  if (error) {
    return <Placeholder error>{error}</Placeholder>;
  }
  if (!data || !data.rows || data.rows.length === 0) {
    return <Placeholder>Нет данных для отображения</Placeholder>;
  }

  const { rows, metric_keys: metricKeys, dimension_keys: dimensionKeys } = data;

  if (type === "kpi_card") {
    return <KpiCard row={rows[0]} keys={metricKeys} />;
  }

  if (type === "table") {
    return <DataTable rows={rows} columns={[...dimensionKeys, ...metricKeys]} />;
  }

  // Чарты требуют хотя бы одного измерения для оси X
  if (dimensionKeys.length === 0) {
    return <Placeholder>Для графика нужно хотя бы одно измерение</Placeholder>;
  }

  const xKey = dimensionKeys[0];

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} angle={-15} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {metricKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    // Для линейного графика осмысленно отсортировать по оси X (часто это даты)
    const sorted = [...rows].sort((a, b) =>
      String(a[xKey]).localeCompare(String(b[xKey]))
    );
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sorted} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} angle={-15} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {metricKeys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    const metricKey = metricKeys[0];
    if (!metricKey) {
      return <Placeholder>Pie-chart требует одну метрику</Placeholder>;
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey={metricKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            label={(entry) => entry[xKey]}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <Placeholder error>Неизвестный тип виджета: {type}</Placeholder>;
}


function Placeholder({ children, error }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-lg p-4 text-sm ${
        error ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"
      }`}
    >
      {children}
    </div>
  );
}


function KpiCard({ row, keys }) {
  return (
    <div className="grid h-full w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((k) => {
        const value = row?.[k];
        const formatted =
          typeof value === "number"
            ? value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })
            : (value ?? "—");
        return (
          <div
            key={k}
            className="flex flex-col justify-center rounded-xl bg-blue-50 p-4 text-center"
          >
            <p className="text-xs uppercase tracking-wider text-blue-700">{k}</p>
            <p className="mt-2 text-3xl font-bold text-blue-900">{formatted}</p>
          </div>
        );
      })}
    </div>
  );
}


function DataTable({ rows, columns }) {
  return (
    <div className="h-full w-full overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-100">
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b px-3 py-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map((c) => {
                const v = row[c];
                const display =
                  typeof v === "number"
                    ? v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })
                    : v === null || v === undefined
                    ? "—"
                    : String(v);
                return (
                  <td key={c} className="border-b px-3 py-2 text-slate-700">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
