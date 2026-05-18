import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutDashboard, Trash2, FolderTree, Pin } from "lucide-react";

import {
  listDashboards,
  createDashboard,
  deleteDashboard,
  pinDashboard,
} from "../api/dashboardApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import ListToolbar, { applySort, matchesSearch } from "../components/ListToolbar";

import { dashboardCategoryApi } from "../api/categoryApi";
import CategoriesModal from "../components/CategoriesModal";
import CategoryFilterChips from "../components/CategoryFilterChips";

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


export default function DashboardsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = user?.roles?.some((r) => ["admin", "expert"].includes(r));

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");

  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState(undefined);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  
  const load = async () => {
    setLoading(true);

    try {
      const [itemsRes, catsRes] = await Promise.all([
        listDashboards(),
        dashboardCategoryApi.list(),
      ]);

      setItems(itemsRes.data);
      setCategories(catsRes.data);
    } catch (e) {
      toast.error("Не удалось загрузить дашборды");
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
    result = result.filter((i) =>
      matchesSearch(i, search, ["name", "description"])
    );
    const sorted = applySort(result, sort, SORT_MAP);

    // Закреплённые — всегда наверх, поверх любой сортировки.
    // Используем stable-sort: только переносим pinned в начало, относительный
    // порядок внутри групп сохраняется.
    const pinned = sorted.filter((i) => i.is_pinned);
    const unpinned = sorted.filter((i) => !i.is_pinned);
    return [...pinned, ...unpinned];
    // Task 1: добавил filterCategory в зависимости — иначе фильтр по категории
    // не пересчитывался корректно при выборе категории.
  }, [items, search, sort, filterCategory]);

  const handleDelete = async (dashboard) => {
    const ok = await confirm({
      title: "Удалить дашборд?",
      body: `«${dashboard.name}» будет удалён со всеми размещениями.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDashboard(dashboard.id);
      toast.success("Дашборд удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  // Task 6: тоггл pin/unpin прямо со списка дашбордов
  const handleTogglePin = async (dashboard, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await pinDashboard(dashboard.id, !dashboard.is_pinned);
      // Локально обновляем — без полного reload
      setItems((prev) =>
        prev.map((it) =>
          it.id === dashboard.id ? { ...it, is_pinned: !it.is_pinned } : it
        )
      );
      toast.success(dashboard.is_pinned ? "Откреплён" : "Закреплён");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дашборды</h1>
          <p className="text-slate-600">Аналитические панели</p>
        </div>

        {canEdit && (
          <div className="flex gap-3">
            <button
              onClick={() => setCategoriesOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              <FolderTree size={16} />
              Категории
            </button>

            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus size={18} />
              Создать дашборд
            </button>
          </div>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию и описанию..."
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
      />

      {categories.length > 0 && (
        <CategoryFilterChips
          categories={categories}
          value={filterCategory}
          onChange={setFilterCategory}
          getCountForCategory={(catId) =>
            catId === null
              ? items.filter((i) => !i.category_id).length
              : items.filter((i) => i.category_id === catId).length
          }
          totalCount={items.length}
        />
      )}

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <LayoutDashboard className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            {search ? "Ничего не найдено" : "Пока нет дашбордов"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`relative rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md ${
                item.is_pinned ? "ring-1 ring-amber-300" : ""
              }`}
            >
              {/* Task 6: индикатор закрепления + кнопка переключения */}
              {canEdit && (
                <button
                  onClick={(e) => handleTogglePin(item, e)}
                  title={item.is_pinned ? "Открепить" : "Закрепить на главной"}
                  className={`absolute right-3 top-3 rounded-lg p-1.5 ${
                    item.is_pinned
                      ? "text-amber-600 hover:bg-amber-50"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  }`}
                >
                  {item.is_pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                </button>
              )}

              <Link to={`/dashboards/${item.id}`} className="block">
                <div className="mb-3 flex items-start gap-3 pr-7">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <LayoutDashboard size={22} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    {item.description && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {item.description}
                      </p>
                    )}
                  {item.category_name && (
                    <p className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {item.category_name}
                    </p>
                  )}
                  </div>
                </div>
              </Link>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {new Date(item.created_at).toLocaleDateString("ru-RU")}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateDashboardModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        categories={categories}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Категории дашбордов"
        categories={categories}
        api={dashboardCategoryApi}
        onChanged={load}
      />
    </div>
  );
}


function CreateDashboardModal({
  open,
  onClose,
  onCreated,
  categories,
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category_id: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createDashboard({
        ...form,
        category_id: form.category_id
          ? Number(form.category_id)
          : null,
      });
      toast.success("Дашборд создан");
      setForm({
        name: "",
        description: "",
        category_id: "",
      });
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новый дашборд">
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
          <label className="mb-1 block text-sm font-medium">
            Описание (опционально)
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Категория
          </label>

          <select
            value={form.category_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category_id: e.target.value,
              }))
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
            {busy ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
