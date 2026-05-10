import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";


const ToastContext = createContext(null);

let nextId = 1;


export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message, duration = 3000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, type, message }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove]
  );

  const value = {
    success: (msg, duration) => show("success", msg, duration),
    error: (msg, duration) => show("error", msg, duration ?? 5000),
    info: (msg, duration) => show("info", msg, duration),
    warning: (msg, duration) => show("warning", msg, duration),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}


export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}


const ICON_MAP = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLE_MAP = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const ICON_COLOR = {
  success: "text-emerald-600",
  error: "text-red-600",
  info: "text-blue-600",
  warning: "text-amber-600",
};


function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON_MAP[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start gap-3
              rounded-xl border px-4 py-3 shadow-md
              animate-[slideIn_0.2s_ease-out]
              ${STYLE_MAP[t.type]}
            `}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_COLOR[t.type]}`} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              onClick={() => onRemove(t.id)}
              className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {/* Анимация */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
