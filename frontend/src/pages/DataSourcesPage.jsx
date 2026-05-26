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
  FolderTree,
  Link2,
} from "lucide-react";

import {
  listDataSources,
  createSqlDataSource,
  uploadFileDataSource,
  createCsvLinkDataSource,
  deleteDataSource,
  testDataSource,
} from "../api/datasourceApi";
import { datasourceCategoryApi } from "../api/categoryApi";

import { useAuth } from "../context/AuthContext";
import { useAccess } from "../context/AccessContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import CategoriesModal from "../components/CategoriesModal";
import CategoryFilterChips from "../components/CategoryFilterChips";
import ListToolbar, {
  applySort,
  matchesSearch,
} from "../components/ListToolbar";


const TYPE_ICON = {
  csv: FileSpreadsheet,
  csv_link: Link2,
  postgres: Database,
  mysql: Database,
};

const TYPE_LABEL = {
  csv: "CSV / Excel (загружен)",
  csv_link: "CSV / Excel (по ссылке)",
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
  const { canEdit, canCreateAny, isAdmin } = useAccess();
  const toast = useToast();
  const confirm = useConfirm();
  const canCreate = canCreateAny("datasource");

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");
  // undefined = «Все», null = «Без категории», int = конкретная категория
  const [filterCategory, setFilterCategory] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [testStatus, setTestStatus] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        listDataSources(),
        datasourceCategoryApi.list(),
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
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

  const filtered = useMemo(() => {
    let result = items;

    if (filterCategory !== undefined) {
      result = result.filter((i) => i.category_id === filterCategory);
    }

    if (typeFilter) {
      result = result.filter((i) => i.type === typeFilter);
    }

    result = result.filter((i) =>
      matchesSearch(i, search, ["name", "type", "category_name"])
    );

    return applySort(result, sort, SORT_MAP);
  }, [items, search, sort, filterCategory, typeFilter]);

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
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleTest = async (id) => {
    setTestStatus((s) => ({ ...s, [id]: "loading" }));
    try {
      const { data } = await testDataSource(id);
      setTestStatus((s) => ({ ...s, [id]: data.ok ? "ok" : "fail" }));
      if (data.ok) toast.success("Подключение работает");
      else toast.error(data.message || "Подключение недоступно");
    } catch (e) {
      setTestStatus((s) => ({ ...s, [id]: "fail" }));
      toast.error("Ошибка проверки");
    }
  };

  const availableTypes = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type)));
  }, [items]);

  const getCountForCategory = (catId) => {
    if (catId === null) return items.filter((i) => !i.category_id).length;
    return items.filter((i) => i.category_id === catId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Источники данных</h1>
          <p className="text-slate-600">
            Подключения к файлам и базам данных для аналитики
          </p>
        </div>

        {(isAdmin || canCreate) && (
          <div className="flex gap-3">
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
              <>
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
              </>
            )}
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
            <button
              onClick={() => setTypeFilter(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                typeFilter === null
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Все типы ({items.length})
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  typeFilter === t
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {TYPE_LABEL[t]} ({items.filter((i) => i.type === t).length})
              </button>
            ))}
          </div>
        )}
      </ListToolbar>

      {categories.length > 0 && (
        <CategoryFilterChips
          categories={categories}
          value={filterCategory}
          onChange={setFilterCategory}
          getCountForCategory={getCountForCategory}
          totalCount={items.length}
        />
      )}

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <Database className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            {search || filterCategory !== undefined || typeFilter
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
                      {item.category_name && (
                        <p className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {item.category_name}
                        </p>
                      )}
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

                  {canEdit("datasource", item.category_id) && (
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
        categories={categories}
        onCreated={load}
      />

      <CreateSqlModal
        open={sqlOpen}
        onClose={() => setSqlOpen(false)}
        categories={categories}
        onCreated={load}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Категории источников данных"
        categories={categories}
        api={datasourceCategoryApi}
        onChanged={load}
      />
    </div>
  );
}


function UploadFileModal({ open, onClose, categories, onCreated }) {
  const toast = useToast();
  // Режим: 'upload' — загрузить файл (старый поведение); 'link' — путь к файлу
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("upload");
    setFile(null);
    setPath("");
    setName("");
    setCategoryId("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "upload") {
        if (!file) return;
        await uploadFileDataSource(
          file,
          name,
          categoryId ? Number(categoryId) : undefined
        );
        toast.success("Файл загружен");
      } else {
        if (!path.trim() || !name.trim()) return;
        await createCsvLinkDataSource({
          name: name.trim(),
          path: path.trim(),
          category_id: categoryId ? Number(categoryId) : null,
        });
        toast.success("Источник создан (по ссылке)");
      }
      reset();
      onClose();
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить CSV/Excel-источник">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Переключатель режима */}
        <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "upload"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Загрузить файл
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "link"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Указать путь
          </button>
        </div>

        {mode === "upload" ? (
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
            <p className="mt-1 text-xs text-slate-500">
              Файл будет скопирован на сервер. Изменения в исходном файле
              не повлияют на источник.
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Путь к файлу на сервере
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
              Абсолютный путь к существующему файлу. Файл не копируется —
              изменения в нём будут автоматически видны в системе.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">
            Название {mode === "upload" && "(опционально)"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              mode === "upload"
                ? "По умолчанию — имя файла"
                : "Название источника"
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required={mode === "link"}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Категория</label>
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
            disabled={
              busy ||
              (mode === "upload" && !file) ||
              (mode === "link" && (!path.trim() || !name.trim()))
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "..." : mode === "upload" ? "Загрузить" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


function CreateSqlModal({ open, onClose, categories, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    type: "postgres",
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: "",
    category_id: "",
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
      const payload = {
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
      };
      await createSqlDataSource(payload);
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

        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Категория</label>
          <select
            name="category_id"
            value={form.category_id}
            onChange={change}
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
