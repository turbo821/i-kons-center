import { useState } from "react";
import {
  User as UserIcon,
  Lock,
  Mail,
  Calendar,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { changePassword } from "../api/userApi";
import PasswordInput from "../components/PasswordInput";


export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [pwdOpen, setPwdOpen] = useState(false);
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const change = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.new_password !== form.confirm) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }

    if (form.new_password.length < 6) {
      toast.error("Пароль должен содержать минимум 6 символов");
      return;
    }

    setBusy(true);
    try {
      await changePassword(form.current_password, form.new_password);
      toast.success("Пароль успешно изменён");
      setForm({ current_password: "", new_password: "", confirm: "" });
      setPwdOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <UserIcon size={36} />
        </div>
        <h1 className="text-2xl font-bold">{user.username}</h1>
        <p className="text-slate-500">{user.email}</p>
      </div>

      {/* Карточка данных */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Данные учётной записи</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={UserIcon} label="Имя" value={user.username} />
          <InfoRow
            icon={Calendar}
            label="Дата регистрации"
            value={
              user.created_at
                ? new Date(user.created_at).toLocaleDateString("ru-RU")
                : "—"
            }
          />
          <InfoRow
            icon={Shield}
            label="Роли"
            value={
              <div className="flex flex-wrap gap-1">
                {user.roles?.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            }
          />
        </div>
      </div>

      {/* Смена пароля — сворачиваемая */}
      <div className="rounded-2xl bg-white shadow-sm">
        <button
          onClick={() => setPwdOpen((o) => !o)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-slate-600" />
            <span className="font-semibold">Смена пароля</span>
          </div>
          {pwdOpen ? (
            <ChevronUp size={18} className="text-slate-500" />
          ) : (
            <ChevronDown size={18} className="text-slate-500" />
          )}
        </button>

        {pwdOpen && (
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-100 p-6 pt-4"
          >
            <div className="mx-auto max-w-sm space-y-3">
              <Field
                label="Текущий пароль"
                value={form.current_password}
                onChange={change("current_password")}
                required
              />
              <Field
                label="Новый пароль"
                value={form.new_password}
                onChange={change("new_password")}
                required
                minLength={6}
              />
              <Field
                label="Подтверждение"
                value={form.confirm}
                onChange={change("confirm")}
                required
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPwdOpen(false);
                    setForm({
                      current_password: "",
                      new_password: "",
                      confirm: "",
                    });
                  }}
                  className="flex-1 rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Сохранение..." : "Сменить пароль"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="break-words font-medium">{value}</div>
      </div>
    </div>
  );
}


function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <PasswordInput {...props} />
    </div>
  );
}
