import { useEffect, useState, useCallback } from "react";
import {
  Users as UsersIcon,
  Plus,
  Trash2,
  Pencil,
  Shield,
  Layers,
  UserPlus,
  X,
} from "lucide-react";

import {
  listRoleGroups,
  getRoleGroup,
  createRoleGroup,
  updateRoleGroup,
  deleteRoleGroup,
  addGroupMember,
  updateGroupMemberRole,
  removeGroupMember,
  setGroupAccess,
} from "../api/roleGroupApi";
import { listUsers } from "../api/userApi";
import { listCategories } from "../api/categoryApi";

import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";

const ENTITY_TYPES = [
  { key: "datasource", label: "Источники данных" },
  { key: "widget", label: "Виджеты" },
  { key: "dashboard", label: "Дашборды" },
  { key: "kpi", label: "Показатели KPI" },
];

export default function RoleGroupsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listRoleGroups();
      setGroups(data);
    } catch (e) {
      toast.error("Не удалось загрузить группы");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await getRoleGroup(id);
      setDetail(data);
    } catch (e) {
      toast.error("Не удалось загрузить группу");
    }
  }, [toast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const handleCreate = async (name, description) => {
    try {
      const { data } = await createRoleGroup({ name, description });
      toast.success(`Группа «${name}» создана`);
      setCreateOpen(false);
      await loadGroups();
      setSelectedId(data.id);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRename = async (id, name, description) => {
    try {
      await updateRoleGroup(id, { name, description });
      toast.success("Группа обновлена");
      setEditGroup(null);
      await loadGroups();
      if (selectedId === id) loadDetail(id);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleDelete = async (group) => {
    const ok = await confirm({
      title: "Удалить группу?",
      body: `Группа «${group.name}» и все её настройки доступа будут удалены. Пользователи останутся, но потеряют доступ, который давала эта группа.`,
      confirmText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRoleGroup(group.id);
      toast.success("Группа удалена");
      if (selectedId === group.id) setSelectedId(null);
      await loadGroups();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ролевые группы</h1>
          <p className="text-slate-600">
            Группы определяют, какие категории сущностей доступны участникам и
            на каком уровне (эксперт — редактирование, зритель — просмотр).
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          Создать группу
        </button>
      </div>

      {loading && <p className="text-slate-500">Загрузка...</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <UsersIcon className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600">
            Пока нет ни одной группы. Создайте первую, чтобы начать выдавать
            доступ.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Список групп */}
          <div className="space-y-2 lg:col-span-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedId === g.id
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-slate-400">
                    {g.members_count} чел.
                  </span>
                </div>
                {g.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {g.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Открыто категорий: {g.categories_count}
                </p>
              </button>
            ))}
          </div>

          {/* Детали выбранной группы */}
          <div className="lg:col-span-2">
            {!detail && (
              <div className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-sm">
                Выберите группу слева, чтобы управлять её участниками и
                доступом.
              </div>
            )}
            {detail && (
              <GroupDetail
                detail={detail}
                onEdit={() => setEditGroup(detail)}
                onDelete={() => handleDelete(detail)}
                onManageMembers={() => setMembersOpen(true)}
                onManageAccess={() => setAccessOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Модалки */}
      <GroupFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(n, d) => handleCreate(n, d)}
        title="Новая группа"
      />
      <GroupFormModal
        open={!!editGroup}
        onClose={() => setEditGroup(null)}
        onSubmit={(n, d) => handleRename(editGroup.id, n, d)}
        title="Изменить группу"
        initial={editGroup}
      />
      {detail && (
        <MembersModal
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          group={detail}
          onChanged={() => {
            loadDetail(detail.id);
            loadGroups();
          }}
        />
      )}
      {detail && (
        <AccessModal
          open={accessOpen}
          onClose={() => setAccessOpen(false)}
          group={detail}
          onChanged={() => {
            loadDetail(detail.id);
            loadGroups();
          }}
        />
      )}
    </div>
  );
}

function GroupDetail({
  detail,
  onEdit,
  onDelete,
  onManageMembers,
  onManageAccess,
}) {
  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{detail.name}</h2>
          {detail.description && (
            <p className="text-sm text-slate-600">{detail.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            title="Изменить"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            title="Удалить"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Участники */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UsersIcon size={15} /> Участники ({detail.members?.length || 0})
          </h3>
          <button
            onClick={onManageMembers}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <UserPlus size={14} /> Управлять
          </button>
        </div>
        {(!detail.members || detail.members.length === 0) && (
          <p className="text-xs text-slate-400">Пока нет участников.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {detail.members?.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs"
            >
              <span className="font-medium">{m.username}</span>
              <RolePill role={m.group_role} />
            </span>
          ))}
        </div>
      </section>

      {/* Доступ к категориям */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Layers size={15} /> Открытые категории (
            {detail.categories?.length || 0})
          </h3>
          <button
            onClick={onManageAccess}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <Shield size={14} /> Настроить
          </button>
        </div>
        {(!detail.categories || detail.categories.length === 0) && (
          <p className="text-xs text-slate-400">
            Группе не открыта ни одна категория.
          </p>
        )}
        <div className="space-y-1">
          {ENTITY_TYPES.map((et) => {
            const items = (detail.categories || []).filter(
              (c) => c.entity_type === et.key
            );
            if (items.length === 0) return null;
            return (
              <div key={et.key} className="text-xs">
                <span className="font-medium text-slate-600">{et.label}: </span>
                {items.map((c) => c.category_name || "Без категории").join(", ")}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RolePill({ role }) {
  const isExpert = role === "expert";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isExpert
          ? "bg-emerald-100 text-emerald-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {isExpert ? "эксперт" : "зритель"}
    </span>
  );
}

function GroupFormModal({ open, onClose, onSubmit, title, initial }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
    }
  }, [open, initial]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Например, Финансовый отдел"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Необязательно"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim(), description)}
            disabled={!name.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MembersModal({ open, onClose, group, onChanged }) {
  const toast = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("viewer");

  useEffect(() => {
    if (open) {
      listUsers()
        .then(({ data }) => setAllUsers(data))
        .catch(() => toast.error("Не удалось загрузить пользователей"));
    }
  }, [open, toast]);

  const memberIds = new Set((group.members || []).map((m) => m.user_id));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  const handleAdd = async () => {
    if (!addUserId) return;
    try {
      await addGroupMember(group.id, Number(addUserId), addRole);
      toast.success("Участник добавлен");
      setAddUserId("");
      setAddRole("viewer");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleChangeRole = async (userId, role) => {
    try {
      await updateGroupMemberRole(group.id, userId, role);
      toast.success("Роль обновлена");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleRemove = async (userId) => {
    try {
      await removeGroupMember(group.id, userId);
      toast.success("Участник удалён из группы");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Участники: ${group.name}`}>
      <div className="space-y-4">
        {/* Добавление */}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium">Добавить участника</p>
          <div className="flex gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Выберите пользователя…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
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
              onClick={handleAdd}
              disabled={!addUserId}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </div>

        {/* Список */}
        <div className="space-y-2">
          {(group.members || []).length === 0 && (
            <p className="text-sm text-slate-400">Участников пока нет.</p>
          )}
          {(group.members || []).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{m.username}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.group_role}
                  onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="viewer">Зритель</option>
                  <option value="expert">Эксперт</option>
                </select>
                <button
                  onClick={() => handleRemove(m.user_id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Убрать из группы"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function AccessModal({ open, onClose, group, onChanged }) {
  const toast = useToast();
  // categoriesByType: { datasource: [{id,name}, ...], ... }
  const [categoriesByType, setCategoriesByType] = useState({});
  // selected: Set строк "entity_type:category_id" (category_id "none" для без категории)
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Загружаем категории всех типов
    Promise.all(
      ENTITY_TYPES.map((et) =>
        listCategories(et.key)
          .then(({ data }) => [et.key, data])
          .catch(() => [et.key, []])
      )
    ).then((pairs) => {
      const map = {};
      pairs.forEach(([k, v]) => (map[k] = v));
      setCategoriesByType(map);
    });

    // Текущие доступы группы -> в selected
    const cur = new Set();
    (group.categories || []).forEach((c) => {
      const cid = c.category_id === null ? "none" : String(c.category_id);
      cur.add(`${c.entity_type}:${cid}`);
    });
    setSelected(cur);
  }, [open, group]);

  const toggle = (entityType, cidKey) => {
    const key = `${entityType}:${cidKey}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    const access = [];
    selected.forEach((key) => {
      const [entityType, cidKey] = key.split(":");
      access.push({
        entity_type: entityType,
        category_id: cidKey === "none" ? null : Number(cidKey),
      });
    });
    setBusy(true);
    try {
      await setGroupAccess(group.id, access);
      toast.success("Доступ обновлён");
      onClose();
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Доступ группы: ${group.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Отметьте категории, к которым у группы будет доступ. Эксперты группы
          смогут редактировать сущности этих категорий, зрители — только
          просматривать.
        </p>

        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {ENTITY_TYPES.map((et) => {
            const cats = categoriesByType[et.key] || [];
            return (
              <div key={et.key}>
                <p className="mb-1 text-sm font-semibold text-slate-700">
                  {et.label}
                </p>
                <div className="space-y-1">
                  {/* Без категории */}
                  <CheckRow
                    label="Без категории"
                    checked={selected.has(`${et.key}:none`)}
                    onChange={() => toggle(et.key, "none")}
                  />
                  {cats.map((c) => (
                    <CheckRow
                      key={c.id}
                      label={c.name}
                      checked={selected.has(`${et.key}:${c.id}`)}
                      onChange={() => toggle(et.key, String(c.id))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
