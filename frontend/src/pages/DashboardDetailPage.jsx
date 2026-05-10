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
  Target,
} from "lucide-react";

import {
  getDashboard,
  updateDashboard,
  addWidgetToDashboard,
  removeWidgetFromDashboard,
  updateDashboardLayout,
} from "../api/dashboardApi";
import { listWidgets, getWidgetData } from "../api/widgetApi";
import {
  listKpis,
  addKpiToDashboard,
  removeKpiFromDashboard,
} from "../api/kpiApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import WidgetRenderer from "../components/WidgetRenderer";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";


const GRID_COLS = 12;
const ROW_HEIGHT = 60;
const KEY_WIDGET = "w";
const KEY_KPI = "k";


export default function DashboardDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = user?.roles?.some((r) => ["admin", "expert"].includes(r));

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [addKpiOpen, setAddKpiOpen] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);

  const [containerWidth, setContainerWidth] = useState(1200);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboard(id);
      setDashboard(data);
    } catch (e) {
      toast.error("Не удалось загрузить дашборд");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const items = dashboard?.items || [];

  const layout = useMemo(() => {
    return items.map((item) => ({
      i: `${item.kind === "kpi" ? KEY_KPI : KEY_WIDGET}_${item.ref_id}`,
      x: item.position_x,
      y: item.position_y,
      w: item.width,
      h: item.height,
      minW: 2,
      minH: 2,
    }));
  }, [items]);

  const handleLayoutChange = async (newLayout) => {
    if (!editMode || !dashboard) return;

    const payload = newLayout.map((l) => {
      const [prefix, refIdStr] = l.i.split("_");
      return {
        kind: prefix === KEY_KPI ? "kpi" : "widget",
        ref_id: Number(refIdStr),
        position_x: l.x,
        position_y: l.y,
        width: l.w,
        height: l.h,
      };
    });

    setDashboard((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        const lay = payload.find(
          (p) => p.kind === it.kind && p.ref_id === it.ref_id
        );
        if (!lay) return it;
        return {
          ...it,
          position_x: lay.position_x,
          position_y: lay.position_y,
          width: lay.width,
          height: lay.height,
        };
      }),
    }));

    try {
      await updateDashboardLayout(id, payload);
    } catch (e) {
      toast.error("Не удалось сохранить расположение");
    }
  };

  const handleRemoveWidget = async (widgetId, title) => {
    const ok = await confirm({
      title: "Убрать виджет?",
      body: `«${title}» будет убран с этого дашборда (сам виджет останется в системе).`,
      confirmText: "Убрать",
      danger: false,
    });
    if (!ok) return;
    try {
      await removeWidgetFromDashboard(id, widgetId);
      toast.success("Виджет убран");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRemoveKpi = async (kpiId, name) => {
    const ok = await confirm({
      title: "Убрать KPI?",
      body: `«${name}» будет убран с этого дашборда (сам KPI останется в системе).`,
      confirmText: "Убрать",
      danger: false,
    });
    if (!ok) return;
    try {
      await removeKpiFromDashboard(id, kpiId);
      toast.success("KPI убран");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  if (loading) return <p className="text-slate-500">Загрузка...</p>;
  if (!dashboard) return <p className="text-red-600">Дашборд не найден</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboards" className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>

          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {dashboard.name}
              {canEdit && editMode && (
                <button
                  onClick={() => setEditMetaOpen(true)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={14} />
                </button>
              )}
            </h1>
            {dashboard.description && (
              <p className="text-sm text-slate-600">{dashboard.description}</p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {editMode && (
              <>
                <button
                  onClick={() => setAddKpiOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
                >
                  <Target size={16} />
                  Добавить KPI
                </button>
                <button
                  onClick={() => setAddWidgetOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
                >
                  <Plus size={16} />
                  Добавить виджет
                </button>
              </>
            )}
            <button
              onClick={() => setEditMode((m) => !m)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                editMode
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {editMode ? <Save size={16} /> : <Edit3 size={16} />}
              {editMode ? "Готово" : "Редактировать"}
            </button>
          </div>
        )}
      </div>

      {editMode && (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Режим редактирования: перетаскивайте элементы за заголовок,
          меняйте размер. Изменения сохраняются автоматически.
        </div>
      )}

      <div id="grid-container" className="rounded-2xl bg-white p-3 shadow-sm">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500">На дашборде пока нет элементов</p>
            {canEdit && !editMode && (
              <p className="mt-3 text-sm text-slate-500">
                Нажмите «Редактировать», чтобы добавить виджеты и KPI
              </p>
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
            draggableCancel=".no-drag,button,a,input,textarea,select"
            margin={[12, 12]}
          >
            {items.map((item) => {
              const key = `${
                item.kind === "kpi" ? KEY_KPI : KEY_WIDGET
              }_${item.ref_id}`;

              return (
                <div key={key}>
                  {item.kind === "widget" ? (
                    <WidgetTile
                      item={item}
                      editMode={editMode}
                      canEdit={canEdit}
                      onRemove={() =>
                        handleRemoveWidget(item.ref_id, item.title)
                      }
                    />
                  ) : (
                    <KpiTile
                      item={item}
                      editMode={editMode}
                      canEdit={canEdit}
                      onRemove={() => handleRemoveKpi(item.ref_id, item.name)}
                    />
                  )}
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>

      <AddWidgetModal
        open={addWidgetOpen}
        onClose={() => setAddWidgetOpen(false)}
        dashboardId={id}
        existingWidgetIds={items.filter((i) => i.kind === "widget").map((i) => i.ref_id)}
        onAdded={load}
      />

      <AddKpiModal
        open={addKpiOpen}
        onClose={() => setAddKpiOpen(false)}
        dashboardId={id}
        existingKpiIds={items.filter((i) => i.kind === "kpi").map((i) => i.ref_id)}
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


function WidgetTile({ item, editMode, canEdit, onRemove }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWidgetData(item.ref_id)
      .then(({ data }) => active && setData(data))
      .catch((e) => active && setError(e?.response?.data?.message || "Ошибка"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [item.ref_id]);

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
          {editMode && (
            <Link
              to={`/widgets/${item.ref_id}/edit`}
              onMouseDown={stopDrag}
              onClick={(e) => e.stopPropagation()}
              className="no-drag rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil size={12} />
            </Link>
          )}
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


function KpiTile({ item, editMode, canEdit, onRemove }) {
  const kpi = { ...item, id: item.ref_id };

  return (
    <div className="relative h-full w-full">
      {editMode && (
        <div className="widget-drag-handle absolute inset-x-0 top-0 z-10 h-8 cursor-move" />
      )}

      <KpiCard kpi={kpi} compact />

      {editMode && canEdit && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="no-drag absolute right-2 top-2 z-20 rounded-lg bg-white p-1 text-red-600 shadow-sm hover:bg-red-50"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}


function AddWidgetModal({ open, onClose, dashboardId, existingWidgetIds, onAdded }) {
  const toast = useToast();
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
      toast.success("Виджет добавлен");
      onClose();
      onAdded();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить виджет" maxWidth="max-w-2xl">
      {available.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Нет доступных виджетов.
          <br />
          {existingWidgetIds.length > 0
            ? "Все виджеты уже добавлены на этот дашборд."
            : "Сначала создайте виджеты."}
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-auto">
          {available.map((w) => (
            <button
              key={w.id}
              onClick={() => handleAdd(w.id)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
            >
              <div>
                <p className="font-medium">{w.title}</p>
                <p className="text-xs text-slate-500">
                  {w.type} · {w.dataset_name}
                </p>
              </div>
              <Plus size={18} className="text-slate-700" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}


function AddKpiModal({ open, onClose, dashboardId, existingKpiIds, onAdded }) {
  const toast = useToast();
  const [kpis, setKpis] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    listKpis().then(({ data }) => setKpis(data));
  }, [open]);

  const available = kpis.filter((k) => !existingKpiIds.includes(k.id));

  const handleAdd = async (kpiId) => {
    setBusy(true);
    try {
      await addKpiToDashboard(dashboardId, kpiId);
      toast.success("KPI добавлен");
      onClose();
      onAdded();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить KPI" maxWidth="max-w-2xl">
      {available.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {existingKpiIds.length > 0
            ? "Все KPI уже добавлены на этот дашборд."
            : "Сначала создайте KPI на странице «Показатели KPI»."}
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-auto">
          {available.map((k) => (
            <button
              key={k.id}
              onClick={() => handleAdd(k.id)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
            >
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-slate-500">
                  {k.category_name || "без категории"}
                  {k.target_value !== null
                    ? ` · цель ${k.target_value}${k.unit ? " " + k.unit : ""}`
                    : ""}
                </p>
              </div>
              <Plus size={18} className="text-slate-700" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}


function EditMetaModal({ open, onClose, dashboard, onUpdated }) {
  const toast = useToast();
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
      await updateDashboard(dashboard.id, { name, description: desc });
      toast.success("Дашборд обновлён");
      onClose();
      onUpdated();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
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
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
