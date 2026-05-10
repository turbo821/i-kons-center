import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  ArrowLeft,
  Plus,
  X,
  Pencil,
  Save,
  Edit3,
} from "lucide-react";

import {
  getDashboard,
  updateDashboard,
  addWidgetToDashboard,
  removeWidgetFromDashboard,
  updateDashboardLayout,
} from "../api/dashboardApi";
import { listWidgets, getWidgetData } from "../api/widgetApi";

import { useAuth } from "../context/AuthContext";
import WidgetRenderer from "../components/WidgetRenderer";
import Modal from "../components/Modal";


const GRID_COLS = 12;
const ROW_HEIGHT = 60;


export default function DashboardDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);

  const [containerWidth, setContainerWidth] = useState(1200);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboard(id);
      setDashboard(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = document.getElementById("grid-container");
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dashboard]);

  const layout = useMemo(() => {
    if (!dashboard?.items) return [];
    return dashboard.items.map((item) => ({
      i: String(item.id),
      x: item.position_x,
      y: item.position_y,
      w: item.width,
      h: item.height,
      minW: 2,
      minH: 2,
    }));
  }, [dashboard]);

  const handleLayoutChange = async (newLayout) => {
    if (!editMode || !dashboard) return;

    const items = newLayout.map((l) => ({
      widget_id: Number(l.i),
      position_x: l.x,
      position_y: l.y,
      width: l.w,
      height: l.h,
    }));

    setDashboard((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        const lay = newLayout.find((l) => Number(l.i) === it.id);
        if (!lay) return it;
        return {
          ...it,
          position_x: lay.x,
          position_y: lay.y,
          width: lay.w,
          height: lay.h,
        };
      }),
    }));

    try {
      await updateDashboardLayout(id, items);
    } catch (e) {
      console.error("Не удалось сохранить layout:", e);
    }
  };

  const handleRemoveWidget = async (widgetId) => {
    if (!window.confirm("Убрать виджет с дашборда?")) return;
    try {
      await removeWidgetFromDashboard(id, widgetId);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    }
  };

  if (loading) return <p className="text-slate-500">Загрузка...</p>;
  if (!dashboard) return <p className="text-red-600">Дашборд не найден</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboards"
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
          </Link>

          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {dashboard.name}
              {canEdit && (
                <button
                  onClick={() => setEditMetaOpen(true)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
              )}
            </h1>
            {dashboard.description && (
              <p className="text-sm text-slate-600">
                {dashboard.description}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              <Plus size={16} />
              Добавить виджет
            </button>
            <button
              onClick={() => setEditMode((m) => !m)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                editMode
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              {editMode ? <Save size={16} /> : <Edit3 size={16} />}
              {editMode ? "Готово" : "Редактировать"}
            </button>
          </div>
        )}
      </div>

      {editMode && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Режим редактирования: перетаскивайте виджеты за заголовок и меняйте
          их размер. Изменения сохраняются автоматически.
        </div>
      )}

      <div id="grid-container" className="rounded-2xl bg-white p-3 shadow-sm">
        {dashboard.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500">На дашборде пока нет виджетов</p>
            {canEdit && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                + Добавить первый виджет
              </button>
            )}
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={GRID_COLS}
            rowHeight={ROW_HEIGHT}
            width={containerWidth - 24}
            isDraggable={editMode}
            isResizable={editMode}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            // Не начинать drag, если клик пришёл на элемент с этими классами/тегами
            draggableCancel=".no-drag,button,a,input,textarea,select"
            margin={[12, 12]}
          >
            {dashboard.items.map((item) => (
              <div key={String(item.id)}>
                <WidgetTile
                  item={item}
                  editMode={editMode}
                  canEdit={canEdit}
                  onRemove={() => handleRemoveWidget(item.id)}
                />
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      <AddWidgetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        dashboardId={id}
        existingWidgetIds={dashboard.items.map((i) => i.id)}
        onAdded={load}
      />

      <EditMetaModal
        open={editMetaOpen}
        onClose={() => setEditMetaOpen(false)}
        dashboard={dashboard}
        onUpdated={load}
      />
    </div>
  );
}


// ----- Плитка с виджетом -----
function WidgetTile({ item, editMode, canEdit, onRemove }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWidgetData(item.id)
      .then(({ data }) => active && setData(data))
      .catch((e) => active && setError(e?.response?.data?.message || "Ошибка"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [item.id]);

  // Останавливаем mousedown на интерактивных элементах,
  // иначе react-grid-layout перехватывает его как начало drag.
  const stopDrag = (e) => e.stopPropagation();

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3">
      <div
        className={`mb-2 flex items-center justify-between ${
          editMode ? "widget-drag-handle cursor-move" : ""
        }`}
      >
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <Link
            to={`/widgets/${item.id}/edit`}
            onMouseDown={stopDrag}
            onClick={(e) => e.stopPropagation()}
            className="no-drag rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={12} />
          </Link>
        </div>

        {editMode && canEdit && (
          <button
            onMouseDown={stopDrag}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="no-drag rounded p-1 text-red-600 hover:bg-red-50"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <WidgetRenderer
          type={item.type}
          data={data}
          isLoading={loading}
          error={error}
        />
      </div>
    </div>
  );
}


// ----- Модалка добавления виджета -----
function AddWidgetModal({ open, onClose, dashboardId, existingWidgetIds, onAdded }) {
  const [allWidgets, setAllWidgets] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    listWidgets().then(({ data }) => setAllWidgets(data));
  }, [open]);

  const available = allWidgets.filter(
    (w) => !existingWidgetIds.includes(w.id)
  );

  const handleAdd = async (widgetId) => {
    setBusy(true);
    try {
      await addWidgetToDashboard(dashboardId, {
        widget_id: widgetId,
        position_x: 0,
        position_y: 100,
        width: 6,
        height: 4,
      });
      onClose();
      onAdded();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить виджет"
      maxWidth="max-w-2xl"
    >
      {available.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Нет доступных виджетов.
          <br />
          {existingWidgetIds.length > 0
            ? "Все виджеты уже добавлены на этот дашборд."
            : "Сначала создайте виджеты."}
          <br />
          <Link
            to="/widgets/new"
            className="mt-2 inline-block font-medium text-blue-600"
          >
            → Создать новый виджет
          </Link>
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-auto">
          {available.map((w) => (
            <button
              key={w.id}
              onClick={() => handleAdd(w.id)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
            >
              <div>
                <p className="font-medium">{w.title}</p>
                <p className="text-xs text-slate-500">
                  {w.type} · {w.dataset_name}
                </p>
              </div>
              <Plus size={18} className="text-blue-600" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}


// ----- Модалка редактирования имени/описания -----
function EditMetaModal({ open, onClose, dashboard, onUpdated }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !dashboard) return;
    setName(dashboard.name);
    setDesc(dashboard.description || "");
  }, [open, dashboard]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateDashboard(dashboard.id, {
        name,
        description: desc,
      });
      onClose();
      onUpdated();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Редактировать дашборд">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Описание</label>
          <textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
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
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
