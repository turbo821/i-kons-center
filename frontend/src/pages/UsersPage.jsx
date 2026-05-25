import { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Shield,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";

import {
  listUsers,
  listRoles,
  updateUserRoles,
  updateUserStatus,
  deleteUser,
} from "../api/userApi";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
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
        <span className="text-xs font-medium text-slate-400">Роль:</span>
        <Chip active={roleFilter === null} onClick={() => setRoleFilter(null)}>
          Все ({users.length})
        </Chip>
        {roles.map((r) => (
          <Chip
            key={r.id}
            active={roleFilter === r.name}
            onClick={() =>
              setRoleFilter(roleFilter === r.name ? null : r.name)
            }
          >
            {r.name} ({roleCounts[r.name] || 0})
          </Chip>
        ))}

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
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {r}
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
                            title="Изменить роли"
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
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setSelectedRoles(user.roles || []);
  }, [user]);

  const toggle = (name) =>
    setSelectedRoles((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      toast.error("Выберите хотя бы одну роль");
      return;
    }

    setBusy(true);
    try {
      await updateUserRoles(user.id, selectedRoles);
      toast.success(`Роли пользователя ${user.username} обновлены`);
      onClose();
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Роли: ${user.username}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Выберите роли, которые будут назначены пользователю
        </p>

        <div className="space-y-2">
          {roles.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(r.name)}
                onChange={() => toggle(r.name)}
                className="mt-0.5"
              />
              <div>
                <p className="font-medium">{r.name}</p>
                {r.description && (
                  <p className="text-xs text-slate-500">{r.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Сохранение..." : "Сохранить"}
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
