import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Filter as FilterIcon, FolderTree } from "lucide-react";

import {
  listKpis,
  createKpi,
  updateKpi,
  deleteKpi,
} from "../api/kpiApi";
import {
  listCategories,
  createCategory,
  deleteCategory,
} from "../api/categoryApi";
import { listMetrics } from "../api/metricApi";

import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import KpiCard from "../components/KpiCard";


export default function KpiPage() {
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [kpis, setKpis] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [kpiRes, catRes] = await Promise.all([
        listKpis(),
        listCategories(),
      ]);
      setKpis(kpiRes.data);
      setCategories(catRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredKpis = useMemo(() => {
    if (!filterCategory) return kpis;
    return kpis.filter((k) => k.category_id === filterCategory);
  }, [kpis, filterCategory]);

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить KPI?")) return;
    try {
      await deleteKpi(id);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
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

        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setCategoriesOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              <FolderTree size={16} />
              Категории
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={16} />
              Создать KPI
            </button>
          </div>
        )}
      </div>

      {/* Фильтр по категориям */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon size={14} className="text-slate-500" />
          <button
            onClick={() => setFilterCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filterCategory === null
                ? "bg-blue-600 text-white"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            Все ({kpis.length})
          </button>
          {categories.map((c) => {
            const count = kpis.filter((k) => k.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filterCategory === c.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filteredKpis.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <p className="text-slate-600">
            {filterCategory ? "В этой категории нет KPI" : "Пока нет показателей"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredKpis.map((kpi) => (
          <div key={kpi.id} className="relative">
            <KpiCard kpi={kpi} />

            {canEdit && (
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={() => handleEdit(kpi)}
                  className="rounded-lg bg-white p-1.5 text-slate-500 shadow-sm hover:text-blue-600"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDelete(kpi.id)}
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
        categories={categories}
        onChanged={load}
      />
    </div>
  );
}


// =====================================================================
// Редактор KPI
// =====================================================================
function KpiEditorModal({ open, onClose, editingKpi, categories, onSaved }) {
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Подгружаем метрики и заполняем форму
  useEffect(() => {
    if (!open) return;

    listMetrics().then(({ data }) => setMetrics(data));

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
    setErr(null);
  }, [open, editingKpi]);

  const change = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

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
      } else {
        await createKpi(payload);
      }
      onClose();
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

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

        <div className="col-span-2 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-medium text-slate-700">
            Источник фактического значения
          </p>

          <Label>Метрика (для автоматического расчёта)</Label>
          <Select value={form.metric_id} onChange={change("metric_id")}>
            <option value="">— ручной ввод значения —</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.field_name})
              </option>
            ))}
          </Select>

          {!form.metric_id && (
            <div className="mt-2">
              <Label>Текущее значение (вручную)</Label>
              <Input
                type="number"
                step="any"
                value={form.manual_value}
                onChange={change("manual_value")}
              />
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

        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}

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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// =====================================================================
// Управление категориями
// =====================================================================
function CategoriesModal({ open, onClose, categories, onChanged }) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName) return;
    setBusy(true);
    try {
      await createCategory({ name: newName, description: newDesc });
      setNewName("");
      setNewDesc("");
      onChanged();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить категорию?")) return;
    try {
      await deleteCategory(id);
      onChanged();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Категории KPI"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <form onSubmit={handleAdd} className="space-y-2">
          <Input
            placeholder="Название категории"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            placeholder="Описание (опционально)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !newName}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Добавить
          </button>
        </form>

        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">Пока нет категорий</p>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                {c.description && (
                  <p className="text-xs text-slate-500">{c.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}


// ----- мелкие хелперы -----
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
