import React, { useEffect, useState } from "react";
import api from "../api";

function HomePage() {
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const categoriesRes = await api.get("/categories");
      const cardsRes = await api.get("/cards");

      setCategories(categoriesRes.data);
      setCards(cardsRes.data);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    }
  };

  const getCardsByCategory = (categoryId) =>
    cards.filter(card => card.category_id === categoryId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="flex gap-8 overflow-x-auto pb-4">

        {categories.map(category => (
          <div
            key={category.id}
            className="w-96 bg-white rounded-2xl shadow-lg flex flex-col"
          >

            {/* Заголовок категории */}
            <div
              className="p-5 text-white font-semibold text-lg rounded-t-2xl"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </div>

            {/* Описание категории */}
            {category.description && (
              <div className="px-5 pt-4 text-sm text-gray-500 border-b">
                {category.description}
              </div>
            )}

            {/* Карточки */}
            <div className="p-5 space-y-5 flex-1 overflow-y-auto">

              {getCardsByCategory(category.id).map(card => (
                <div
                  key={card.id}
                  className="bg-gray-50 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-300 border border-gray-100"
                >

                  {/* Заголовок */}
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {card.title}
                  </h3>

                  {/* Ответственный */}
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Ответственный:</span>{" "}
                    {card.responsible}
                  </div>

                  {/* Период обновления */}
                  {card.update_period && (
                    <div className="text-sm text-gray-500 mb-2">
                      <span className="font-medium">Обновление:</span>{" "}
                      {card.update_period}
                    </div>
                  )}

                  {/* Описание */}
                  {card.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {card.description}
                    </p>
                  )}

                  {/* PDF ссылка */}
                  {card.pdf_path && (
                    <a
                      href={`http://localhost:5000/uploads/${card.pdf_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                    >
                      📄 Открыть отчет
                    </a>
                  )}

                </div>
              ))}

              {getCardsByCategory(category.id).length === 0 && (
                <div className="text-sm text-gray-400 italic">
                  Нет карточек
                </div>
              )}

            </div>
          </div>
        ))}

      </div>
    </div>
  );
}

export default HomePage;