import api from "../services/api";

export const listKpis = (categoryId) => {
  const params = categoryId ? { category_id: categoryId } : {};
  return api.get("/kpis", { params });
};

export const getKpi = (id) => api.get(`/kpis/${id}`);
export const createKpi = (data) => api.post("/kpis", data);
export const updateKpi = (id, data) => api.put(`/kpis/${id}`, data);
export const deleteKpi = (id) => api.delete(`/kpis/${id}`);
export const getKpiValue = (id) => api.get(`/kpis/${id}/value`);

// Размещение KPI на дашборде
export const addKpiToDashboard = (dashboardId, kpiId) =>
  api.post(`/dashboards/${dashboardId}/kpis`, { kpi_id: kpiId });

export const removeKpiFromDashboard = (dashboardId, kpiId) =>
  api.delete(`/dashboards/${dashboardId}/kpis/${kpiId}`);

// Метрики (для выбора при создании KPI) — алиас для удобства
export { listMetrics } from "./metricApi";
