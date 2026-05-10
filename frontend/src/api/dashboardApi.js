import api from "../services/api";

export const listDashboards = () => api.get("/dashboards");

export const getDashboard = (id) => api.get(`/dashboards/${id}`);

export const createDashboard = (data) => api.post("/dashboards", data);

export const updateDashboard = (id, data) => api.put(`/dashboards/${id}`, data);

export const deleteDashboard = (id) => api.delete(`/dashboards/${id}`);

// Размещение виджетов
export const addWidgetToDashboard = (dashboardId, payload) =>
  api.post(`/dashboards/${dashboardId}/widgets`, payload);

export const removeWidgetFromDashboard = (dashboardId, widgetId) =>
  api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);

export const updateDashboardLayout = (dashboardId, items) =>
  api.put(`/dashboards/${dashboardId}/layout`, { items });
