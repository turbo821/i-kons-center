import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register", form);
      toast.success("Регистрация успешна. Теперь войдите в систему");
      navigate("/login");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-center items-center mt-20">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md space-y-6"
      >
        <h2 className="text-2xl font-semibold text-center">Регистрация</h2>

        <input
          type="text"
          name="username"
          placeholder="Имя пользователя"
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Пароль"
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          minLength={6}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
        >
          {busy ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>
    </div>
  );
}

export default RegisterPage;
