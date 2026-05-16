/**
 * Универсальный фильтр-чипы для категорий.
 * props:
 *   categories         — массив {id, name}
 *   value              — выбранный category_id или null
 *   onChange           — (newValue) => void
 *   getCountForCategory — функция (categoryId | null) → число
 *                        (передаём null для «Без категории»)
 *   totalCount         — общее количество элементов (для «Все»)
 */
export default function CategoryFilterChips({
  categories,
  value,
  onChange,
  getCountForCategory,
  totalCount,
}) {
  const renderChip = (label, count, isActive, onClick) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        isActive
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label} ({count})
    </button>
  );

  // Количество элементов без категории
  const noCatCount = getCountForCategory(null);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs font-medium text-slate-500">
        Категория:
      </span>

      {renderChip(
        "Все",
        totalCount,
        value === undefined,
        () => onChange(undefined)
      )}

      {categories.map((c) => {
        const count = getCountForCategory(c.id);
        if (count === 0) return null;
        return renderChip(
          c.name,
          count,
          value === c.id,
          () => onChange(c.id)
        );
      })}

      {noCatCount > 0 &&
        renderChip(
          "Без категории",
          noCatCount,
          value === null,
          () => onChange(null)
        )}
    </div>
  );
}
