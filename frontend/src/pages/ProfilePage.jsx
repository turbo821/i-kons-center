import { useState } from "react";
import { User as UserIcon, Lock, Mail, Calendar, Shield } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { changePassword } from "../api/userApi";


export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);

  if (!user) return null;

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
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Профиль</h1>

      {/* Карточка с данными */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <UserIcon size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.username}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={UserIcon} label="Имя пользователя" value={user.username} />
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
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            }
          />
        </div>
      </div>

      {/* Смена пароля */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={18} className="text-slate-600" />
          <h2 className="font-semibold">Смена пароля</h2>
        </div>

        <form onSubmit={handleSubmit} className="max-w-md space-y-3">
          <Field
            label="Текущий пароль"
            type="password"
            value={form.current_password}
            onChange={(e) =>
              setForm((f) => ({ ...f, current_password: e.target.value }))
            }
            required
          />
          <Field
            label="Новый пароль"
            type="password"
            value={form.new_password}
            onChange={(e) =>
              setForm((f) => ({ ...f, new_password: e.target.value }))
            }
            required
            minLength={6}
          />
          <Field
            label="Подтверждение"
            type="password"
            value={form.confirm}
            onChange={(e) =>
              setForm((f) => ({ ...f, confirm: e.target.value }))
            }
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : "Сменить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}


function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
      <Icon size={16} className="mt-0.5 text-slate-500" />
      <div className="flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}


function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
