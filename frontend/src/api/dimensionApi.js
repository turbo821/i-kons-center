import api from "../services/api";

export const listDimensions = (datasetId) =>
  api.get("/dimensions", { params: datasetId ? { dataset_id: datasetId } : {} });

export const createDimension = (data) => api.post("/dimensions", data);

export const deleteDimension = (id) => api.delete(`/dimensions/${id}`);
