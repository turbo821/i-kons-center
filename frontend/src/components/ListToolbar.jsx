import { Search, ArrowUpDown } from "lucide-react";


/**
 * Универсальная панель для списков: поиск + сортировка + слот фильтров.
 *
 * props:
 *   search                — текущая строка поиска
 *   onSearchChange(v)     — обработчик ввода
 *   searchPlaceholder     — placeholder для поля поиска
 *   sortValue             — текущий ключ сортировки
 *   sortOptions           — массив {value, label}
 *   onSortChange(v)
 *   children              — слот для дополнительных фильтров (чипы и т.п.)
 */
export default function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Поиск...",
  sortValue,
  sortOptions = [],
  onSortChange,
  children,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Поиск */}
      <div className="relative min-w-[200px] flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>

      {/* Сортировка */}
      {sortOptions.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <ArrowUpDown size={14} className="text-slate-400" />
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="border-none bg-transparent text-sm focus:outline-none"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Слот для дополнительных фильтров */}
      {children}
    </div>
  );
}


/**
 * Утилита для сортировки массива по строковому ключу 'field' или '-field' (desc).
 */
export function applySort(items, sortKey, sortMap) {
  if (!sortKey || !sortMap[sortKey]) return items;

  const { field, direction = "asc" } = sortMap[sortKey];
  const sign = direction === "desc" ? -1 : 1;

  return [...items].sort((a, b) => {
    const av = a[field];
    const bv = b[field];

    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === "number" && typeof bv === "number") {
      return sign * (av - bv);
    }
    return sign * String(av).localeCompare(String(bv), "ru");
  });
}


/**
 * Фильтр по строке поиска: возвращает true, если хотя бы одно из переданных
 * полей содержит подстроку search.
 */
export function matchesSearch(item, search, fields) {
  if (!search) return true;
  const q = search.toLowerCase();
  return fields.some((f) => {
    const v = item[f];
    return v != null && String(v).toLowerCase().includes(q);
  });
}
