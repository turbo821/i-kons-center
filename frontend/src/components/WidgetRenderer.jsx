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

// Палитра для столбчатой/линейной диаграммы (серии = метрики или значения
// второго измерения).
const BAR_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#0ea5e9",
  "#9333ea", "#0891b2", "#ca8a04", "#db2777",
  "#ea580c", "#65a30d", "#e11d48", "#7c3aed",
];

// Палитра для круговой диаграммы.
const PIE_COLORS = [
  "#6366f1", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#10b981", "#f97316", "#ec4899",
  "#84cc16", "#06b6d4", "#a855f7", "#22c55e",
];

const X_AXIS_HEIGHT = 60;
const CHART_MARGIN = { top: 10, right: 20, bottom: 15, left: 0 };
const MAX_X_TICKS = 8;


function calcXAxisInterval(pointsCount) {
  if (pointsCount <= MAX_X_TICKS) return 0;
  return Math.ceil(pointsCount / MAX_X_TICKS) - 1;
}


export default function WidgetRenderer({ type, data, isLoading, error }) {
  if (isLoading) return <Placeholder>Загрузка...</Placeholder>;
  if (error) return <Placeholder error>{error}</Placeholder>;
  if (!data || !data.rows || data.rows.length === 0) {
    return <Placeholder>Нет данных для отображения</Placeholder>;
  }

  const {
    rows,
    metric_keys: metricKeys = [],
    dimension_keys: dimensionKeys = [],
    x_key: xKeyFromApi,
    series_keys: seriesKeysFromApi,
  } = data;

  if (type === "table") {
    // Для таблицы показываем измерения + метрики; series в таблице не нужны.
    const cols = data.x_key
      ? [data.x_key, ...(seriesKeysFromApi || metricKeys)]
      : [...dimensionKeys, ...metricKeys];
    // Безопасный фолбэк: если в строках другие ключи — берём их из первой строки
    const realCols = cols.filter((c) => c in (rows[0] || {}));
    const columns = realCols.length ? realCols : Object.keys(rows[0] || {});
    return <DataTable rows={rows} columns={columns} />;
  }

  // Ось X: x_key если есть, иначе первое измерение (обратная совместимость).
  const xKey = xKeyFromApi || dimensionKeys[0];
  if (!xKey) {
    return <Placeholder>Для графика нужно хотя бы одно измерение</Placeholder>;
  }

  // Серии: series_keys если есть (pivot или метрики), иначе метрики.
  const seriesKeys =
    seriesKeysFromApi && seriesKeysFromApi.length > 0
      ? seriesKeysFromApi
      : metricKeys;

  if (type === "bar") {
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
          {seriesKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "horizontal_bar") {
    const maxLabel = rows.reduce((acc, r) => {
      const s = String(r[xKey] ?? "");
      return s.length > acc ? s.length : acc;
    }, 0);
    const yAxisWidth = Math.min(160, Math.max(60, maxLabel * 7));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            width={yAxisWidth}
            interval={0}
          />
          <Tooltip />
          <Legend />
          {seriesKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              radius={[0, 4, 4, 0]}
            />
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
          {seriesKeys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={BAR_COLORS[i % BAR_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <PieRenderer
        rows={rows}
        xKey={xKey}
        seriesKeys={seriesKeys}
        metricKeys={metricKeys}
      />
    );
  }

  return <Placeholder error>Неизвестный тип виджета: {type}</Placeholder>;
}


/**
 * Круговая диаграмма.
 *
 * Режимы:
 *  1. Одна серия → классический pie: сектор на каждое значение оси.
 *  2. Несколько серий (pivot по 2-му измерению) → сектор на пару
 *     «значение_оси — серия». Сектора СГРУППИРОВАНЫ по серии (магазину):
 *     идут подряд по кругу, заливка = по значению оси (товару),
 *     обводка (stroke) = цвет серии (магазина). Так доли одного магазина
 *     образуют единую дугу, обведённую одним цветом.
 */
function PieRenderer({ rows, xKey, seriesKeys, metricKeys }) {
  const multiSeries = seriesKeys.length > 1;

  // --- Режим 1: одна серия — плоский pie + боковая легенда ---
  if (!multiSeries) {
    const metricKey = seriesKeys[0] || metricKeys[0];
    if (!metricKey) {
      return <Placeholder>Pie-chart требует одну метрику</Placeholder>;
    }
    const slices = rows.map((r, i) => ({
      label: String(r[xKey] ?? "—"),
      value: typeof r[metricKey] === "number" ? r[metricKey] : 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
      stroke: "#ffffff",
      strokeWidth: 1,
    }));
    const total = slices.reduce((acc, s) => acc + (s.value || 0), 0);
    return <PieWithLegend slices={slices} total={total} groups={null} />;
  }

  // --- Режим 2: pivot — группировка по сериям с обводкой ---
  // Цвет заливки закрепляем за значением оси (товаром), чтобы один товар
  // был одного цвета во всех магазинах.
  const xValues = rows.map((r) => String(r[xKey] ?? "—"));
  const fillByX = {};
  xValues.forEach((label, i) => {
    if (!(label in fillByX)) {
      fillByX[label] = PIE_COLORS[Object.keys(fillByX).length % PIE_COLORS.length];
    }
  });

  // Обводка закрепляется за серией (магазином).
  const strokeBySeries = {};
  seriesKeys.forEach((s, i) => {
    strokeBySeries[s] = SERIES_STROKE_COLORS[i % SERIES_STROKE_COLORS.length];
  });

  // Собираем сектора, сгруппированные по серии: сначала все доли магазина 1,
  // потом магазина 2, и т.д. — так они идут подряд по кругу.
  const slices = [];
  const groups = []; // для легенды: { series, color, items: [...] }
  for (const s of seriesKeys) {
    const groupItems = [];
    rows.forEach((r, i) => {
      const v = r[s];
      if (v === null || v === undefined) return;
      const numeric = typeof v === "number" ? v : 0;
      if (numeric === 0) return;
      const slice = {
        label: `${xValues[i]} — ${s}`,
        shortLabel: xValues[i],
        value: numeric,
        fill: fillByX[xValues[i]],
        stroke: strokeBySeries[s],
        strokeWidth: 2.5,
      };
      slices.push(slice);
      groupItems.push(slice);
    });
    if (groupItems.length) {
      groups.push({ series: s, color: strokeBySeries[s], items: groupItems });
    }
  }

  const total = slices.reduce((acc, sl) => acc + (sl.value || 0), 0);
  return <PieWithLegend slices={slices} total={total} groups={groups} />;
}


// Палитра для ОБВОДКИ секторов (= серии/магазины). Намеренно тёмная и
// контрастная к пастельным заливкам PIE_COLORS, чтобы обводка читалась.
const SERIES_STROKE_COLORS = [
  "#1e293b", // почти чёрный (slate-800)
  "#b91c1c", // тёмно-красный
  "#1d4ed8", // тёмно-синий
  "#15803d", // тёмно-зелёный
  "#7e22ce", // тёмно-фиолетовый
  "#a16207", // тёмная охра

];


/**
 * Pie + боковая легенда. Если переданы groups (pivot) — легенда
 * группируется по сериям с заголовком и цветом обводки; иначе обычный
 * список секторов.
 */
function PieWithLegend({ slices, total, groups }) {
  return (
    <div className="flex h-full w-full min-h-0 gap-2">
      <div className="min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius="90%"
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell
                  key={i}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-44 shrink-0 overflow-auto pr-1 text-xs">
        {groups ? (
          // Легенда сгруппирована по сериям (магазинам)
          groups.map((g, gi) => (
            <div key={gi} className="mb-2">
              <div
                className="mb-1 flex items-center gap-1.5 font-medium text-slate-700"
                title={`Серия: ${g.series}`}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm border-2"
                  style={{ borderColor: g.color, backgroundColor: "transparent" }}
                />
                <span className="truncate">{g.series}</span>
              </div>
              <ul className="space-y-0.5 pl-1">
                {g.items.map((s, i) => {
                  const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : null;
                  return (
                    <li key={i} className="flex items-start gap-1.5">
                      <span
                        className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: s.fill }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-slate-700" title={s.shortLabel}>
                          {s.shortLabel}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {s.value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                          {pct !== null && ` · ${pct}%`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          // Обычная легенда (одна серия)
          <ul className="space-y-1">
            {slices.map((s, i) => {
              const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : null;
              return (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.fill }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-700 break-words leading-tight" title={s.label}>
                      {s.label}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {s.value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                      {pct !== null && ` · ${pct}%`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
