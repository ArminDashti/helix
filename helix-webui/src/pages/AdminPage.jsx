import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { createUser, deleteUser, fetchUsers, updateUser } from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";
import useFlash from "../lib/useFlash.js";
import { assetUrl } from "../utils/assetUrl.js";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const emptyUserForm = {
  username: "",
  display_name: "",
  is_admin: false,
  data_access_plain: "",
};

function isArmin(user) {
  return user?.id === "armin" || user?.username === "armin";
}

export default function AdminPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);

  async function reload() {
    const userList = await fetchUsers();
    setUsers(userList || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(failMessage(err, t, "admin.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);
  useLiveSync("users", () => reload().catch(() => {}));
  useEffect(() => {
    function onFocusVis() { if (document.visibilityState !== "hidden") reload().catch(() => {}); }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => { window.removeEventListener("focus", onFocusVis); document.removeEventListener("visibilitychange", onFocusVis); };
  }, []);

  function resetUserForm() {
    setUserForm(emptyUserForm);
    setEditingUserId(null);
  }

  async function handleSaveUser(event) {
    event.preventDefault();
    setError(null);
    try {
      const payload = {
        username: userForm.username.trim(),
        display_name: userForm.display_name.trim(),
        is_admin: userForm.is_admin,
        data_access_plain: userForm.data_access_plain.trim(),
      };
      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setStatus(t("admin.userSaved"));
      } else {
        await createUser(payload);
        setStatus(t("admin.userCreated"));
      }
      resetUserForm();
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "admin.saveFailed"));
    }
  }

  async function handleDeleteUser(user) {
    if (isArmin(user)) {
      setError(t("admin.cannotDeleteArmin"));
      return;
    }
    if (!window.confirm(t("admin.deleteConfirm", { username: user.username }))) return;
    setError(null);
    try {
      await deleteUser(user.id);
      if (editingUserId === user.id) resetUserForm();
      setStatus(t("admin.userDeleted"));
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "admin.deleteFailed"));
    }
  }

  const userRows = useMemo(
    () => users.map((item) => ({ key: item.id, item })),
    [users],
  );

  const userColumns = useMemo(
    () => [
      { key: "username", label: t("admin.username"), render: (user) => user.username },
      {
        key: "display",
        label: t("common.name"),
        render: (user) => user.display_name,
      },
      {
        key: "admin",
        label: t("admin.isAdmin"),
        render: (user) => (user.is_admin ? t("admin.yes") : t("admin.no")),
      },
      {
        key: "access",
        label: t("admin.dataAccess"),
        render: (user) =>
          user.is_admin
            ? t("admin.dataAccessAdmin")
            : user.data_access_plain ||
              (user.allowed_tables || []).join(", ") ||
              t("common.noneDash"),
      },
      {
        key: "edit",
        label: t("common.edit"),
        render: (user) => (
          <IconButton
            type="button"
            icon={Pencil}
            onClick={() => {
              setEditingUserId(user.id);
              setUserForm({
                username: user.username,
                display_name: user.display_name,
                is_admin: Boolean(user.is_admin),
                data_access_plain: user.data_access_plain || "",
              });
            }}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("common.edit")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("common.delete"),
        render: (user) =>
          isArmin(user) ? (
            <span className="text-xs text-muted">{t("admin.defaultAdmin")}</span>
          ) : (
            <IconButton
              type="button"
              icon={Trash2}
              onClick={() => handleDeleteUser(user)}
              className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
            >
              {t("common.delete")}
            </IconButton>
          ),
      },
    ],
    [t],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("admin.loading")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Shield} title={t("admin.title")} />
      <p className="text-sm">
        <a
          href={assetUrl("docs/fa/helix-admin-guide.pdf")}
          download="helix-admin-guide-fa.pdf"
          aria-label={t("guide.downloadAria")}
          className="inline-flex items-center gap-1.5 text-moss hover:underline"
        >
          <Download className="size-4" aria-hidden />
          {t("admin.guideLink")}
        </a>
      </p>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />

      <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
        <h2 className="font-display text-base text-ink">{t("admin.users")}</h2>
        <form onSubmit={handleSaveUser} className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.username")}</span>
              <input
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, username: e.target.value }))
                }
                className={inputClass}
                required
                disabled={Boolean(editingUserId)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.displayName")}</span>
              <input
                value={userForm.display_name}
                onChange={(e) =>
                  setUserForm((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={userForm.is_admin || isArmin(userForm)}
                disabled={editingUserId === "armin" || isArmin(userForm)}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, is_admin: e.target.checked }))
                }
              />
              <span className="font-medium text-ink">{t("admin.isAdmin")}</span>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("admin.dataAccess")}</span>
            <textarea
              value={userForm.data_access_plain}
              onChange={(e) =>
                setUserForm((prev) => ({
                  ...prev,
                  data_access_plain: e.target.value,
                }))
              }
              rows={3}
              placeholder={t("admin.dataAccessPlaceholder")}
              className={inputClass}
              required={!userForm.is_admin && !isArmin(userForm)}
            />
            <span className="mt-1 block text-xs text-muted">
              {t("admin.dataAccessHint")}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <IconButton
              type="submit"
              icon={editingUserId ? Pencil : Plus}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
            >
              {editingUserId ? t("admin.saveUser") : t("admin.addUser")}
            </IconButton>
            {editingUserId ? (
              <button
                type="button"
                onClick={resetUserForm}
                className="rounded-xl border border-line px-3 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </form>
        <DataGrid columns={userColumns} rows={userRows} emptyLabel={t("admin.noUsers")} />
      </section>
    </div>
  );
}
