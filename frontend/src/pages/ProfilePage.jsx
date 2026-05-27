import { useState } from "react";
import {
  User as UserIcon,
  Lock,
  Mail,
  Calendar,
  Shield,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { roleLabel, groupRoleLabel } from "../utils/roleLabels";
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
                    {roleLabel(r)}
                  </span>
                ))}
              </div>
            }
          />
        </div>
      </div>

      {/* Мои группы и роли */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Layers size={18} className="text-slate-600" />
          Мои группы и роли
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Доступ к данным определяется вашим участием в ролевых группах. В
          каждой группе вы либо эксперт (можете редактировать), либо зритель
          (только просмотр).
        </p>

        {(!user.groups || user.groups.length === 0) ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Вы пока не состоите ни в одной группе, поэтому разделы с данными
            недоступны. Чтобы получить доступ, попросите администратора
            добавить вас в нужную группу.
          </div>
        ) : (
          <div className="space-y-2">
            {user.groups.map((g) => (
              <GroupCard key={g.group_id} group={g} />
            ))}
          </div>
        )}
      </div>
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


// Метки типов сущностей для отображения категорий доступа.
const ENTITY_TYPE_LABELS = {
  datasource: "Источники данных",
  widget: "Виджеты",
  dashboard: "Дашборды",
  kpi: "Показатели KPI",
};
// Порядок отображения групп категорий
const ENTITY_TYPE_ORDER = ["datasource", "widget", "dashboard", "kpi"];


function GroupCard({ group }) {
  const [open, setOpen] = useState(false);

  const isExpert = group.group_role === "expert";
  const categories = group.categories || [];

  // Группируем категории по типу сущности
  const grouped = ENTITY_TYPE_ORDER.map((type) => ({
    type,
    label: ENTITY_TYPE_LABELS[type],
    items: categories
      .filter((c) => c.entity_type === type)
      .map((c) => c.category_name || "Без категории"),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{group.group_name}</span>
          <span className="text-xs text-slate-400">
            {categories.length > 0
              ? `${categories.length} ${pluralCategory(categories.length)}`
              : "доступ не настроен"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isExpert
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {groupRoleLabel(group.group_role)}
          </span>
          {open ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs text-slate-500">
            Группа открывает доступ к следующим категориям
            {isExpert
              ? " (с правом редактирования)"
              : " (только просмотр)"}
            :
          </p>
          {grouped.length === 0 ? (
            <p className="text-sm text-slate-400">
              Администратор пока не открыл этой группе ни одной категории.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.map((g) => (
                <div key={g.type}>
                  <p className="mb-1 text-xs font-semibold text-slate-600">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((name, idx) => (
                      <span
                        key={`${g.type}-${idx}-${name}`}
                        className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// Правильное склонение слова «категория» для русского числа
function pluralCategory(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "категория";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "категории";
  return "категорий";
}
