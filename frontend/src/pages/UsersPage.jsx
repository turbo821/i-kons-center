import { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Shield,
  Trash2,
  Lock,
  Unlock,
  X,
} from "lucide-react";

import {
  listUsers,
  listRoles,
  updateUserRoles,
  updateUserStatus,
  deleteUser,
} from "../api/userApi";
import {
  listRoleGroups,
  addGroupMember,
  updateGroupMemberRole,
  removeGroupMember,
} from "../api/roleGroupApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { roleLabel, groupRoleLabel } from "../utils/roleLabels";
import Modal from "../components/Modal";
import ListToolbar, { applySort, matchesSearch } from "../components/ListToolbar";


const SORT_OPTIONS = [
  { value: "created_desc", label: "Сначала новые" },
  { value: "created_asc", label: "Сначала старые" },
  { value: "username_asc", label: "По имени А→Я" },
  { value: "username_desc", label: "По имени Я→А" },
  { value: "email_asc", label: "По email А→Я" },
];

const SORT_MAP = {
  created_desc: { field: "created_at", direction: "desc" },
  created_asc: { field: "created_at", direction: "asc" },
  username_asc: { field: "username", direction: "asc" },
  username_desc: { field: "username", direction: "desc" },
  email_asc: { field: "email", direction: "asc" },
};


export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [roleFilter, setRoleFilter] = useState(null);     // null = все роли
  const [statusFilter, setStatusFilter] = useState(null);  // null = все статусы

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listUsers(),
        listRoles(),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (e) {
      toast.error("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let result = users;

    if (roleFilter) {
      result = result.filter((u) => (u.roles || []).includes(roleFilter));
    }
    if (statusFilter) {
      result = result.filter((u) => u.status === statusFilter);
    }

    result = result.filter((u) =>
      matchesSearch(u, search, ["username", "email"])
    );

    return applySort(result, sort, SORT_MAP);
  }, [users, roleFilter, statusFilter, search, sort]);

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === "active" ? "blocked" : "active";

    if (newStatus === "blocked") {
      const ok = await confirm({
        title: "Заблокировать пользователя?",
        body: `${user.username} не сможет войти в систему.`,
        confirmText: "Заблокировать",
        danger: true,
      });
      if (!ok) return;
    }

    try {
      await updateUserStatus(user.id, newStatus);
      toast.success(
        newStatus === "active"
          ? `Пользователь ${user.username} активирован`
          : `Пользователь ${user.username} заблокирован`
      );
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleDelete = async (user) => {
    const ok = await confirm({
      title: "Удалить пользователя?",
      body: `${user.username} будет удалён без возможности восстановления.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(user.id);
      toast.success("Пользователь удалён");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  // Счётчики для чипов
  const roleCounts = useMemo(() => {
    const counts = {};
    for (const u of users) {
      for (const r of u.roles || []) {
        counts[r] = (counts[r] || 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const statusCounts = useMemo(() => {
    let active = 0;
    let blocked = 0;
    for (const u of users) {
      if (u.status === "blocked") blocked += 1;
      else active += 1;
    }
    return { active, blocked };
  }, [users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Управление пользователями</h1>
        <p className="text-slate-600">Только для администраторов системы</p>
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по имени и email..."
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={SORT_OPTIONS}
      />

      {/* Фильтры: роли и статус */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="ml-3 text-xs font-medium text-slate-400">Статус:</span>
        <Chip
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
        >
          Все
        </Chip>
        <Chip
          active={statusFilter === "active"}
          onClick={() =>
            setStatusFilter(statusFilter === "active" ? null : "active")
          }
        >
          Активные ({statusCounts.active})
        </Chip>
        <Chip
          active={statusFilter === "blocked"}
          onClick={() =>
            setStatusFilter(statusFilter === "blocked" ? null : "blocked")
          }
        >
          Заблокированные ({statusCounts.blocked})
        </Chip>
      </div>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <UsersIcon className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            {users.length === 0
              ? "Нет пользователей"
              : "Ничего не найдено по заданным условиям"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Пользователь</Th>
                <Th>Email</Th>
                <Th>Роли</Th>
                <Th>Статус</Th>
                <Th>Регистрация</Th>
                <Th align="right">Действия</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMe = u.id === Number(currentUser.id);
                return (
                  <tr
                    key={u.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <Td>
                      <div className="font-medium">
                        {u.username}
                        {isMe && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                            вы
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {roleLabel(r)}
                          </span>
                        ))}
                        {(u.groups || []).map((g) => (
                          <span
                            key={g.group_id}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                            title={`Роль в группе: ${groupRoleLabel(g.group_role)}`}
                          >
                            {g.group_name} - {groupRoleLabel(g.group_role)}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={u.status} />
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("ru-RU")
                        : "—"}
                    </Td>
                    <Td align="right">
                      {!isMe && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Управление доступом"
                          >
                            <Shield size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                            title={
                              u.status === "active" ? "Заблокировать" : "Активировать"
                            }
                          >
                            {u.status === "active" ? (
                              <Lock size={14} />
                            ) : (
                              <Unlock size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditRolesModal
        user={editingUser}
        roles={roles}
        onClose={() => setEditingUser(null)}
        onSaved={load}
      />
    </div>
  );
}


function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}


function StatusBadge({ status }) {
  if (status === "blocked") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        заблокирован
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      активен
    </span>
  );
}


function EditRolesModal({ user, roles, onClose, onSaved }) {
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]); // [{group_id, group_role}]
  const [busy, setBusy] = useState(false);

  // Для добавления в новую группу
  const [addGroupId, setAddGroupId] = useState("");
  const [addRole, setAddRole] = useState("viewer");

  useEffect(() => {
    if (!user) return;
    setIsAdmin((user.roles || []).includes("admin"));
    setMemberships(
      (user.groups || []).map((g) => ({
        group_id: g.group_id,
        group_name: g.group_name,
        group_role: g.group_role,
      }))
    );
    listRoleGroups()
      .then(({ data }) => setGroups(data))
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const memberGroupIds = new Set(memberships.map((m) => m.group_id));
  const candidateGroups = groups.filter((g) => !memberGroupIds.has(g.id));

  // Сохранение глобальной роли admin.
  // В системе действует одна глобальная роль — admin; остальные права
  // даются через включение в ролевые группы, поэтому viewer как
  // глобальная роль больше не используется.
  const handleSaveAdmin = async () => {
    setBusy(true);
    try {
      const newRoles = isAdmin ? ["admin"] : [];
      await updateUserRoles(user.id, newRoles);
      toast.success("Глобальная роль обновлена");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleAddToGroup = async () => {
    if (!addGroupId) return;
    try {
      await addGroupMember(Number(addGroupId), user.id, addRole);
      const g = groups.find((x) => x.id === Number(addGroupId));
      setMemberships((prev) => [
        ...prev,
        {
          group_id: Number(addGroupId),
          group_name: g?.name,
          group_role: addRole,
        },
      ]);
      setAddGroupId("");
      setAddRole("viewer");
      toast.success("Пользователь добавлен в группу");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleChangeGroupRole = async (groupId, role) => {
    try {
      await updateGroupMemberRole(groupId, user.id, role);
      setMemberships((prev) =>
        prev.map((m) =>
          m.group_id === groupId ? { ...m, group_role: role } : m
        )
      );
      toast.success("Роль в группе обновлена");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRemoveFromGroup = async (groupId) => {
    try {
      await removeGroupMember(groupId, user.id);
      setMemberships((prev) => prev.filter((m) => m.group_id !== groupId));
      toast.success("Пользователь убран из группы");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Доступ: ${user.username}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {/* Глобальная роль администратора */}
        <section className="rounded-lg border border-slate-200 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="font-medium">Администратор</p>
              <p className="text-xs text-slate-500">
                Глобальная роль: управление пользователями, группами и
                категориями. Доступ к самим сущностям всё равно определяется
                группами ниже.
              </p>
            </div>
          </label>
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSaveAdmin}
              disabled={busy}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Сохранение..." : "Сохранить роль"}
            </button>
          </div>
        </section>

        {/* Членство в ролевых группах */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            Ролевые группы
          </h3>

          {/* Добавление в группу */}
          <div className="mb-3 flex gap-2">
            <select
              value={addGroupId}
              onChange={(e) => setAddGroupId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Добавить в группу…</option>
              {candidateGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="viewer">Зритель</option>
              <option value="expert">Эксперт</option>
            </select>
            <button
              onClick={handleAddToGroup}
              disabled={!addGroupId}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Добавить
            </button>
          </div>

          {/* Текущие членства */}
          <div className="space-y-2">
            {memberships.length === 0 && (
              <p className="text-xs text-slate-400">
                Пользователь не состоит ни в одной группе и поэтому не видит
                сущности.
              </p>
            )}
            {memberships.map((m) => (
              <div
                key={m.group_id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="text-sm font-medium">{m.group_name}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={m.group_role}
                    onChange={(e) =>
                      handleChangeGroupRole(m.group_id, e.target.value)
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="viewer">Зритель</option>
                    <option value="expert">Эксперт</option>
                  </select>
                  <button
                    onClick={() => handleRemoveFromGroup(m.group_id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Убрать из группы"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}


const Th = ({ children, align = "left" }) => (
  <th
    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
    style={{ textAlign: align }}
  >
    {children}
  </th>
);

const Td = ({ children, align = "left", className = "" }) => (
  <td className={`px-4 py-3 ${className}`} style={{ textAlign: align }}>
    {children}
  </td>
);