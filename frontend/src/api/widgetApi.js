import api from "../services/api";

export const listWidgets = (dashboardId) => {
  const params = dashboardId !== undefined ? { dashboard_id: dashboardId } : {};
  return api.get("/widgets", { params });
};

export const getWidget = (id) => api.get(`/widgets/${id}`);

export const createWidget = (data) => api.post("/widgets", data);

export const updateWidget = (id, data) => api.put(`/widgets/${id}`, data);

export const deleteWidget = (id) => api.delete(`/widgets/${id}`);

export const getWidgetData = (id) => api.get(`/widgets/${id}/data`);
