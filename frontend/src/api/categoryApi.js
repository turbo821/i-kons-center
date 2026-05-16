import api from "../services/api";

/**
 * Универсальный API-клиент для категорий.
 * type — один из: 'datasource', 'widget', 'dashboard', 'kpi'
 */

const buildClient = (type) => ({
  list: () => api.get(`/${type}-categories`),
  create: (data) => api.post(`/${type}-categories`, data),
  update: (id, data) => api.put(`/${type}-categories/${id}`, data),
  remove: (id) => api.delete(`/${type}-categories/${id}`),
});

export const datasourceCategoryApi = buildClient("datasource");
export const widgetCategoryApi = buildClient("widget");
export const dashboardCategoryApi = buildClient("dashboard");
export const kpiCategoryApi = buildClient("kpi");

// Удобный фасад: можно делать listCategories('datasource')
export const listCategories = (type) => buildClient(type).list();


// Совместимость со старым кодом, который ожидает функции для KPI-категорий.
// Используйте `kpiCategoryApi.create(...)` в новом коде. TODO del
export const createCategory = (data) => kpiCategoryApi.create(data);
export const updateCategory = (id, data) => kpiCategoryApi.update(id, data);
export const deleteCategory = (id) => kpiCategoryApi.remove(id);