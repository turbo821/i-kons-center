import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Type as TypeIcon,
  Pin,
  Download,
} from "lucide-react";

import {
  getDashboard,
  updateDashboard,
  addWidgetToDashboard,
  removeWidgetFromDashboard,
  updateDashboardLayout,
  pinDashboard,
  addTextToDashboard,
  updateDashboardText,
  removeTextFromDashboard,
} from "../api/dashboardApi";
import { listWidgets, getWidgetData } from "../api/widgetApi";
import {
  listKpis,
  addKpiToDashboard,
  removeKpiFromDashboard,
} from "../api/kpiApi";
import { dashboardCategoryApi } from "../api/categoryApi";

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
const KEY_TEXT = "t";


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
  const [exportingPdf, setExportingPdf] = useState(false);

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
    return items.map((item) => {
      let prefix = KEY_WIDGET;
      if (item.kind === "kpi") prefix = KEY_KPI;
      else if (item.kind === "text") prefix = KEY_TEXT;
      return {
        i: `${prefix}_${item.ref_id}`,
        x: item.position_x,
        y: item.position_y,
        w: item.width,
        h: item.height,
        minW: 2,
        minH: 2,
      };
    });
  }, [items]);

  const handleLayoutChange = async (newLayout) => {
    if (!editMode || !dashboard) return;

    const payload = newLayout.map((l) => {
      const [prefix, refIdStr] = l.i.split("_");
      let kind = "widget";
      if (prefix === KEY_KPI) kind = "kpi";
      else if (prefix === KEY_TEXT) kind = "text";
      return {
        kind,
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

  // Task 5: добавление и удаление текстовых блоков
  const handleAddText = async () => {
    try {
      await addTextToDashboard(id, {
        content: "Новый текст",
        position_x: 0,
        position_y: 1000, // в самый низ
        width: 4,
        height: 2,
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRemoveText = async (textId) => {
    const ok = await confirm({
      title: "Удалить текст?",
      body: "Текстовый блок будет удалён с дашборда.",
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeTextFromDashboard(id, textId);
      toast.success("Текст удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  // Task 5: сохраняем содержимое текста локально + на сервере (без перезагрузки)
  const handleUpdateTextContent = async (textId, content) => {
    setDashboard((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.kind === "text" && it.ref_id === textId
          ? { ...it, content }
          : it
      ),
    }));
    try {
      await updateDashboardText(id, textId, { content });
    } catch (e) {
      toast.error("Не удалось сохранить текст");
    }
  };

  // Task 6: тоггл закрепления
  const handleTogglePin = async () => {
    try {
      const { data } = await pinDashboard(id, !dashboard.is_pinned);
      setDashboard((prev) => ({ ...prev, is_pinned: data.is_pinned }));
      toast.success(data.is_pinned ? "Закреплён на главной" : "Откреплён");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  // Task 2: Экспорт дашборда в PDF через html2canvas + jsPDF.
  // Динамический import — чтобы тяжёлые либы не попадали в основной бандл.
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const node = document.getElementById("grid-container");
      if (!node) {
        toast.error("Не удалось найти область для экспорта");
        return;
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Делаем снимок DOM с белым фоном и x2 разрешением — текст не «мылится»
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");

      // Используем альбомную A4 и вписываем картинку с сохранением пропорций
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;

      // Вписать с сохранением пропорций
      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const renderW = canvas.width * ratio;
      const renderH = canvas.height * ratio;
      const offsetX = margin + (availW - renderW) / 2;
      const offsetY = margin + (availH - renderH) / 2;

      pdf.addImage(imgData, "PNG", offsetX, offsetY, renderW, renderH);

      const safeName = (dashboard?.name || "dashboard")
        .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\- ]/g, "")
        .trim() || "dashboard";
      pdf.save(`${safeName}.pdf`);
      toast.success("PDF сохранён");
    } catch (e) {
      console.error(e);
      toast.error("Не удалось создать PDF");
    } finally {
      setExportingPdf(false);
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
              {dashboard.is_pinned && (
                <Pin
                  size={18}
                  className="text-amber-600"
                  fill="currentColor"
                  aria-label="Закреплено"
                />
              )}
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
            {dashboard.category_name && (
              <p className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {dashboard.category_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Task 6: pin/unpin доступно всегда (даже без edit mode) для удобства */}
          {canEdit && (
            <button
              onClick={handleTogglePin}
              title={dashboard.is_pinned ? "Открепить" : "Закрепить на главной"}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                dashboard.is_pinned
                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Pin
                size={16}
                fill={dashboard.is_pinned ? "currentColor" : "none"}
              />
              {dashboard.is_pinned ? "Закреплено" : "Закрепить"}
            </button>
          )}

          {/* Task 2: экспорт в PDF — доступен всем, кто видит дашборд */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
          >
            <Download size={16} />
            {exportingPdf ? "Экспорт..." : "PDF"}
          </button>

          {canEdit && (
            <>
              {editMode && (
                <>
                  <button
                    onClick={() => setAddKpiOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                  >
                    <Target size={16} />
                    KPI
                  </button>
                  <button
                    onClick={() => setAddWidgetOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                  >
                    <Plus size={16} />
                    Виджет
                  </button>
                  <button
                    onClick={handleAddText}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                  >
                    <TypeIcon size={16} />
                    Текст
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
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Режим редактирования: перетаскивайте элементы за заголовок,
          меняйте размер. Изменения сохраняются автоматически.
          Кликните по тексту, чтобы изменить его содержимое.
        </div>
      )}

      <div id="grid-container" className="rounded-2xl bg-white p-3 shadow-sm">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500">На дашборде пока нет элементов</p>
            {canEdit && !editMode && (
              <p className="mt-3 text-sm text-slate-500">
                Нажмите «Редактировать», чтобы добавить виджеты, KPI и текст
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
              let prefix = KEY_WIDGET;
              if (item.kind === "kpi") prefix = KEY_KPI;
              else if (item.kind === "text") prefix = KEY_TEXT;
              const key = `${prefix}_${item.ref_id}`;

              return (
                <div key={key}>
                  {item.kind === "widget" && (
                    <WidgetTile
                      item={item}
                      editMode={editMode}
                      canEdit={canEdit}
                      onRemove={() =>
                        handleRemoveWidget(item.ref_id, item.title)
                      }
                    />
                  )}
                  {item.kind === "kpi" && (
                    <KpiTile
                      item={item}
                      editMode={editMode}
                      canEdit={canEdit}
                      onRemove={() => handleRemoveKpi(item.ref_id, item.name)}
                    />
                  )}
                  {item.kind === "text" && (
                    <TextTile
                      item={item}
                      editMode={editMode}
                      canEdit={canEdit}
                      onChange={(content) =>
                        handleUpdateTextContent(item.ref_id, content)
                      }
                      onRemove={() => handleRemoveText(item.ref_id)}
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


// Task 5: текстовый блок с редактированием по клику в режиме edit.
// Сохранение — на blur и через debounce при печати (чтобы каждое нажатие
// клавиши не уходило на сервер).
function TextTile({ item, editMode, canEdit, onChange, onRemove }) {
  const [value, setValue] = useState(item.content || "");
  const debounceRef = useRef(null);

  // Если контент пришёл с сервера и не совпадает с локальным — синхронизируем
  useEffect(() => {
    setValue(item.content || "");
  }, [item.content]);

  const scheduleSave = (newValue) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 600);
  };

  const handleInput = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    scheduleSave(newValue);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (value !== item.content) {
      onChange(value);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col rounded-xl border border-slate-200 bg-amber-50/40 p-3">
      {editMode && (
        <div className="widget-drag-handle absolute inset-x-0 top-0 z-10 h-6 cursor-move" />
      )}

      {editMode && canEdit ? (
        <textarea
          value={value}
          onChange={handleInput}
          onBlur={handleBlur}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Введите текст..."
          className="no-drag mt-5 h-full w-full resize-none rounded-md border border-amber-200 bg-white/70 p-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      ) : (
        <div className="h-full w-full overflow-auto whitespace-pre-wrap break-words p-1 text-sm text-slate-800">
          {value || <span className="text-slate-400">Текст не задан</span>}
        </div>
      )}

      {editMode && canEdit && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="no-drag absolute right-1.5 top-1.5 z-20 rounded-lg bg-white p-1 text-red-600 shadow-sm hover:bg-red-50"
          title="Удалить текстовый блок"
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
                  {w.type} · {w.datasource_category_name && `${w.datasource_category_name}/`}
                  {w.datasource_name && `${w.datasource_name}/`}{w.dataset_name}
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


// Task 1: добавили выбор категории в форму редактирования метаданных дашборда.
function EditMetaModal({ open, onClose, dashboard, onUpdated }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !dashboard) return;
    setName(dashboard.name);
    setDesc(dashboard.description || "");
    setCategoryId(dashboard.category_id ? String(dashboard.category_id) : "");
    // Грузим список категорий каждый раз при открытии — на случай если их
    // только что добавили в админке.
    dashboardCategoryApi.list()
      .then(({ data }) => setCategories(data))
      .catch(() => {});
  }, [open, dashboard]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateDashboard(dashboard.id, {
        name,
        description: desc,
        category_id: categoryId ? Number(categoryId) : null,
      });
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
