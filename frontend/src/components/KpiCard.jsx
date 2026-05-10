import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";

import { getKpiValue } from "../api/kpiApi";


/**
 * Карточка отображения KPI.
 * props:
 *   kpi              — объект KPI {id, name, target_value, unit, direction, ...}
 *   compact          — компактный режим (для дашборда)
 *   onClick          — опциональный обработчик
 */
export default function KpiCard({ kpi, compact = false, onClick }) {
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getKpiValue(kpi.id)
      .then(({ data }) => active && setValue(data))
      .catch((e) => active && setError(e?.response?.data?.message || "Ошибка"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kpi.id]);

  const isClickable = !!onClick;
  const Wrapper = isClickable ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={`
        block w-full rounded-2xl bg-white p-4 text-left shadow-sm
        ${isClickable ? "transition hover:shadow-md" : ""}
      `}
    >
      {/* Заголовок KPI */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-semibold">{kpi.name}</p>
          {kpi.category_name && (
            <p className="text-xs text-slate-500">{kpi.category_name}</p>
          )}
        </div>
        <DirectionBadge direction={kpi.direction} />
      </div>

      {/* Тело карточки */}
      {loading && <p className="text-sm text-slate-400">Загрузка...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && value && (
        <KpiBody data={value} compact={compact} />
      )}
    </Wrapper>
  );
}


function DirectionBadge({ direction }) {
  const Icon = direction === "lower_better" ? TrendingDown : TrendingUp;
  const label = direction === "lower_better" ? "↓ лучше" : "↑ лучше";
  const cls =
    direction === "lower_better"
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      title={direction === "lower_better" ? "Чем меньше — тем лучше" : "Чем больше — тем лучше"}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}


function KpiBody({ data, compact }) {
  const { current_value, target_value, unit, achievement_percent, is_target_met } = data;

  const formattedCurrent = formatValue(current_value);
  const formattedTarget = formatValue(target_value);

  // Цвет статусной полосы
  let statusColor = "bg-slate-300";
  let textColor = "text-slate-900";
  if (achievement_percent !== null) {
    if (achievement_percent >= 100) {
      statusColor = "bg-emerald-500";
      textColor = "text-emerald-700";
    } else if (achievement_percent >= 70) {
      statusColor = "bg-amber-500";
      textColor = "text-amber-700";
    } else {
      statusColor = "bg-red-500";
      textColor = "text-red-700";
    }
  }

  // Прогресс-бар: ограничиваем сверху 100% для визуала, но цифрой показываем реальное
  const progressWidth =
    achievement_percent === null
      ? 0
      : Math.min(achievement_percent, 100);

  return (
    <div className="space-y-2">
      {/* Большое число */}
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${textColor}`}>
          {formattedCurrent}
        </span>
        {unit && (
          <span className="text-sm text-slate-500">{unit}</span>
        )}
      </div>

      {target_value !== null && target_value !== undefined && (
        <>
          {/* Прогресс-бар */}
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${statusColor}`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>

          {/* Цель и процент */}
          {!compact && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Цель: {formattedTarget}{unit ? ` ${unit}` : ""}
              </span>
              <span className={`flex items-center gap-1 font-medium ${textColor}`}>
                {is_target_met ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <AlertCircle size={12} />
                )}
                {achievement_percent !== null
                  ? `${achievement_percent}%`
                  : "—"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function formatValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}
