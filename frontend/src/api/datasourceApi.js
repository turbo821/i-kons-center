import api from "../services/api";

export const listDataSources = (categoryId) => {
  const params = categoryId !== undefined ? { category_id: categoryId } : {};
  return api.get("/datasources", { params });
};

export const getDataSource = (id) => api.get(`/datasources/${id}`);

export const createSqlDataSource = (data) => api.post("/datasources", data);

export const uploadFileDataSource = (file, name, categoryId) => {
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);
  if (categoryId) formData.append("category_id", categoryId);
  return api.post("/datasources/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const updateDataSource = (id, data) =>
  api.put(`/datasources/${id}`, data);

export const deleteDataSource = (id) => api.delete(`/datasources/${id}`);

export const testDataSource = (id) => api.post(`/datasources/${id}/test`);

export const listDataSourceTables = (id) =>
  api.get(`/datasources/${id}/tables`);

// Замена файла CSV/Excel
export const replaceDataSourceFile = (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/datasources/${id}/replace-file`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// Обновление соединения SQL
export const updateDataSourceConnection = (id, data) =>
  api.put(`/datasources/${id}/connection`, data);
