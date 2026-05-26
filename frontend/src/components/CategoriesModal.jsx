import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";

import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";


/**
 * Универсальная модалка управления категориями.
 * props:
 *   open         — открыта ли модалка
 *   onClose      — обработчик закрытия
 *   title        — заголовок модалки
 *   categories   — массив категорий
 *   api          — клиент с методами .create, .update, .remove
 *   onChanged    — обработчик после успешных операций
 */
export default function CategoriesModal({
  open,
  onClose,
  title = "Категории",
  categories,
  api,
  onChanged,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [busy, setBusy] = useState(false);

  // Состояние инлайн-редактирования
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName) return;
    setBusy(true);
    try {
      await api.create({ name: newName, description: newDesc });
      setNewName("");
      setNewDesc("");
      toast.success("Категория создана");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditDesc("");
  };

  const handleSaveEdit = async (cat) => {
    if (!editName.trim()) {
      toast.error("Имя не может быть пустым");
      return;
    }
    try {
      await api.update(cat.id, {
        name: editName.trim(),
        description: editDesc,
      });
      toast.success("Категория обновлена");
      cancelEdit();
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleDelete = async (cat) => {
    const ok = await confirm({
      title: "Удалить категорию?",
      body: `«${cat.name}» будет удалена. Привязанные элементы останутся без категории.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(cat.id);
      toast.success("Категория удалена");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-4">
        <form onSubmit={handleAdd} className="space-y-2">
          <input
            type="text"
            placeholder="Название категории"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Описание (опционально)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !newName}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Добавить
          </button>
        </form>

        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">Пока нет категорий</p>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-slate-200 p-3"
            >
              {editId === c.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Название"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Описание (опционально)"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleSaveEdit(c)}
                      className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <Check size={13} /> Сохранить
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100"
                    >
                      <X size={13} /> Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.description && (
                      <p className="text-xs text-slate-500">{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      title="Изменить"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
