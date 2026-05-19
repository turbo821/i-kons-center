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

// Палитра для столбчатой и линейной диаграммы.
// Холодные, насыщенные цвета — хорошо различимы рядом на одной оси.
const BAR_COLORS = [
  "#2563eb", // синий
  "#16a34a", // зелёный
  "#dc2626", // красный
  "#0891b2", // голубой
  "#9333ea", // фиолетовый
  "#ea580c", // оранжевый
  "#ca8a04", // охра
  "#db2777", // розовый
];

// Палитра для круговой диаграммы.
// Более «пастельные» / приглушённые оттенки — секторы рядом не «жгут»
// глаз. Намеренно отличается от BAR_COLORS, чтобы две диаграммы на
// одном дашборде визуально различались.
const PIE_COLORS = [
  "#6366f1", // индиго
  "#14b8a6", // бирюзовый
  "#f59e0b", // янтарный
  "#ef4444", // красный коралл
  "#8b5cf6", // лавандовый
  "#10b981", // изумрудный
  "#f97316", // тыквенный
  "#ec4899", // розово-малиновый
  "#84cc16", // лаймовый
  "#06b6d4", // циан
];

// Зона под наклонные подписи XAxis в SVG.
const X_AXIS_HEIGHT = 60;

// Общий margin для чартов.
const CHART_MARGIN = { top: 10, right: 20, bottom: 15, left: 0 };

// Сколько подписей по оси X показывать максимум.
const MAX_X_TICKS = 8;


function calcXAxisInterval(pointsCount) {
  if (pointsCount <= MAX_X_TICKS) return 0;
  return Math.ceil(pointsCount / MAX_X_TICKS) - 1;
}


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
    return <KpiInlineCard row={rows[0]} keys={metricKeys} />;
  }

  if (type === "table") {
    return <DataTable rows={rows} columns={[...dimensionKeys, ...metricKeys]} />;
  }

  if (dimensionKeys.length === 0) {
    return <Placeholder>Для графика нужно хотя бы одно измерение</Placeholder>;
  }

  const xKey = dimensionKeys[0];

  if (type === "bar") {
    const singleMetric = metricKeys.length === 1;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            angle={-25}
            textAnchor="end"
            height={X_AXIS_HEIGHT}
            interval={calcXAxisInterval(rows.length)}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {metricKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              radius={[4, 4, 0, 0]}
            >
              {singleMetric &&
                rows.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    const sorted = [...rows].sort((a, b) =>
      String(a[xKey]).localeCompare(String(b[xKey]))
    );
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sorted} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            angle={-25}
            textAnchor="end"
            height={X_AXIS_HEIGHT}
            interval={calcXAxisInterval(sorted.length)}
            minTickGap={30}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {metricKeys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={BAR_COLORS[i % BAR_COLORS.length]}
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

    return <PieWithSideLegend rows={rows} xKey={xKey} metricKey={metricKey} />;
  }

  return <Placeholder error>Неизвестный тип виджета: {type}</Placeholder>;
}


/**
 * Круговая диаграмма с вертикальной легендой справа.
 *
 * Почему не используем встроенный <Legend layout="vertical" align="right">:
 *  - он съедает фиксированный процент ширины SVG, и при длинных подписях
 *    обрезается;
 *  - его сложно стилизовать (нумерация, цветовые маркеры в формате квадратов,
 *    форматирование значений);
 *  - в нём показываются все элементы без ограничения, а у нас секторов
 *    может быть много — нужен скролл.
 *
 * Поэтому делаем кастомный лейаут: чарт занимает левые 2/3, легенда
 * — правые 1/3 с собственным скроллом. Сверху над всем — название метрики
 * (заменяет нижнюю легенду в bar/line-чартах, чтобы согласовать тип
 * визуализации).
 */
function PieWithSideLegend({ rows, xKey, metricKey }) {
  // Считаем итог, чтобы показать процент каждой доли в легенде
  const total = rows.reduce((acc, r) => {
    const v = r[metricKey];
    return acc + (typeof v === "number" ? v : 0);
  }, 0);

  return (
    <div className="flex h-full w-full flex-col gap-1">
      {/* Шапка: имя метрики — аналог легенды в bar/line */}
      <div className="flex shrink-0 items-center gap-2 px-2 pt-1">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: "#475569" }}
        />
        <span className="text-xs font-medium text-slate-600">{metricKey}</span>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Диаграмма — занимает левую часть */}
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={rows}
                dataKey={metricKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius="90%"
                isAnimationActive={false}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Легенда справа — список «цвет + имя сектора + значение/процент».
            Скроллится, если секторов много. shrink-0 + фикс. ширина дают
            одинаковую раскладку независимо от размера виджета. */}
        <div className="w-40 shrink-0 overflow-auto pr-1 text-xs">
          <ul className="space-y-1">
            {rows.map((r, i) => {
              const v = r[metricKey];
              const numeric = typeof v === "number";
              const formatted = numeric
                ? v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })
                : "—";
              const pct = numeric && total > 0
                ? ((v / total) * 100).toFixed(1)
                : null;
              return (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-slate-700 break-words leading-tight"
                        title={String(r[xKey] ?? "")}
                      >
                        {r[xKey] ?? "—"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatted}
                        {pct !== null && ` · ${pct}%`}
                      </div>
                    </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
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


function KpiInlineCard({ row, keys }) {
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
