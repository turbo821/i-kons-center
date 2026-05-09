import api from "../services/api";

export const listDataSources = () =>
  api.get("/datasources");

export const getDataSource = (id) =>
  api.get(`/datasources/${id}`);

export const createSqlDataSource = (data) =>
  api.post("/datasources", data);

export const uploadFileDataSource = (file, name) => {
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);

  return api.post("/datasources/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteDataSource = (id) =>
  api.delete(`/datasources/${id}`);

export const testDataSource = (id) =>
  api.post(`/datasources/${id}/test`);

export const listDataSourceTables = (id) =>
  api.get(`/datasources/${id}/tables`);
