import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const {
    user,
    logout
  } = useAuth();

  return (
    <header className="bg-gray-900 text-white shadow">
      <div className="mx-auto px-6 h-16 flex items-center justify-end">
        <nav className="flex items-center gap-6 text-sm">
          {!user && (
            <>
              <Link className="hover:text-blue-400 transition" to="/login">
                Вход
              </Link>
              <Link
                className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500 transition"
                to="/register"
              >
                Регистрация
              </Link>
            </>
          )}
          {user && (
            <>
              <span className="mt-1 bg-slate-800 rounded-xl p-2">
                {user.username}
              </span>
              <button onClick={logout}>
                Выйти
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;