import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Save,
  Trash2,
  Plus,
  ArrowLeft,
  RefreshCw,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Table as TableIcon,
  Hash,
  Info,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { listDatasets, getDataset } from "../api/datasetApi";
import {
  listMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
} from "../api/metricApi";
import {
  listDimensions,
  createDimension,
  updateDimension,
  deleteDimension,
} from "../api/dimensionApi";
import {
  getWidget,
  createWidget,
  updateWidget,
  deleteWidget,
  getWidgetData,
} from "../api/widgetApi";
import { widgetCategoryApi } from "../api/categoryApi";

import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import WidgetRenderer from "../components/WidgetRenderer";


const WIDGET_TYPES = [
  { value: "bar", label: "Столбцы", icon: BarChart3 },
  { value: "line", label: "Линия", icon: LineIcon },
  { value: "pie", label: "Круг", icon: PieIcon },
  { value: "table", label: "Таблица", icon: TableIcon },
  { value: "kpi_card", label: "KPI", icon: Hash },
];

const AGGREGATIONS = [
  { value: "sum", label: "Сумма", numericOnly: true },
  { value: "avg", label: "Среднее", numericOnly: true },
  { value: "min", label: "Минимум", numericOnly: true },
  { value: "max", label: "Максимум", numericOnly: true },
  { value: "count", label: "Количество", numericOnly: false },
  { value: "count_distinct", label: "Уникальных", numericOnly: false },
];

const FILTER_OPERATORS = [
  { value: "eq", label: "= равно" },
  { value: "neq", label: "≠ не равно" },
  { value: "gt", label: "> больше" },
  { value: "gte", label: "≥ больше или равно" },
  { value: "lt", label: "< меньше" },
  { value: "lte", label: "≤ меньше или равно" },
  { value: "contains", label: "содержит (текст)" },
  { value: "in", label: "в списке (через запятую)" },
  { value: "not_in", label: "не в списке (через запятую)" },
  { value: "between", label: "между (через запятую: A,B)" },
];


export default function WidgetBuilderPage() {
  const [showDsHelp, setShowDsHelp] = useState(false);
  const { widgetId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const isEdit = !!widgetId;

  const [datasets, setDatasets] = useState([]);

  // Каскад источник → набор данных.
  // datasourceId хранится как строка (значение <select>), datasetId — число.
  const [datasourceId, setDatasourceId] = useState("");
  const [datasetId, setDatasetId] = useState(null);

  const [datasetFields, setDatasetFields] = useState([]);
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [availableDimensions, setAvailableDimensions] = useState([]);

  const [title, setTitle] = useState("Новый виджет");
  const [type, setType] = useState("bar");
  const [selectedMetricIds, setSelectedMetricIds] = useState([]);
  const [selectedDimensionIds, setSelectedDimensionIds] = useState([]);
  const [filters, setFilters] = useState([]);

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savedWidgetId, setSavedWidgetId] = useState(widgetId || null);

  const fieldById = useMemo(
    () => Object.fromEntries(datasetFields.map((f) => [f.id, f])),
    [datasetFields]
  );

  // Производный список источников: уникализируем datasets по datasource_id,
  // чтобы получить варианты для верхнего селекта каскада.
  const datasources = useMemo(() => {
    const map = new Map();
    for (const d of datasets) {
      if (!d.datasource_id) continue;
      if (!map.has(d.datasource_id)) {
        map.set(d.datasource_id, {
          id: d.datasource_id,
          name: d.datasource_name,
          category_name: d.datasource_category_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, [datasets]);

  // Наборы данных, отфильтрованные по выбранному источнику.
  const datasetsForCurrentDatasource = useMemo(() => {
    if (!datasourceId) return [];
    const dsid = Number(datasourceId);
    return datasets.filter((d) => d.datasource_id === dsid);
  }, [datasets, datasourceId]);


  useEffect(() => {
    listDatasets().then(({ data }) => setDatasets(data)).catch(() => {});
    widgetCategoryApi.list().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);


  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data: w } = await getWidget(widgetId);
        setTitle(w.title);
        setType(w.type);
        setDatasetId(w.dataset_id);
        // При редактировании datasource_id виджета берём из его dataset
        // (нужно для отображения корректного значения в верхнем селекте).
        // Делаем это после того, как datasets подгрузятся.
        setCategoryId(w.category_id ? String(w.category_id) : "");
        setSelectedMetricIds((w.metrics || []).map((m) => m.id));
        setSelectedDimensionIds((w.dimensions || []).map((d) => d.id));
        setFilters(
          (w.filters || []).map((f) => ({
            field_id: f.field_id,
            operator: f.operator,
            value: f.value || "",
          }))
        );
      } catch {
        toast.error("Виджет не найден");
        navigate("/widgets");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, widgetId]);

  // Когда datasets подгрузились и есть выбранный dataset (например, при
  // редактировании виджета) — подставляем datasource_id в верхний селект.
  useEffect(() => {
    if (!datasetId || datasets.length === 0) return;
    const ds = datasets.find((d) => d.id === datasetId);
    if (ds && ds.datasource_id) {
      setDatasourceId(String(ds.datasource_id));
    }
  }, [datasetId, datasets]);


  useEffect(() => {
    if (!savedWidgetId) return;

    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);

    getWidgetData(savedWidgetId)
      .then(({ data }) => active && setPreviewData(data))
      .catch((e) => active && setPreviewError(e?.response?.data?.message || "Ошибка"))
      .finally(() => active && setPreviewLoading(false));

    return () => { active = false; };
  }, [savedWidgetId]);


  // Загружаем поля датасета и доступные метрики/измерения при смене dataset.
  // Вынесено в отдельную функцию: после редактирования метрики/измерения
  // (или их создания/удаления) мы перезапускаем эту же логику, чтобы
  // подтянуть свежие данные с сервера.
  const reloadDatasetMeta = async (dsId) => {
    if (!dsId) {
      setDatasetFields([]);
      setAvailableMetrics([]);
      setAvailableDimensions([]);
      return;
    }
    try {
      const [dsRes, metRes, dimRes] = await Promise.all([
        getDataset(dsId),
        listMetrics(dsId),
        listDimensions(dsId),
      ]);
      setDatasetFields(dsRes.data.fields || []);
      setAvailableMetrics(metRes.data);
      setAvailableDimensions(dimRes.data);
    } catch (e) {
      toast.error("Не удалось загрузить мета-данные");
    }
  };

  useEffect(() => {
    reloadDatasetMeta(datasetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);


  const buildPayload = () => ({
    dataset_id: datasetId,
    title,
    type,
    category_id: categoryId ? Number(categoryId) : null,
    metric_ids: selectedMetricIds,
    dimension_ids: selectedDimensionIds,
    filters,
  });


  const handlePreview = async () => {
    if (!datasetId) {
      toast.error("Выберите датасет");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      let id = savedWidgetId;
      const payload = buildPayload();
      if (id) {
        await updateWidget(id, payload);
      } else {
        const { data } = await createWidget(payload);
        id = data.id;
        setSavedWidgetId(id);
      }

      const { data } = await getWidgetData(id);
      setPreviewData(data);
    } catch (e) {
      const msg = e?.response?.data?.message || "Ошибка";
      setPreviewError(msg);
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };


  const handleSaveAndExit = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (savedWidgetId) {
        await updateWidget(savedWidgetId, payload);
      } else {
        await createWidget(payload);
      }
      toast.success("Виджет сохранён");
      navigate("/widgets");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async () => {
    if (!savedWidgetId) {
      navigate("/widgets");
      return;
    }
    const ok = await confirm({
      title: "Удалить виджет?",
      body: `«${title}» будет удалён вместе со всеми размещениями на дашбордах.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteWidget(savedWidgetId);
      toast.success("Виджет удалён");
      navigate("/widgets");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка удаления");
    }
  };


  const handleCreateMetric = async (fieldId, aggregationType, customName) => {
    const field = fieldById[fieldId];
    if (!field) return;
    const name = (customName || "").trim() ||
      `${labelFor(aggregationType)} ${field.name}`;
    try {
      const { data } = await createMetric({
        field_id: fieldId,
        name,
        aggregation_type: aggregationType,
      });
      setAvailableMetrics((prev) =>
        prev.find((m) => m.id === data.id) ? prev : [...prev, data]
      );
      setSelectedMetricIds((prev) =>
        prev.includes(data.id) ? prev : [...prev, data.id]
      );
      toast.success("Метрика создана");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };


  const handleCreateDimension = async (fieldId, customName) => {
    const field = fieldById[fieldId];
    if (!field) return;
    const name = (customName || "").trim() || `По ${field.name}`;
    try {
      const { data } = await createDimension({
        field_id: fieldId,
        name,
      });
      setAvailableDimensions((prev) =>
        prev.find((d) => d.id === data.id) ? prev : [...prev, data]
      );
      setSelectedDimensionIds((prev) =>
        prev.includes(data.id) ? prev : [...prev, data.id]
      );
      toast.success("Измерение создано");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };


  // Обновление метрики/измерения — после успеха перезагружаем мета,
  // чтобы все списки и предпросмотр получили актуальные имена.
  const handleUpdateMetric = async (metricId, patch) => {
    try {
      const { data } = await updateMetric(metricId, patch);
      setAvailableMetrics((prev) =>
        prev.map((m) => (m.id === metricId ? data : m))
      );
      toast.success("Метрика обновлена");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleDeleteMetric = async (metricId, name) => {
    const ok = await confirm({
      title: "Удалить метрику?",
      body: `«${name}» будет удалена. Действие невозможно, если метрика используется в виджетах.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMetric(metricId);
      setAvailableMetrics((prev) => prev.filter((m) => m.id !== metricId));
      setSelectedMetricIds((prev) => prev.filter((id) => id !== metricId));
      toast.success("Метрика удалена");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleUpdateDimension = async (dimId, patch) => {
    try {
      const { data } = await updateDimension(dimId, patch);
      setAvailableDimensions((prev) =>
        prev.map((d) => (d.id === dimId ? data : d))
      );
      toast.success("Измерение обновлено");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleDeleteDimension = async (dimId, name) => {
    const ok = await confirm({
      title: "Удалить измерение?",
      body: `«${name}» будет удалено. Действие невозможно, если измерение используется в виджетах.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDimension(dimId);
      setAvailableDimensions((prev) => prev.filter((d) => d.id !== dimId));
      setSelectedDimensionIds((prev) => prev.filter((id) => id !== dimId));
      toast.success("Измерение удалено");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/widgets")}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название виджета"
            className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold focus:border-slate-300 focus:bg-white"
          />
        </div>

        <div className="flex gap-2">
          {savedWidgetId && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 size={16} />
              Удалить
            </button>
          )}
          <button
            onClick={handleSaveAndExit}
            disabled={saving || !datasetId}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">

        <div className="space-y-4">

          {/* Каскад: сначала источник, потом набор данных */}
          <Section
            title={
              <div className="flex items-center gap-1">
                <span>Источник данных</span>
                <button
                  type="button"
                  onMouseEnter={() => setShowDsHelp(true)}
                  onMouseLeave={() => setShowDsHelp(false)}
                  className="relative rounded p-0.5 text-slate-400 hover:text-slate-700"
                  aria-label="Подсказка"
                >
                  <Info size={14} />
                  {showDsHelp && (
                    <div className="absolute bottom-full left-0 z-10 mb-1 w-96 rounded-lg border border-slate-200 bg-slate-900 p-3 text-left text-xs text-white shadow-lg">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                        Сначала выберите источник данных, затем — конкретный
                        набор данных внутри него.
                      </pre>
                    </div>
                  )}
                </button>
              </div>
            }
          >
            <select
              value={datasourceId}
              onChange={(e) => {
                setDatasourceId(e.target.value);
                // При смене источника сбрасываем дочерние выборы
                setDatasetId(null);
                setSelectedMetricIds([]);
                setSelectedDimensionIds([]);
                setFilters([]);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— выберите источник —</option>
              {datasources.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.category_name ? `${ds.category_name}/` : ""}
                  {ds.name}
                </option>
              ))}
            </select>

            {datasourceId && (
              <div className="mt-2">
                <select
                  value={datasetId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    setDatasetId(id);
                    setSelectedMetricIds([]);
                    setSelectedDimensionIds([]);
                    setFilters([]);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— выберите набор данных —</option>
                  {datasetsForCurrentDatasource.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Section>

          <Section title="Категория">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— без категории —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Тип виджета">
            <div className="grid grid-cols-5 gap-2">
              {WIDGET_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition ${
                      type === t.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={18} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {datasetId && (
            <Section title="Метрики">
              <MetricList
                metrics={availableMetrics}
                fields={datasetFields}
                selectedIds={selectedMetricIds}
                onToggle={(id) =>
                  setSelectedMetricIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id]
                  )
                }
                onUpdate={handleUpdateMetric}
                onDelete={handleDeleteMetric}
              />

              <details className="mt-3 rounded-lg bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-700">
                  + Создать метрику
                </summary>
                <NewMetricForm
                  fields={datasetFields}
                  onCreate={handleCreateMetric}
                />
              </details>
            </Section>
          )}

          {datasetId && (
            <Section title="Измерения (группировка)">
              <DimensionList
                dimensions={availableDimensions}
                fields={datasetFields}
                selectedIds={selectedDimensionIds}
                onToggle={(id) =>
                  setSelectedDimensionIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id]
                  )
                }
                onUpdate={handleUpdateDimension}
                onDelete={handleDeleteDimension}
              />

              <details className="mt-3 rounded-lg bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-700">
                  + Создать измерение
                </summary>
                <NewDimensionForm
                  fields={datasetFields}
                  existing={availableDimensions}
                  onCreate={handleCreateDimension}
                />
              </details>
            </Section>
          )}

          {datasetId && (
            <Section title="Фильтры">
              {filters.length === 0 && (
                <p className="mb-2 text-xs text-slate-500">Нет фильтров</p>
              )}

              <div className="space-y-2">
                {filters.map((f, i) => (
                  <FilterRow
                    key={i}
                    fields={datasetFields}
                    filter={f}
                    onChange={(updated) =>
                      setFilters((prev) =>
                        prev.map((x, j) => (j === i ? updated : x))
                      )
                    }
                    onRemove={() =>
                      setFilters((prev) => prev.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </div>

              <button
                onClick={() =>
                  setFilters((prev) => [
                    ...prev,
                    {
                      field_id: datasetFields[0]?.id || null,
                      operator: "eq",
                      value: "",
                    },
                  ])
                }
                className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                <Plus size={14} />
                Добавить фильтр
              </button>
            </Section>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Предпросмотр</h2>
            <button
              onClick={handlePreview}
              disabled={!datasetId || previewLoading}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={previewLoading ? "animate-spin" : ""}
              />
              Применить
            </button>
          </div>

          <div className="h-[500px]">
            <WidgetRenderer
              type={type}
              data={previewData}
              isLoading={previewLoading}
              error={previewError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}


// Список метрик с inline-редактированием.
// Редактируем имя и тип агрегации; для смены поля датасета — отдельная
// форма (через "Создать метрику" + удаление старой), потому что менять
// field на лету у уже выбранной метрики сбивает кэшированные данные
// виджетов, использующих эту метрику.
function MetricList({ metrics, fields, selectedIds, onToggle, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAgg, setEditAgg] = useState("sum");

  if (metrics.length === 0) {
    return <p className="text-xs text-slate-500">Нет созданных метрик</p>;
  }

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditAgg(m.aggregation_type);
  };

  const cancel = () => setEditingId(null);

  const save = async (m) => {
    const patch = {};
    if (editName.trim() && editName !== m.name) patch.name = editName.trim();
    if (editAgg !== m.aggregation_type) patch.aggregation_type = editAgg;
    if (Object.keys(patch).length > 0) {
      await onUpdate(m.id, patch);
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-1.5">
      {metrics.map((m) => {
        const isEditing = editingId === m.id;
        const field = fields.find((f) => f.id === m.field_id);
        const isNumeric = field
          ? ["integer", "float"].includes(field.data_type)
          : false;
        const allowedAggs = AGGREGATIONS.filter(
          (a) => !a.numericOnly || isNumeric
        );

        return (
          <div
            key={m.id}
            className="flex items-start gap-2 rounded-lg p-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={() => onToggle(m.id)}
              disabled={isEditing}
              className="mt-1 rounded"
            />

            {isEditing ? (
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  placeholder="Имя"
                  autoFocus
                />
                <select
                  value={editAgg}
                  onChange={(e) => setEditAgg(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  {allowedAggs.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Поле: {m.field_name} [{field?.data_type || "?"}]
                </p>
              </div>
            ) : (
              <label className="flex-1 cursor-pointer text-sm">
                <span className="block">{m.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {m.field_name} · {labelFor(m.aggregation_type)}
                </span>
              </label>
            )}

            <div className="flex shrink-0 gap-0.5">
              {isEditing ? (
                <>
                  <button
                    onClick={() => save(m)}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    title="Сохранить"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancel}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Отмена"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(m)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Редактировать"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(m.id, m.name)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function DimensionList({ dimensions, fields, selectedIds, onToggle, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  if (dimensions.length === 0) {
    return <p className="text-xs text-slate-500">Нет созданных измерений</p>;
  }

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditName(d.name);
  };

  const cancel = () => setEditingId(null);

  const save = async (d) => {
    if (editName.trim() && editName !== d.name) {
      await onUpdate(d.id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-1.5">
      {dimensions.map((d) => {
        const isEditing = editingId === d.id;
        const field = fields.find((f) => f.id === d.field_id);

        return (
          <div
            key={d.id}
            className="flex items-start gap-2 rounded-lg p-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(d.id)}
              onChange={() => onToggle(d.id)}
              disabled={isEditing}
              className="mt-1 rounded"
            />

            {isEditing ? (
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  placeholder="Имя"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500">
                  Поле: {d.field_name} [{field?.data_type || "?"}]
                </p>
              </div>
            ) : (
              <label className="flex-1 cursor-pointer text-sm">
                <span className="block">{d.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {d.field_name}
                </span>
              </label>
            )}

            <div className="flex shrink-0 gap-0.5">
              {isEditing ? (
                <>
                  <button
                    onClick={() => save(d)}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    title="Сохранить"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancel}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Отмена"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(d)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Редактировать"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(d.id, d.name)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function NewMetricForm({ fields, onCreate }) {
  const [fieldId, setFieldId] = useState("");
  const [agg, setAgg] = useState("sum");
  const [customName, setCustomName] = useState("");

  const field = fields.find((f) => f.id === Number(fieldId));
  const isNumeric = field
    ? ["integer", "float"].includes(field.data_type)
    : false;

  const allowedAggs = AGGREGATIONS.filter(
    (a) => !a.numericOnly || isNumeric
  );

  const autoName = field
    ? `${labelFor(agg)} ${field.name}`
    : "";

  const submit = (e) => {
    e.preventDefault();
    if (!fieldId) return;
    onCreate(Number(fieldId), agg, customName);
    setFieldId("");
    setCustomName("");
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <select
        value={fieldId}
        onChange={(e) => {
          setFieldId(e.target.value);
          setAgg("sum");
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        <option value="">— поле —</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name} [{f.data_type}]
          </option>
        ))}
      </select>

      <select
        value={agg}
        onChange={(e) => setAgg(e.target.value)}
        disabled={!fieldId}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        {allowedAggs.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        placeholder={autoName || "Имя для отображения (необязательно)"}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
      <p className="text-[10px] leading-tight text-slate-500">
        Это имя будет показано на графике (легенда, ось Y).
        Если оставить пустым — будет «{autoName || "автоматическое имя"}».
      </p>

      <button
        type="submit"
        disabled={!fieldId}
        className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Создать
      </button>
    </form>
  );
}


function NewDimensionForm({ fields, existing, onCreate }) {
  const [fieldId, setFieldId] = useState("");
  const [customName, setCustomName] = useState("");
  const existingFieldIds = new Set(existing.map((d) => d.field_id));

  const field = fields.find((f) => f.id === Number(fieldId));
  const autoName = field ? `По ${field.name}` : "";

  const submit = (e) => {
    e.preventDefault();
    if (!fieldId) return;
    onCreate(Number(fieldId), customName);
    setFieldId("");
    setCustomName("");
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <select
        value={fieldId}
        onChange={(e) => setFieldId(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        <option value="">— поле —</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name} [{f.data_type}]
            {existingFieldIds.has(f.id) ? " ✓" : ""}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        placeholder={autoName || "Имя для отображения (необязательно)"}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
      <p className="text-[10px] leading-tight text-slate-500">
        Это имя будет показано на графике (легенда, ось X).
        Если оставить пустым — будет «{autoName || "автоматическое имя"}».
      </p>

      <button
        type="submit"
        disabled={!fieldId}
        className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Создать
      </button>
    </form>
  );
}


function FilterRow({ fields, filter, onChange, onRemove }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 p-2">
      <select
        value={filter.field_id || ""}
        onChange={(e) =>
          onChange({ ...filter, field_id: Number(e.target.value) || null })
        }
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        <option value="">— поле —</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>

      <select
        value={filter.operator}
        onChange={(e) => onChange({ ...filter, operator: e.target.value })}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        {FILTER_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex gap-1">
        <input
          type="text"
          value={filter.value}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          placeholder="Значение"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        />
        <button
          onClick={onRemove}
          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}


function labelFor(agg) {
  const found = AGGREGATIONS.find((a) => a.value === agg);
  return found ? found.label : agg;
}
