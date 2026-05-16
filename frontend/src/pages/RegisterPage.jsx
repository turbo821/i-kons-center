import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus } from "lucide-react";

import api from "../services/api";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";


export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  const change = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register", form);
      toast.success("Регистрация успешна. Теперь войдите в систему");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-md"
      >
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <UserPlus size={22} />
          </div>
          <h2 className="text-2xl font-semibold">Регистрация</h2>
          <p className="mt-1 text-sm text-slate-500">
            Создайте учётную запись для доступа к системе
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Имя пользователя
          </label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={change}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={change}
            placeholder="user@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Пароль</label>
          <PasswordInput
            name="password"
            value={form.password}
            onChange={change}
            placeholder="Минимум 6 символов"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        <div className="text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link
            to="/login"
            className="font-medium text-slate-900 hover:underline"
          >
            Войти
          </Link>
        </div>
      </form>
    </div>
  );
}
