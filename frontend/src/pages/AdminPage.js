import React, { useEffect, useState, useRef } from "react";
import api from "../api";

function AdminPage() {
  const [categories, setCategories] = useState([]);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#2563eb"
  });

  const [cardForm, setCardForm] = useState({
    title: "",
    responsible: "",
    description: "",
    update_period: "",
    category_id: "",
    pdf: null
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const res = await api.get("/categories");
    setCategories(res.data);
  };

  const createCard = async () => {
    try {
      const formData = new FormData();

      Object.entries(cardForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      await api.post("/cards", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setCardForm({
        title: "",
        responsible: "",
        description: "",
        update_period: "",
        category_id: "",
        pdf: null
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (error) {
      console.error("Ошибка создания карточки:", error);
    }
  };

  const createCategory = async () => {
    try {
      await api.post("/categories", categoryForm);

      // очистка формы
      setCategoryForm({
        name: "",
        description: "",
        color: "#2563eb"
      });

      // обновляем список категорий
      fetchCategories();

    } catch (error) {
      console.error("Ошибка создания категории:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-10 flex justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Создание категории
          </h2>

          <div className="space-y-5">

            <input
              type="text"
              placeholder="Название категории"
              value={categoryForm.name}
              onChange={e =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />

            <textarea
              placeholder="Описание категории"
              rows="3"
              value={categoryForm.description}
              onChange={e =>
                setCategoryForm({ ...categoryForm, description: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
            />

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Цвет категории:</span>
              <input
                type="color"
                value={categoryForm.color}
                onChange={e =>
                  setCategoryForm({ ...categoryForm, color: e.target.value })
                }
                className="w-12 h-12 border-none cursor-pointer"
              />
            </div>

            <button
              onClick={createCategory}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg"
            >
              Создать категорию
            </button>

          </div>
        </div>

        <hr className="my-10" />

        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Создание карточки
        </h2>

        <div className="space-y-5">

          <input
            type="text"
            placeholder="Название"
            value={cardForm.title}
            onChange={e =>
              setCardForm({ ...cardForm, title: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />

          <input
            type="text"
            placeholder="Ответственный"
            value={cardForm.responsible}
            onChange={e =>
              setCardForm({ ...cardForm, responsible: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />

          <textarea
            placeholder="Описание"
            value={cardForm.description}
            onChange={e =>
              setCardForm({ ...cardForm, description: e.target.value })
            }
            rows="4"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
          />

          <input
            type="text"
            placeholder="Период обновления (например: ежемесячно)"
            value={cardForm.update_period}
            onChange={e =>
              setCardForm({ ...cardForm, update_period: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />

          <select
            value={cardForm.category_id}
            onChange={e =>
              setCardForm({ ...cardForm, category_id: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-white"
          >
            <option value="">Выберите категорию</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between border border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition">
            <span className="text-sm text-gray-600">
              {cardForm.pdf ? cardForm.pdf.name : "Файл не выбран"}
            </span>

            <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
              Выбрать PDF
              <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                className="hidden"
                onChange={e =>
                  setCardForm({ ...cardForm, pdf: e.target.files[0] })
                }
              />
            </label>
          </div>

          <button
            onClick={createCard}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition shadow-md hover:shadow-lg"
          >
            Создать карточку
          </button>

        </div>
      </div>
    </div>
  );
}

export default AdminPage;