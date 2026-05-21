import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Table2,
  Trash2,
  RefreshCw,
  Eye,
  Pencil,
  Upload,
  Link2,
  Info,
} from "lucide-react";

import {
  getDataSource,
  listDataSourceTables,
  updateDataSource,
  replaceDataSourceFile,
  updateDataSourceConnection,
  updateDataSourceLinkPath,
} from "../api/datasourceApi";
import {
  listDatasets,
  createDataset,
  deleteDataset,
  refreshDatasetFields,
  previewDataset,
  updateDataset,
} from "../api/datasetApi";
import { datasourceCategoryApi } from "../api/categoryApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import ListToolbar, {
  applySort,
  matchesSearch,
} from "../components/ListToolbar";


const SORT_OPTIONS = [
  { value: "name_asc", label: "По имени А→Я" },
  { value: "name_desc", label: "По имени Я→А" },
];

const SORT_MAP = {
  name_asc: { field: "name", direction: "asc" },
  name_desc: { field: "name", direction: "desc" },
};


export default function DataSourceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [datasource, setDatasource] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editDsMetaOpen, setEditDsMetaOpen] = useState(false);
  const [editDatasetOpen, setEditDatasetOpen] = useState(null);
  const [replaceFileOpen, setReplaceFileOpen] = useState(false);
  const [updatePathOpen, setUpdatePathOpen] = useState(false);
  const [updateConnOpen, setUpdateConnOpen] = useState(false);
  const [previewState, setPreviewState] = useState(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name_asc");

  const load = async () => {
    setLoading(true);
    try {
      const [dsRes, dsetsRes, catsRes] = await Promise.all([
        getDataSource(id),
        listDatasets(id),
        datasourceCategoryApi.list(),
      ]);
      setDatasource(dsRes.data);
      setDatasets(dsetsRes.data);
      setCategories(catsRes.data);
    } catch (e) {
      toast.error("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredDatasets = useMemo(() => {
    const result = datasets.filter((d) =>
      matchesSearch(d, search, ["name", "sql_query"])
    );
    return applySort(result, sort, SORT_MAP);
  }, [datasets, search, sort]);

  const handleDeleteDataset = async (dataset) => {
    const ok = await confirm({
      title: "Удалить набор данных?",
      body: `«${dataset.name}» будет удалён вместе со всеми связанными метриками, измерениями и виджетами.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDataset(dataset.id);
      toast.success("Набор данных удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRefresh = async (datasetId) => {
    try {
      await refreshDatasetFields(datasetId);
      toast.success("Структура полей обновлена");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handlePreview = async (datasetId, name) => {
    try {
      const { data } = await previewDataset(datasetId, 50);
      setPreviewState({ ...data, name });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка предпросмотра");
    }
  };

  if (loading) return <p className="text-slate-500">Загрузка...</p>;
  if (!datasource) return <p className="text-red-600">Не найдено</p>;

  const isFileSource = ["csv", "csv_link"].includes(datasource.type);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/datasources"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />К списку источников
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {datasource.name}
              {canEdit && (
                <button
                  onClick={() => setEditDsMetaOpen(true)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
              )}
            </h1>
            <p className="text-slate-600">
              Тип: <span className="font-medium">{datasource.type}</span>
              {datasource.category_name && (
                <>
                  {" · Категория: "}
                  <span className="font-medium">{datasource.category_name}</span>
                </>
              )}
            </p>
          </div>

          {canEdit && (
            <div className="flex gap-2">
              {datasource.type === "csv" && (
                <button
                  onClick={() => setReplaceFileOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
                >
                  <Upload size={16} />
                  Заменить файл
                </button>
              )}
              {datasource.type === "csv_link" && (
                <button
                  onClick={() => setUpdatePathOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
                >
                  <Link2 size={16} />
                  Изменить путь
                </button>
              )}
              {(datasource.type === "postgres" || datasource.type === "mysql") && (
                <button
                  onClick={() => setUpdateConnOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
                >
                  <Link2 size={16} />
                  Изменить соединение
                </button>
              )}
            {!isFileSource && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus size={18} />
                Создать набор данных
              </button>
            )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Наборы данных ({datasets.length})
          </h2>
        </div>

        {datasets.length > 0 && (
          <div className="mb-4">
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Поиск по имени и запросу..."
              sortValue={sort}
              onSortChange={setSort}
              sortOptions={SORT_OPTIONS}
            />
          </div>
        )}

        {datasets.length === 0 ? (
          <p className="text-sm text-slate-500">
            Пока нет наборов данных. Создайте первый, чтобы использовать
            этот источник в виджетах.
          </p>
        ) : filteredDatasets.length === 0 ? (
          <p className="text-sm text-slate-500">Ничего не найдено по поиску</p>
        ) : (
          <div className="space-y-3">
            {filteredDatasets.map((ds) => (
              <DatasetRow
                isFileSource={isFileSource}
                key={ds.id}
                ds={ds}
                canEdit={canEdit}
                onPreview={() => handlePreview(ds.id, ds.name)}
                onRefresh={() => handleRefresh(ds.id)}
                onDelete={() => handleDeleteDataset(ds)}
                onEdit={() => setEditDatasetOpen(ds)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateDatasetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        datasource={datasource}
        onCreated={load}
      />

      <EditDatasourceMetaModal
        open={editDsMetaOpen}
        onClose={() => setEditDsMetaOpen(false)}
        datasource={datasource}
        categories={categories}
        onUpdated={load}
      />

      {editDatasetOpen && (
        <EditDatasetModal
          dataset={editDatasetOpen}
          datasource={datasource}
          onClose={() => setEditDatasetOpen(null)}
          onUpdated={load}
        />
      )}

      <ReplaceFileModal
        open={replaceFileOpen}
        onClose={() => setReplaceFileOpen(false)}
        datasourceId={datasource.id}
        onReplaced={load}
      />

      <UpdateConnectionModal
        open={updateConnOpen}
        onClose={() => setUpdateConnOpen(false)}
        datasource={datasource}
        onUpdated={load}
      />

      <UpdateLinkPathModal
        open={updatePathOpen}
        onClose={() => setUpdatePathOpen(false)}
        datasource={datasource}
        onUpdated={load}
      />

      <PreviewModal
        state={previewState}
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
}


function DatasetRow({ isFileSource, ds, canEdit, onPreview, onRefresh, onDelete, onEdit }) {
  const [showSql, setShowSql] = useState(false);
  // Можно ли редактировать датасет? Если есть зависимые виджеты — нельзя
  const isLocked = (ds.widgets_count || 0) > 0 || (ds.metrics_count || 0) > 0;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <Table2 className="mt-0.5 shrink-0 text-slate-700" size={20} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{ds.name}</p>
            {ds.sql_query && (
              <button
                type="button"
                onMouseEnter={() => setShowSql(true)}
                onMouseLeave={() => setShowSql(false)}
                className="relative rounded p-0.5 text-slate-400 hover:text-slate-700"
                aria-label="Показать SQL-запрос"
              >
                <Info size={14} />
                {showSql && (
                  <div className="absolute bottom-full left-0 z-10 mb-1 w-96 rounded-lg border border-slate-200 bg-slate-900 p-3 text-left text-xs text-white shadow-lg">
                    <p className="mb-1 font-semibold text-slate-300">
                      SQL-запрос:
                    </p>
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                      {ds.sql_query}
                    </pre>
                  </div>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Полей: {ds.fields?.length || 0}
            {ds.widgets_count > 0 && ` · виджетов: ${ds.widgets_count}`}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onPreview}
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
        >
          <Eye size={12} />
          Предпросмотр
        </button>

        {canEdit && (
          <>
            <button
              onClick={onRefresh}
              title="Обновить структуру полей (после изменения источника)"
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
            >
              <RefreshCw size={12} />
              Обновить структуру
            </button>
            <button
              onClick={onEdit}
              disabled={isLocked}
              title={
                isLocked
                  ? "Нельзя редактировать: к датасету привязаны виджеты или метрики"
                  : "Редактировать"
              }
              className="rounded-lg bg-slate-100 p-1.5 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil size={12} />
            </button>
          {!isFileSource && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          )}
          </>
        )}
      </div>
    </div>
  );
}


// ----- Создание датасета -----
function CreateDatasetModal({ open, onClose, datasource, onCreated }) {
  const toast = useToast();
  const isFileSource = ["csv", "csv_link"].includes(datasource.type);

  const [form, setForm] = useState({ name: "", table_name: "", query: "" });
  const [tables, setTables] = useState([]);
  const [mode, setMode] = useState("table");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: "", table_name: "", query: "" });

    if (!isFileSource) {
      listDataSourceTables(datasource.id)
        .then(({ data }) => setTables(data))
        .catch(() => setTables([]));
    }
  }, [open, datasource.id, isFileSource]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const payload = {
      datasource_id: datasource.id,
      name: form.name,
    };

    if (!isFileSource) {
      if (mode === "table") payload.table_name = form.table_name;
      else payload.query = form.query;
    }

    try {
      await createDataset(payload);
      toast.success("Набор данных создан");
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка создания");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новый набор данных" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Название</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        {isFileSource ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            Для файлового источника поля будут определены автоматически
            из всего содержимого файла.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("table")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "table"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Выбрать таблицу
              </button>
              <button
                type="button"
                onClick={() => setMode("query")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "query"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                SQL-запрос
              </button>
            </div>

            {mode === "table" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Таблица</label>
                <select
                  value={form.table_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, table_name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">— выберите —</option>
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">SQL-запрос</label>
                <textarea
                  rows={6}
                  value={form.query}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, query: e.target.value }))
                  }
                  placeholder="SELECT * FROM ..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  required
                />
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
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
            {busy ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ----- Редактирование метаданных источника -----
function EditDatasourceMetaModal({ open, onClose, datasource, categories, onUpdated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", category_id: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !datasource) return;
    setForm({
      name: datasource.name,
      category_id: datasource.category_id || "",
    });
  }, [open, datasource]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateDataSource(datasource.id, {
        name: form.name,
        category_id: form.category_id ? Number(form.category_id) : null,
      });
      toast.success("Источник обновлён");
      onClose();
      onUpdated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Редактирование источника">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Название</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Категория</label>
          <select
            value={form.category_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, category_id: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— без категории —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
            {busy ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ----- Редактирование датасета -----
function EditDatasetModal({ dataset, datasource, onClose, onUpdated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: dataset.name, query: dataset.sql_query || "" });
  const [busy, setBusy] = useState(false);
  const isFileSource = ["csv", "csv_link"].includes(datasource.type);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: form.name };
      if (!isFileSource) payload.query = form.query;
      await updateDataset(dataset.id, payload);
      toast.success("Набор данных обновлён");
      onClose();
      onUpdated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Редактирование набора данных" maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Название</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        {!isFileSource && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              SQL-запрос или имя таблицы
            </label>
            <textarea
              rows={6}
              value={form.query}
              onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Изменение запроса повлечёт обновление структуры полей датасета.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
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
            {busy ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ----- Замена файла -----
function ReplaceFileModal({ open, onClose, datasourceId, onReplaced }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    try {
      await replaceDataSourceFile(datasourceId, file);
      toast.success("Файл заменён");
      setFile(null);
      onClose();
      onReplaced();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка замены файла");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Замена файла">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Внимание</p>
          <p className="mt-1">
            Новый файл должен содержать все столбцы существующих наборов данных.
            Иначе замена будет отклонена.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Новый файл (CSV, XLS, XLSX)
          </label>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy || !file}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Замена..." : "Заменить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateLinkPathModal({ open, onClose, datasource, onUpdated }) {
  const toast = useToast();
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);

  // При открытии заполняем поле текущим путём — чтобы пользователь видел,
  // что именно меняет.
  useEffect(() => {
    if (open && datasource) setPath(datasource.connection_string || "");
  }, [open, datasource]);

  const submit = async (e) => {
    e.preventDefault();
    if (!path.trim()) return;
    setBusy(true);
    try {
      await updateDataSourceLinkPath(datasource.id, path.trim());
      toast.success("Путь обновлён");
      onClose();
      onUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Изменить путь к файлу">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Абсолютный путь к файлу
          </label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:/data/sales.csv или /opt/data/sales.xlsx"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Если в новом файле отсутствуют столбцы, нужные существующим
            наборам данных, обновление будет отклонено.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy || !path.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----- Обновление SQL-соединения -----
function UpdateConnectionModal({ open, onClose, datasource, onUpdated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      host: "",
      port: datasource.type === "mysql" ? 3306 : 5432,
      database: "",
      user: "",
      password: "",
    });
  }, [open, datasource.type]);

  const change = (e) =>
    setForm((f) => ({
      ...f,
      [e.target.name]:
        e.target.name === "port" ? Number(e.target.value) : e.target.value,
    }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateDataSourceConnection(datasource.id, form);
      toast.success("Соединение обновлено");
      onClose();
      onUpdated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка обновления");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Обновление соединения" maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Внимание</p>
          <p className="mt-1">
            Введите новые параметры подключения. Система проверит,
            что таблицы существующих датасетов доступны в новом подключении.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Хост" name="host" value={form.host} onChange={change} required />
          <Field label="Порт" name="port" type="number" value={form.port} onChange={change} required />
          <Field label="База данных" name="database" value={form.database} onChange={change} required />
          <Field label="Пользователь" name="user" value={form.user} onChange={change} required />
          <div className="col-span-2">
            <Field
              label="Пароль"
              name="password"
              type="password"
              value={form.password}
              onChange={change}
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
            {busy ? "Проверка..." : "Обновить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ----- Предпросмотр -----
function formatCellValue(val) {
  if (val === null || val === undefined) {
    return "—";
  }
  // Проверка на дату
  const date = new Date(val);
  if (!isNaN(date.getTime()) && typeof val === "string") {
    return date.toLocaleDateString("ru-RU");
  }
  return String(val);
}

function PreviewModal({ state, onClose }) {
  if (!state) return null;

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={`Предпросмотр: ${state.name}`}
      maxWidth="max-w-6xl"
    >
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              {state.columns.map((c) => (
                <th key={c} className="border-b px-3 py-2 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {state.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {row.map((val, j) => (
                  <td
                    key={j}
                    className="border-b px-3 py-2 text-slate-700"
                  >
                    {formatCellValue(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Показано строк: {state.rows.length}
      </p>
    </Modal>
  );
}


function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
