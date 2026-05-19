import api from "../services/api";

export const listMetrics = (datasetId) =>
  api.get("/metrics", { params: datasetId ? { dataset_id: datasetId } : {} });

export const createMetric = (data) => api.post("/metrics", data);

export const updateMetric = (id, data) => api.put(`/metrics/${id}`, data);

export const deleteMetric = (id) => api.delete(`/metrics/${id}`);
