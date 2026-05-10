import api from "../services/api";

export const listUsers = () => api.get("/users");
export const getUser = (id) => api.get(`/users/${id}`);
export const updateUserRoles = (id, roleNames) =>
  api.put(`/users/${id}/roles`, { role_names: roleNames });
export const updateUserStatus = (id, status) =>
  api.put(`/users/${id}/status`, { status });
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const listRoles = () => api.get("/auth/roles");

export const changePassword = (currentPassword, newPassword) =>
  api.put("/auth/me/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });

export const getSystemOverview = () => api.get("/stats/overview");
