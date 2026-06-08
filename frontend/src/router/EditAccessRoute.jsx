import { Navigate } from "react-router-dom";
import { useAccess } from "../context/AccessContext";

/**
 * Guard для маршрутов-редакторов (билдер виджета и т. п.).
 *
 * В отличие от RoleRoute, который проверяет ГЛОБАЛЬНУЮ роль из JWT,
 * этот guard смотрит на права пользователя в ролевых группах: пускает,
 * только если у пользователя есть право редактирования хотя бы в одной
 * категории нужного типа сущности. Так эксперт в группе попадёт в билдер,
 * даже если глобальных ролей у него нет.
 *
 * Props:
 *   entityType — "datasource" | "widget" | "dashboard" | "kpi"
 *   children — защищаемый компонент
 */
export default function EditAccessRoute({ entityType, children }) {
  const { canCreateAny, loading } = useAccess();

  // Пока карта прав ещё не загружена — ничего не редиректим,
  // чтобы не было ложного отказа при первой загрузке
  if (loading) return null;

  if (!canCreateAny(entityType)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
