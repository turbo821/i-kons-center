import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  FolderTree,
  Check,
  X,
} from "lucide-react";

import {
  listKpis,
  createKpi,
  updateKpi,
  deleteKpi,
} from "../api/kpiApi";
import { kpiCategoryApi } from "../api/categoryApi";
import CategoriesModal from "../components/CategoriesModal";
import CategoryFilterChips from "../components/CategoryFilterChips";
import {
  listMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
} from "../api/metricApi";
import { listDatasets, getDataset } from "../api/datasetApi";

import { useAuth } from "../context/AuthContext";
import { useAccess } from "../context/AccessContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import KpiCard from "../components/KpiCard";
import ListToolbar, { applySort, matchesSearch } from "../components/ListToolbar";


const AGGREGATIONS = [
  { value: "sum", label: "Сумма", numericOnly: true },
  { value: "avg", label: "Среднее", numericOnly: true },
  { value: "min", label: "Минимум", numericOnly: true },
  { value: "max", label: "Максимум", numericOnly: true },
  { value: "count", label: "Количество", numericOnly: false },
  { value: "count_distinct", label: "Уникальных", numericOnly: false },
];

const SORT_OPTIONS = [
  { value: "created_desc", label: "Сначала новые" },
  { value: "created_asc", label: "Сначала старые" },
  { value: "name_asc", label: "По имени А→Я" },
  { value: "name_desc", label: "По имени Я→А" },
];

const SORT_MAP = {
  created_desc: { field: "created_at", direction: "desc" },
  created_asc: { field: "created_at", direction: "asc" },
  name_asc: { field: "name", direction: "asc" },
  name_desc: { field: "name", direction: "desc" },
};


export default function KpiPage() {
  const { user } = useAuth();
  const { canEdit, canCreateAny, isAdmin } = useAccess();
  const toast = useToast();
  const confirm = useConfirm();
  const canCreate = canCreateAny("kpi");

  const [kpis, setKpis] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [filterCategory, setFilterCategory] = useState(undefined);
  const [filterDirection, setFilterDirection] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [kpiRes, catRes] = await Promise.all([
        listKpis(),
        kpiCategoryApi.list(),
      ]);
      setKpis(kpiRes.data);
      setCategories(catRes.data);
    } catch (e) {
      toast.error("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredKpis = useMemo(() => {
    let result = kpis;
    if (filterCategory !== undefined) {
      result = result.filter((k) => k.category_id === filterCategory);
    }
    if (filterDirection) result = result.filter((k) => k.direction === filterDirection);
    result = result.filter((k) =>
      matchesSearch(k, search, ["name", "description", "category_name"])
    );
    return applySort(result, sort, SORT_MAP);
  }, [kpis, search, sort, filterCategory, filterDirection]);

  const handleDelete = async (kpi) => {
    const ok = await confirm({
      title: "Удалить KPI?",
      body: `«${kpi.name}» будет удалён.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteKpi(kpi.id);
      toast.success("KPI удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleEdit = (kpi) => {
    setEditingKpi(kpi);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingKpi(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Показатели KPI</h1>
          <p className="text-slate-600">
            Ключевые показатели эффективности подразделений
          </p>
        </div>

        {(isAdmin || canCreate) && (
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setCategoriesOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
              >
                <FolderTree size={16} />
                Категории
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus size={16} />
                Создать KPI
              </button>
            )}
          </div>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по имени и описанию..."
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
      >
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={filterDirection === null}
            onClick={() => setFilterDirection(null)}
          >
            Все
          </FilterChip>
          <FilterChip
            active={filterDirection === "higher_better"}
            onClick={() => setFilterDirection("higher_better")}
          >
            ↑ Больше — лучше
          </FilterChip>
          <FilterChip
            active={filterDirection === "lower_better"}
            onClick={() => setFilterDirection("lower_better")}
          >
            ↓ Меньше — лучше
          </FilterChip>
        </div>
      </ListToolbar>

      {categories.length > 0 && (
        <CategoryFilterChips
          categories={categories}
          value={filterCategory}
          onChange={setFilterCategory}
          getCountForCategory={(catId) =>
            catId === null
              ? kpis.filter((k) => !k.category_id).length
              : kpis.filter((k) => k.category_id === catId).length
          }
          totalCount={kpis.length}
        />
      )}

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filteredKpis.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <p className="text-slate-600">
            {search || filterCategory || filterDirection
              ? "Ничего не найдено"
              : "Пока нет показателей"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredKpis.map((kpi) => (
          <div key={kpi.id} className="group relative">
            <KpiCard kpi={kpi} />

            {canEdit("kpi", kpi.category_id) && (
              <div className="absolute right-3 top-12 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleEdit(kpi)}
                  className="rounded-lg bg-white p-1.5 text-slate-500 shadow-sm hover:text-slate-900"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDelete(kpi)}
                  className="rounded-lg bg-white p-1.5 text-slate-500 shadow-sm hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <KpiEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editingKpi={editingKpi}
        categories={categories}
        onSaved={load}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Категории KPI"
        categories={categories}
        api={kpiCategoryApi}
        onChanged={load}
      />
    </div>
  );
}


function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}


function KpiEditorModal({ open, onClose, editingKpi, categories, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const isEdit = !!editingKpi;

  const [form, setForm] = useState({
    name: "",
    description: "",
    category_id: "",
    metric_id: "",
    formula: "",
    target_value: "",
    unit: "",
    direction: "higher_better",
    manual_value: "",
  });

  const [metrics, setMetrics] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [busy, setBusy] = useState(false);

  // -----------------------------------------------------------------
  // Создание метрики: каскад datasource → dataset → field → aggregation.
  // creator.datasource_id хранится как строка (значение <select>).
  // -----------------------------------------------------------------
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creator, setCreator] = useState({
    datasource_id: "",
    dataset_id: "",
    field_id: "",
    aggregation: "sum",
  });
  const [creatorFields, setCreatorFields] = useState([]);
  const [creatorBusy, setCreatorBusy] = useState(false);

  // -----------------------------------------------------------------
  // Inline-редактирование выбранной метрики:
  // позволяет переименовать или сменить агрегацию без открытия конструктора
  // виджетов. Удаление — для метрик, ни к какому виджету не привязанных.
  // -----------------------------------------------------------------
  const [editingMetric, setEditingMetric] = useState(false);
  const [metricEdit, setMetricEdit] = useState({ name: "", agg: "sum" });

  useEffect(() => {
    if (!open) return;
    Promise.all([listMetrics(), listDatasets()]).then(([mRes, dRes]) => {
      setMetrics(mRes.data);
      setDatasets(dRes.data);
    });

    if (editingKpi) {
      setForm({
        name: editingKpi.name || "",
        description: editingKpi.description || "",
        category_id: editingKpi.category_id || "",
        metric_id: editingKpi.metric_id || "",
        formula: editingKpi.formula || "",
        target_value: editingKpi.target_value ?? "",
        unit: editingKpi.unit || "",
        direction: editingKpi.direction || "higher_better",
        manual_value: editingKpi.manual_value ?? "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        category_id: "",
        metric_id: "",
        formula: "",
        target_value: "",
        unit: "",
        direction: "higher_better",
        manual_value: "",
      });
    }
    setCreatorOpen(false);
    setCreator({
      datasource_id: "",
      dataset_id: "",
      field_id: "",
      aggregation: "sum",
    });
    setCreatorFields([]);
    setEditingMetric(false);
  }, [open, editingKpi]);

  // Производный список источников: уникальные datasource_id из datasets.
  const creatorDatasources = useMemo(() => {
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

  const creatorDatasetsForCurrent = useMemo(() => {
    if (!creator.datasource_id) return [];
    const dsid = Number(creator.datasource_id);
    return datasets.filter((d) => d.datasource_id === dsid);
  }, [datasets, creator.datasource_id]);

  // Подгрузка полей датасета при выборе
  useEffect(() => {
    if (!creator.dataset_id) {
      setCreatorFields([]);
      return;
    }
    getDataset(creator.dataset_id).then(({ data }) => {
      setCreatorFields(data.fields || []);
    });
  }, [creator.dataset_id]);

  const change = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      metric_id: form.metric_id ? Number(form.metric_id) : null,
      formula: form.formula || null,
      target_value:
        form.target_value === "" ? null : Number(form.target_value),
      unit: form.unit || null,
      direction: form.direction,
      manual_value:
        form.manual_value === "" ? null : Number(form.manual_value),
    };

    try {
      if (isEdit) {
        await updateKpi(editingKpi.id, payload);
        toast.success("KPI обновлён");
      } else {
        await createKpi(payload);
        toast.success("KPI создан");
      }
      onClose();
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMetric = async () => {
    if (!creator.field_id) return;
    const field = creatorFields.find((f) => f.id === Number(creator.field_id));
    if (!field) return;

    const aggLabel = AGGREGATIONS.find((a) => a.value === creator.aggregation)?.label;
    const metricName = `${aggLabel} ${field.name}`;

    setCreatorBusy(true);
    try {
      const { data } = await createMetric({
        field_id: Number(creator.field_id),
        name: metricName,
        aggregation_type: creator.aggregation,
      });

      setMetrics((prev) =>
        prev.find((m) => m.id === data.id) ? prev : [...prev, data]
      );
      setForm((f) => ({ ...f, metric_id: data.id }));
      setCreatorOpen(false);
      toast.success("Метрика создана и выбрана");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка создания метрики");
    } finally {
      setCreatorBusy(false);
    }
  };

  // ---- Inline edit/delete выбранной метрики ----

  const selectedMetric = useMemo(
    () => metrics.find((m) => m.id === Number(form.metric_id)),
    [metrics, form.metric_id]
  );

  const startEditMetric = () => {
    if (!selectedMetric) return;
    setMetricEdit({
      name: selectedMetric.name,
      agg: selectedMetric.aggregation_type,
    });
    setEditingMetric(true);
  };

  const saveMetricEdit = async () => {
    if (!selectedMetric) return;
    const patch = {};
    if (metricEdit.name.trim() && metricEdit.name !== selectedMetric.name) {
      patch.name = metricEdit.name.trim();
    }
    if (metricEdit.agg !== selectedMetric.aggregation_type) {
      patch.aggregation_type = metricEdit.agg;
    }
    if (Object.keys(patch).length === 0) {
      setEditingMetric(false);
      return;
    }
    try {
      const { data } = await updateMetric(selectedMetric.id, patch);
      setMetrics((prev) =>
        prev.map((m) => (m.id === data.id ? data : m))
      );
      toast.success("Метрика обновлена");
      setEditingMetric(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const deleteSelectedMetric = async () => {
    if (!selectedMetric) return;
    const ok = await confirm({
      title: "Удалить метрику?",
      body: `«${selectedMetric.name}» будет удалена. Действие невозможно, если метрика используется в виджетах.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMetric(selectedMetric.id);
      setMetrics((prev) => prev.filter((m) => m.id !== selectedMetric.id));
      setForm((f) => ({ ...f, metric_id: "" }));
      toast.success("Метрика удалена");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  // Доступные агрегации для текущего поля в creator (по типу)
  const creatorField = creatorFields.find(
    (f) => f.id === Number(creator.field_id)
  );
  const isNumericField =
    creatorField && ["integer", "float"].includes(creatorField.data_type);
  const allowedAggs = AGGREGATIONS.filter(
    (a) => !a.numericOnly || isNumericField
  );

  // Агрегации для inline-редактирования выбранной метрики:
  // ориентируемся на dataset_field из самой метрики (через её field у нас
  // нет data_type в payload — поэтому добавляем все агрегации, бэкенд
  // отклонит несовместимые).
  const editAggOptions = AGGREGATIONS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Редактировать KPI" : "Новый KPI"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Название</Label>
          <Input value={form.name} onChange={change("name")} required />
        </div>

        <div className="col-span-2">
          <Label>Описание</Label>
          <textarea
            rows={2}
            value={form.description}
            onChange={change("description")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label>Категория</Label>
          <Select value={form.category_id} onChange={change("category_id")}>
            <option value="">— без категории —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Направление цели</Label>
          <Select value={form.direction} onChange={change("direction")}>
            <option value="higher_better">↑ Чем больше — тем лучше</option>
            <option value="lower_better">↓ Чем меньше — тем лучше</option>
          </Select>
        </div>

        <div className="col-span-2 space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">
              Источник фактического значения
            </p>
            {!creatorOpen && (
              <button
                type="button"
                onClick={() => setCreatorOpen(true)}
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                + Создать метрику
              </button>
            )}
          </div>

          <div>
            <Label>Метрика (для автоматического расчёта)</Label>

            {editingMetric && selectedMetric ? (
              // Inline-редактирование выбранной метрики
              <div className="space-y-2 rounded-md bg-slate-50 p-2">
                <input
                  type="text"
                  value={metricEdit.name}
                  onChange={(e) =>
                    setMetricEdit((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  placeholder="Имя метрики"
                />
                <select
                  value={metricEdit.agg}
                  onChange={(e) =>
                    setMetricEdit((s) => ({ ...s, agg: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                >
                  {editAggOptions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Поле: {selectedMetric.field_name}
                </p>
                <div className="flex justify-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingMetric(false)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Отмена"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={saveMetricEdit}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    title="Сохранить"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Select
                  value={form.metric_id}
                  onChange={change("metric_id")}
                >
                  <option value="">— ручной ввод значения —</option>
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.datasource_category_name && `${m.datasource_category_name}/`}
                      {m.datasource_name && `${m.datasource_name}/`}
                      {m.dataset_name && `${m.dataset_name}/`}
                      {m.name} ({m.field_name})
                    </option>
                  ))}
                </Select>

                {selectedMetric && (
                  <>
                    <button
                      type="button"
                      onClick={startEditMetric}
                      className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100"
                      title="Редактировать метрику"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedMetric}
                      className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50"
                      title="Удалить метрику"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!form.metric_id && !creatorOpen && !editingMetric && (
            <div>
              <Label>Текущее значение (вручную)</Label>
              <Input
                type="number"
                step="any"
                value={form.manual_value}
                onChange={change("manual_value")}
              />
            </div>
          )}

          {creatorOpen && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">
                Создание метрики
              </p>

              <div>
                <Label>Источник данных</Label>
                <Select
                  value={creator.datasource_id}
                  onChange={(e) =>
                    setCreator({
                      datasource_id: e.target.value,
                      dataset_id: "",
                      field_id: "",
                      aggregation: "sum",
                    })
                  }
                >
                  <option value="">— выберите —</option>
                  {creatorDatasources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.category_name ? `${ds.category_name}/` : ""}
                      {ds.name}
                    </option>
                  ))}
                </Select>
              </div>

              {creator.datasource_id && (
                <div>
                  <Label>Набор данных</Label>
                  <Select
                    value={creator.dataset_id}
                    onChange={(e) =>
                      setCreator((c) => ({
                        ...c,
                        dataset_id: e.target.value,
                        field_id: "",
                        aggregation: "sum",
                      }))
                    }
                  >
                    <option value="">— выберите —</option>
                    {creatorDatasetsForCurrent.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {creator.dataset_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Поле</Label>
                    <Select
                      value={creator.field_id}
                      onChange={(e) =>
                        setCreator((c) => ({
                          ...c,
                          field_id: e.target.value,
                          aggregation: "sum",
                        }))
                      }
                    >
                      <option value="">— выберите —</option>
                      {creatorFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} [{f.data_type}]
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label>Агрегация</Label>
                    <Select
                      value={creator.aggregation}
                      onChange={(e) =>
                        setCreator((c) => ({
                          ...c,
                          aggregation: e.target.value,
                        }))
                      }
                      disabled={!creator.field_id}
                    >
                      {allowedAggs.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreatorOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs hover:bg-slate-200"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateMetric}
                  disabled={creatorBusy || !creator.field_id}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatorBusy ? "..." : "Создать и выбрать"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>Целевое значение</Label>
          <Input
            type="number"
            step="any"
            value={form.target_value}
            onChange={change("target_value")}
          />
        </div>

        <div>
          <Label>Единица измерения</Label>
          <Input
            value={form.unit}
            onChange={change("unit")}
            placeholder="например: МВт·ч, шт, %"
          />
        </div>

        <div className="col-span-2">
          <Label>Формула (документация)</Label>
          <Input
            value={form.formula}
            onChange={change("formula")}
            placeholder="Например: «Сумма выработки за квартал»"
          />
        </div>

        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const Label = ({ children }) => (
  <label className="mb-1 block text-sm font-medium">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
  >
    {children}
  </select>
);
