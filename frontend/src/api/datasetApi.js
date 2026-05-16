import api from "../services/api";

export const listDatasets = (datasourceId) => {
  const params = datasourceId ? { datasource_id: datasourceId } : {};
  return api.get("/datasets", { params });
};

export const getDataset = (id) =>
  api.get(`/datasets/${id}`);

export const createDataset = (data) =>
  api.post("/datasets", data);

export const updateDataset = (id, data) => 
  api.put(`/datasets/${id}`, data);

export const deleteDataset = (id) =>
  api.delete(`/datasets/${id}`);

export const previewDataset = (id, limit = 50) =>
  api.get(`/datasets/${id}/preview`, { params: { limit } });

export const refreshDatasetFields = (id) =>
  api.post(`/datasets/${id}/refresh`);
