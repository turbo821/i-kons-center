import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Table2,
  Trash2,
  RefreshCw,
  Eye,
} from "lucide-react";

import { getDataSource, listDataSourceTables } from "../api/datasourceApi";
import {
  listDatasets,
  createDataset,
  deleteDataset,
  refreshDatasetFields,
  previewDataset,
} from "../api/datasetApi";

import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";


export default function DataSourceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [datasource, setDatasource] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewState, setPreviewState] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dsRes, dsetsRes] = await Promise.all([
        getDataSource(id),
        listDatasets(id),
      ]);
      setDatasource(dsRes.data);
      setDatasets(dsetsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async (datasetId) => {
    if (!window.confirm("Удалить набор данных?")) return;
    try {
      await deleteDataset(datasetId);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRefresh = async (datasetId) => {
    try {
      await refreshDatasetFields(datasetId);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    }
  };

  const handlePreview = async (datasetId, name) => {
    try {
      const { data } = await previewDataset(datasetId, 50);
      setPreviewState({ ...data, name });
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка предпросмотра");
    }
  };

  if (loading) return <p className="text-slate-500">Загрузка...</p>;
  if (!datasource) return <p className="text-red-600">Не найдено</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/datasources"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={16} />К списку источников
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{datasource.name}</h1>
            <p className="text-slate-600">
              Тип: <span className="font-medium">{datasource.type}</span>
            </p>
          </div>

          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={18} />
              Создать набор данных
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Наборы данных ({datasets.length})
        </h2>

        {datasets.length === 0 ? (
          <p className="text-sm text-slate-500">
            Пока нет наборов данных. Создайте первый, чтобы использовать
            этот источник в виджетах.
          </p>
        ) : (
          <div className="space-y-3">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <Table2 className="text-blue-600" size={20} />
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    {ds.query && (
                      <p className="mt-0.5 max-w-xl truncate font-mono text-xs text-slate-500">
                        {ds.query}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(ds.id, ds.name)}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
                  >
                    <Eye size={12} />
                    Предпросмотр
                  </button>

                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleRefresh(ds.id)}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
                      >
                        <RefreshCw size={12} />
                        Обновить поля
                      </button>
                      <button
                        onClick={() => handleDelete(ds.id)}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
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

      <PreviewModal
        state={previewState}
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
}


// --------------- модалка создания датасета ---------------
function CreateDatasetModal({ open, onClose, datasource, onCreated }) {
  const isCsv = datasource.type === "csv";

  const [form, setForm] = useState({ name: "", table_name: "", query: "" });
  const [tables, setTables] = useState([]);
  const [mode, setMode] = useState("table"); // 'table' | 'query'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({ name: "", table_name: "", query: "" });
    setErr(null);

    if (!isCsv) {
      listDataSourceTables(datasource.id)
        .then(({ data }) => setTables(data))
        .catch(() => setTables([]));
    }
  }, [open, datasource.id, isCsv]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const payload = {
      datasource_id: datasource.id,
      name: form.name,
    };

    if (!isCsv) {
      if (mode === "table") payload.table_name = form.table_name;
      else payload.query = form.query;
    }

    try {
      await createDataset(payload);
      onClose();
      onCreated();
    } catch (e) {
      setErr(e?.response?.data?.message || "Ошибка создания");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый набор данных"
      maxWidth="max-w-2xl"
    >
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

        {isCsv ? (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
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
                    ? "bg-blue-600 text-white"
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
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                SQL-запрос
              </button>
            </div>

            {mode === "table" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Таблица
                </label>
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
                <label className="mb-1 block text-sm font-medium">
                  SQL-запрос
                </label>
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

        {err && <p className="text-sm text-red-600">{err}</p>}

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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// --------------- модалка предпросмотра ---------------
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
                  <td key={j} className="border-b px-3 py-2 text-slate-700">
                    {val === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      String(val)
                    )}
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
