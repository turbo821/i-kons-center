import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, X } from "lucide-react";


const ConfirmContext = createContext(null);


export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  /**
   * Показывает модалку и возвращает Promise<boolean>.
   * Пример:
   *   if (await confirm("Удалить виджет?")) { ... }
   *   if (await confirm({ title: "Удалить?", body: "Действие необратимо", danger: true })) { ... }
   */
  const confirm = useCallback((options) => {
    const normalized =
      typeof options === "string" ? { title: options } : options || {};

    setState({
      title: normalized.title || "Подтверждение",
      body: normalized.body || null,
      confirmText: normalized.confirmText || "Подтвердить",
      cancelText: normalized.cancelText || "Отмена",
      danger: normalized.danger ?? false,
    });

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmModal
          {...state}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}


export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }
  return ctx;
}


function ConfirmModal({
  title,
  body,
  confirmText,
  cancelText,
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 ${
                danger
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Тело */}
        {body && (
          <div className="px-6 py-4 text-sm text-slate-600">{body}</div>
        )}

        {/* Кнопки */}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
