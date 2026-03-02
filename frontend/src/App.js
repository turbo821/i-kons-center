import React, { useState } from "react";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";

function App() {
  const [page, setPage] = useState("home");

  return (
    <div>
      <div className="bg-gray-800 text-white p-4 flex justify-between">
        <div className="font-bold">Инфоцентр</div>
        <div className="space-x-4">
          <button onClick={() => setPage("home")} className="hover:underline">
            Главная
          </button>
          <button onClick={() => setPage("admin")} className="hover:underline">
            Админ панель
          </button>
        </div>
      </div>

      {page === "home" && <HomePage />}
      {page === "admin" && <AdminPage />}
    </div>
  );
}

export default App;