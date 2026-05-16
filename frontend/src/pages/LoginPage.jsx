import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";


export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const change = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form.email, form.password, remember);
      toast.success("Добро пожаловать!");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ошибка входа");
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
            <LogIn size={22} />
          </div>
          <h2 className="text-2xl font-semibold">Вход в систему</h2>
          <p className="mt-1 text-sm text-slate-500">
            Введите учётные данные для доступа
          </p>
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
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Пароль</label>
          <PasswordInput
            name="password"
            value={form.password}
            onChange={change}
            placeholder="••••••••"
            required
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Запомнить меня</span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Вход..." : "Войти"}
        </button>

        <div className="text-center text-sm text-slate-500">
          Нет аккаунта?{" "}
          <Link
            to="/register"
            className="font-medium text-slate-900 hover:underline"
          >
            Зарегистрироваться
          </Link>
        </div>
      </form>
    </div>
  );
}
