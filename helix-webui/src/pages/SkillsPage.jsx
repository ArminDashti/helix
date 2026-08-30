import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { deleteSkill, fetchSkills, updateSkill } from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import useFlash from "../lib/useFlash.js";

export default function SkillsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [skills, setSkills] = useState([]);
  const [status, setStatus] = useFlash();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const s = await fetchSkills();
    setSkills(s || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(failMessage(err, t, "common.failedToLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const rows = useMemo(
    () =>
      skills.map((skill) => ({
        key: `${skill.scope}/${skill.id}`,
        item: skill,
      })),
    [skills],
  );

  async function handleDisable(skill) {
    setError(null);
    try {
      const updated = await updateSkill(skill.scope, skill.id, {
        disabled: !skill.disabled,
      });
      setSkills((prev) =>
        prev.map((s) =>
          s.scope === skill.scope && s.id === skill.id ? updated : s,
        ),
      );
      setStatus(
        updated.disabled
          ? t("common.disabledNamed", { name: updated.id })
          : t("common.enabledNamed", { name: updated.id }),
      );
    } catch (err) {
      setError(failMessage(err, t, "common.updateFailed"));
    }
  }

  async function handleDelete(skill) {
    if (!window.confirm(t("skills.deleteConfirm", { id: skill.id }))) return;
    setError(null);
    try {
      await deleteSkill(skill.scope, skill.id);
      setSkills((prev) =>
        prev.filter((s) => !(s.scope === skill.scope && s.id === skill.id)),
      );
      setStatus(t("skills.deleted"));
    } catch (err) {
      setError(failMessage(err, t, "common.deleteFailed"));
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "id",
        label: t("common.idUpper"),
        render: (skill) => (
          <span className="font-sans text-[13px]">{skill.id}</span>
        ),
      },
      {
        key: "name",
        label: t("common.name"),
        render: (skill) => skill.name || skill.id,
      },
      {
        key: "edit",
        label: t("common.edit"),
        render: (skill) => (
          <IconButton
            type="button"
            icon={Pencil}
            onClick={() =>
              navigate(
                `/skills/${encodeURIComponent(skill.scope)}/${encodeURIComponent(skill.id)}`,
              )
            }
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("common.edit")}
          </IconButton>
        ),
      },
      {
        key: "disable",
        label: t("common.disable"),
        render: (skill) => (
          <IconButton
            type="button"
            icon={Ban}
            onClick={() => handleDisable(skill)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {skill.disabled ? t("common.enable") : t("common.disable")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("common.delete"),
        render: (skill) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(skill)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("common.delete")}
          </IconButton>
        ),
      },
    ],
    [t, navigate],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("skills.loading")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Sparkles}
        title={t("skills.title")}
        actions={
          <Link
            to="/skills/new"
            className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {t("skills.new")}
          </Link>
        }
      />
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />
      <DataGrid columns={columns} rows={rows} emptyLabel={t("common.noSkills")} />
    </div>
  );
}
