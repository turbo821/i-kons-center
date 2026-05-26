import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getMyAccess } from "../api/roleGroupApi";
import { useAuth } from "./AuthContext";

/**
 * Контекст эффективных прав доступа текущего пользователя.
 *
 * Загружает карту прав с /api/auth/me/access и предоставляет хелперы:
 *   canView(entityType, categoryId)  — может ли просматривать
 *   canEdit(entityType, categoryId)  — может ли редактировать
 *   editableCategoryIds(entityType)  — Set доступных на редактирование категорий
 *
 * categoryId === null означает виртуальную категорию «Без категории».
 * Глобальный admin видит интерфейс администрирования (isAdmin), но доступ к
 * самим сущностям всё равно определяется группами (как требует постановка).
 */
const AccessContext = createContext(null);

const EMPTY_ACCESS = {
  datasource: [],
  widget: [],
  dashboard: [],
  kpi: [],
};

export function AccessProvider({ children }) {
  const { user } = useAuth();
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setAccess(EMPTY_ACCESS);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await getMyAccess();
      setAccess(data.access || EMPTY_ACCESS);
      setIsAdmin(!!data.is_admin);
    } catch (e) {
      setAccess(EMPTY_ACCESS);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Нормализуем categoryId: undefined -> null
  const norm = (categoryId) =>
    categoryId === undefined || categoryId === "" ? null : categoryId;

  const levelFor = useCallback(
    (entityType, categoryId) => {
      const list = access[entityType] || [];
      const cid = norm(categoryId);
      const found = list.find((a) => {
        // null сравниваем как null; числа приводим
        if (cid === null) return a.category_id === null;
        return Number(a.category_id) === Number(cid);
      });
      return found ? found.level : null;
    },
    [access]
  );

  const canView = useCallback(
    (entityType, categoryId) => {
      const lvl = levelFor(entityType, categoryId);
      return lvl === "view" || lvl === "edit";
    },
    [levelFor]
  );

  const canEdit = useCallback(
    (entityType, categoryId) => levelFor(entityType, categoryId) === "edit",
    [levelFor]
  );

  // Может ли пользователь создавать хоть что-то этого типа
  // (есть ли хоть одна категория с edit-доступом)
  const canCreateAny = useCallback(
    (entityType) =>
      (access[entityType] || []).some((a) => a.level === "edit"),
    [access]
  );

  const editableCategoryIds = useCallback(
    (entityType) =>
      new Set(
        (access[entityType] || [])
          .filter((a) => a.level === "edit")
          .map((a) => a.category_id)
      ),
    [access]
  );

  const value = {
    access,
    isAdmin,
    loading,
    reload,
    canView,
    canEdit,
    canCreateAny,
    editableCategoryIds,
    levelFor,
  };

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used inside AccessProvider");
  return ctx;
}
