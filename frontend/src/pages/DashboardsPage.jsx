import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutDashboard, Trash2 } from "lucide-react";

import {
  listDashboards,
  createDashboard,
  deleteDashboard,
} from "../api/dashboardApi";

import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";


export default function DashboardsPage() {
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) =>
    ["admin", "expert"].includes(r)
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listDashboards();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить дашборд?")) return;
    try {
      await deleteDashboard(id);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Ошибка");
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
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus size={18} />
            Создать дашборд
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <LayoutDashboard className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">Пока нет дашбордов</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <Link to={`/dashboards/${item.id}`} className="block">
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                    <LayoutDashboard size={22} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    {item.description && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {item.description}
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
                    onClick={() => handleDelete(item.id)}
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
      />
    </div>
  );
}


function CreateDashboardModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createDashboard(form);
      setForm({ name: "", description: "" });
      onClose();
      onCreated();
    } catch (e) {
      setErr(e?.response?.data?.message || "Ошибка");
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

        {err && <p className="text-sm text-red-600">{err}</p>}

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
            {busy ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
