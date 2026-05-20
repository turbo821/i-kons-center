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

// Источник «по ссылке»: путь к существующему файлу на сервере, без копирования.
// Полезно когда файл регулярно обновляется внешним процессом — изменения
// автоматически подхватываются на следующем чтении.
export const createCsvLinkDataSource = (data) =>
  api.post("/datasources/link", data);

export const updateDataSource = (id, data) =>
  api.put(`/datasources/${id}`, data);

export const deleteDataSource = (id) => api.delete(`/datasources/${id}`);

export const testDataSource = (id) => api.post(`/datasources/${id}/test`);

export const listDataSourceTables = (id) =>
  api.get(`/datasources/${id}/tables`);

// Замена файла (только для type='csv', загруженных через /upload)
export const replaceDataSourceFile = (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/datasources/${id}/replace-file`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// Обновление пути к файлу (только для type='csv_link')
export const updateDataSourceLinkPath = (id, path) =>
  api.put(`/datasources/${id}/link-path`, { path });

// Обновление SQL-соединения
export const updateDataSourceConnection = (id, data) =>
  api.put(`/datasources/${id}/connection`, data);
