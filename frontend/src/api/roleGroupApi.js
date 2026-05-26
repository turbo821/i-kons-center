import api from "../services/api";

// --- Группы ---
export const listRoleGroups = () => api.get("/role-groups");

export const getRoleGroup = (id) => api.get(`/role-groups/${id}`);

export const createRoleGroup = (data) => api.post("/role-groups", data);

export const updateRoleGroup = (id, data) =>
  api.put(`/role-groups/${id}`, data);

export const deleteRoleGroup = (id) => api.delete(`/role-groups/${id}`);

// --- Членство ---
export const addGroupMember = (groupId, userId, groupRole) =>
  api.post(`/role-groups/${groupId}/members`, {
    user_id: userId,
    group_role: groupRole,
  });

export const updateGroupMemberRole = (groupId, userId, groupRole) =>
  api.put(`/role-groups/${groupId}/members/${userId}`, {
    group_role: groupRole,
  });

export const removeGroupMember = (groupId, userId) =>
  api.delete(`/role-groups/${groupId}/members/${userId}`);

// --- Доступ к категориям ---
// access: [{ entity_type, category_id }] (category_id = null для «Без категории»)
export const setGroupAccess = (groupId, access) =>
  api.put(`/role-groups/${groupId}/access`, { access });

// --- Карта прав текущего пользователя ---
export const getMyAccess = () => api.get("/auth/me/access");
