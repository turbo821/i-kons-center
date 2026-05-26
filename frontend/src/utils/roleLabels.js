/**
 * Перевод системных ролей на русский для отображения в интерфейсе.
 * Глобальные роли хранятся на бэкенде на английском (admin/expert/viewer),
 * а пользователю показываем по-русски.
 */

const GLOBAL_ROLE_LABELS = {
  admin: "Администратор",
  expert: "Эксперт",
  viewer: "Зритель",
};

const GROUP_ROLE_LABELS = {
  expert: "Эксперт",
  viewer: "Зритель",
};

export function roleLabel(role) {
  if (!role) return "";
  return GLOBAL_ROLE_LABELS[role] || role;
}

export function groupRoleLabel(role) {
  if (!role) return "";
  return GROUP_ROLE_LABELS[role] || role;
}

export function roleLabels(roles) {
  if (!Array.isArray(roles)) return "";
  return roles.map(roleLabel).join(", ");
}
