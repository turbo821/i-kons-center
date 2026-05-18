import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Table as TableIcon,
  Hash,
  FolderTree
} from "lucide-react";

import { listWidgets, getWidgetData } from "../api/widgetApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import WidgetRenderer from "../components/WidgetRenderer";
import ListToolbar, { applySort, matchesSearch } from "../components/ListToolbar";

import { widgetCategoryApi } from "../api/categoryApi";
import CategoriesModal from "../components/CategoriesModal";
import CategoryFilterChips from "../components/CategoryFilterChips";

const TYPE_ICON = {
  bar: BarChart3,
  line: LineIcon,
  pie: PieIcon,
  table: TableIcon,
  kpi_card: Hash,
};

const TYPE_LABEL = {
  bar: "Столбцы",
  line: "Линия",
  pie: "Круг",
  table: "Таблица",
  kpi_card: "KPI",
};

const SORT_OPTIONS = [
  { value: "id_desc", label: "Сначала новые" },
  { value: "id_asc", label: "Сначала старые" },
  { value: "title_asc", label: "По имени А→Я" },
  { value: "title_desc", label: "По имени Я→А" },
];

const SORT_MAP = {
  id_desc: { field: "id", direction: "desc" },
  id_asc: { field: "id", direction: "asc" },
  title_asc: { field: "title", direction: "asc" },
  title_desc: { field: "title", direction: "desc" },
};


export default function WidgetsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("id_desc");
  const [typeFilter, setTypeFilter] = useState(null);

  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState(undefined); // undefined = все
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Task 1: грузим и виджеты, и категории сразу — иначе чипсы категорий
  // не появляются до первого ручного обновления.
  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        listWidgets(),
        widgetCategoryApi.list(),
      ]);
      setWidgets(itemsRes.data);
      setCategories(catsRes.data);
    } catch {
      toast.error("Не удалось загрузить виджеты");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let result = widgets;
    if (filterCategory !== undefined) {
      result = result.filter((i) => i.category_id === filterCategory);
    }
    if (typeFilter) result = result.filter((w) => w.type === typeFilter);
    result = result.filter((w) =>
      matchesSearch(w, search, ["title", "dataset_name"])
    );
    return applySort(result, sort, SORT_MAP);
  }, [widgets, filterCategory, search, sort, typeFilter]);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(widgets.map((w) => w.type)));
  }, [widgets]);

  const getCountForCategory = (catId) => {
    if (catId === null) return widgets.filter((i) => !i.category_id).length;
    return widgets.filter((i) => i.category_id === catId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Виджеты</h1>
          <p className="text-slate-600">
            Конструктор аналитических элементов
          </p>
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
            <Link
              to="/widgets/new"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus size={18} />
              Создать виджет
            </Link>
          </div>

        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию и датасету..."
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
              Все ({widgets.length})
            </FilterChip>
            {availableTypes.map((t) => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              >
                {TYPE_LABEL[t]} ({widgets.filter((w) => w.type === t).length})
              </FilterChip>
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
          totalCount={widgets.length}
        />
      )}

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <BarChart3 className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            {search || typeFilter
              ? "Ничего не найдено"
              : "Пока нет виджетов"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <WidgetCard key={w.id} widget={w} />
          ))}
        </div>
      )}

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Категории виджетов"
        categories={categories}
        api={widgetCategoryApi}
        onChanged={load}
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


function WidgetCard({ widget }) {
  const Icon = TYPE_ICON[widget.type] || BarChart3;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWidgetData(widget.id)
      .then(({ data }) => {
        if (active) setData(data);
      })
      .catch((e) => {
        if (active) setError(e?.response?.data?.message || "Ошибка");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [widget.id]);

  return (
    <Link
      to={`/widgets/${widget.id}/edit`}
      className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-700">
            <Icon size={16} />
          </div>
          <div>
            <p className="font-semibold leading-tight">{widget.title}</p>
            <p className="text-xs text-slate-500">
              {TYPE_LABEL[widget.type]} · {widget.dataset_name}
            </p>
            {widget.category_name && (
              <p className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {widget.category_name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="h-48 rounded-lg bg-slate-50 p-2">
        <WidgetRenderer
          type={widget.type}
          data={data}
          isLoading={loading}
          error={error}
        />
      </div>
    </Link>
  );
}
