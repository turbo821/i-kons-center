import api from "../services/api";

export const listDashboards = (params = {}) => api.get("/dashboards", { params });

export const getDashboard = (id) => api.get(`/dashboards/${id}`);

export const createDashboard = (data) => api.post("/dashboards", data);

export const updateDashboard = (id, data) => api.put(`/dashboards/${id}`, data);

export const deleteDashboard = (id) => api.delete(`/dashboards/${id}`);

// Закрепление дашборда
export const pinDashboard = (id, isPinned) =>
  api.post(`/dashboards/${id}/pin`, { is_pinned: isPinned });

// Размещение виджетов
export const addWidgetToDashboard = (dashboardId, payload) =>
  api.post(`/dashboards/${dashboardId}/widgets`, payload);

export const removeWidgetFromDashboard = (dashboardId, widgetId) =>
  api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);

export const updateDashboardLayout = (dashboardId, items) =>
  api.put(`/dashboards/${dashboardId}/layout`, { items });

// Текстовые элементы
export const addTextToDashboard = (dashboardId, payload) =>
  api.post(`/dashboards/${dashboardId}/texts`, payload);

export const updateDashboardText = (dashboardId, textId, payload) =>
  api.put(`/dashboards/${dashboardId}/texts/${textId}`, payload);

export const removeTextFromDashboard = (dashboardId, textId) =>
  api.delete(`/dashboards/${dashboardId}/texts/${textId}`);
