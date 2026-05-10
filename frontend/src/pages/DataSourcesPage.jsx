import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  FileSpreadsheet,
  Plus,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

import {
  listDataSources,
  createSqlDataSource,
  uploadFileDataSource,
  deleteDataSource,
  testDataSource,
} from "../api/datasourceApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import ListToolbar, { applySort, matchesSearch } from "../components/ListToolbar";


const TYPE_ICON = {
  csv: FileSpreadsheet,
  postgres: Database,
  mysql: Database,
};

const TYPE_LABEL = {
  csv: "CSV / Excel",
  postgres: "PostgreSQL",
  mysql: "MySQL",
};

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


export default function DataSourcesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = user?.roles?.some((r) => ["admin", "expert"].includes(r));

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [typeFilter, setTypeFilter] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [testStatus, setTestStatus] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listDataSources();
      setItems(data);
    } catch (e) {
      toast.error("Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Применяем поиск, фильтр по типу и сортировку
  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter) result = result.filter((i) => i.type === typeFilter);
    result = result.filter((i) => matchesSearch(i, search, ["name", "type"]));
    return applySort(result, sort, SORT_MAP);
  }, [items, search, sort, typeFilter]);

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: "Удалить источник данных?",
      body: `«${item.name}» будет удалён. Действие необратимо.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDataSource(item.id);
      toast.success("Источник удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка удаления");
    }
  };

  const handleTest = async (id) => {
    setTestStatus((s) => ({ ...s, [id]: "loading" }));
    try {
      const { data } = await testDataSource(id);
      setTestStatus((s) => ({ ...s, [id]: data.ok ? "ok" : "fail" }));
      if (data.ok) {
        toast.success("Подключение работает");
      } else {
        toast.error(data.message || "Подключение недоступно");
      }
    } catch (e) {
      setTestStatus((s) => ({ ...s, [id]: "fail" }));
      toast.error("Ошибка проверки");
    }
  };

  // Типы, представленные в данных — для фильтр-чипов
  const availableTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.type));
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Источники данных</h1>
          <p className="text-slate-600">
            Подключения к файлам и базам данных для аналитики
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-3">
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              <Upload size={18} />
              Загрузить файл
            </button>
            <button
              onClick={() => setSqlOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus size={18} />
              Подключить БД
            </button>
          </div>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по имени..."
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
      >
        {availableTypes.length > 1 && (
          <div className="flex gap-1">
            <FilterChip
              active={typeFilter === null}
              onClick={() => setTypeFilter(null)}
            >
              Все ({items.length})
            </FilterChip>
            {availableTypes.map((t) => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              >
                {TYPE_LABEL[t]} ({items.filter((i) => i.type === t).length})
              </FilterChip>
            ))}
          </div>
        )}
      </ListToolbar>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <Database className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            {search || typeFilter
              ? "Ничего не найдено по фильтрам"
              : "Пока нет ни одного источника данных"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const Icon = TYPE_ICON[item.type] || Database;
            const status = testStatus[item.id];

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-xs text-slate-500">
                        {TYPE_LABEL[item.type] || item.type}
                      </p>
                    </div>
                  </div>

                  {status === "ok" && (
                    <CheckCircle2 size={18} className="text-green-600" />
                  )}
                  {status === "fail" && (
                    <XCircle size={18} className="text-red-600" />
                  )}
                </div>

                <p className="mb-4 text-xs text-slate-400">
                  Создан:{" "}
                  {new Date(item.created_at).toLocaleDateString("ru-RU")}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/datasources/${item.id}`}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
                  >
                    Подробнее
                  </Link>

                  <button
                    onClick={() => handleTest(item.id)}
                    disabled={status === "loading"}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
                  >
                    <RefreshCw
                      size={12}
                      className={status === "loading" ? "animate-spin" : ""}
                    />
                    Проверить
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => handleDelete(item)}
                      className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadFileModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={load}
      />

      <CreateSqlModal
        open={sqlOpen}
        onClose={() => setSqlOpen(false)}
        onCreated={load}
      />
    </div>
  );
}


function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}


function UploadFileModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setName("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    try {
      await uploadFileDataSource(file, name);
      toast.success("Файл загружен");
      reset();
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Загрузить файл">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Файл (CSV, XLS, XLSX)
          </label>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Название (опционально)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="По умолчанию — имя файла"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            {busy ? "Загрузка..." : "Загрузить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


function CreateSqlModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    type: "postgres",
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const change = (e) =>
    setForm((f) => ({
      ...f,
      [e.target.name]:
        e.target.name === "port" ? Number(e.target.value) : e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createSqlDataSource(form);
      toast.success("Источник подключён");
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Подключение к БД" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Название" name="name" value={form.name} onChange={change} required />

        <div>
          <label className="mb-1 block text-sm font-medium">Тип</label>
          <select
            name="type"
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value,
                port: e.target.value === "mysql" ? 3306 : 5432,
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>

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
            {busy ? "Подключение..." : "Подключить"}
          </button>
        </div>
      </form>
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
