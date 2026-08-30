import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ListChecks, Save } from "lucide-react";
import {
  fetchAgents,
  fetchRules,
  fetchSkills,
  saveRuleAssignments,
  saveSkillAssignments,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import ItemAssignmentPicker from "../components/ItemAssignmentPicker.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import useFlash from "../lib/useFlash.js";
import { sortByLabel } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

function skillAssignKey(skill) {
  return `${skill.scope}/${skill.id}`;
}

function mapWithAgent(items, selectedIds, agentId, keyOf) {
  const assignments = {};
  for (const item of items) {
    const key = keyOf(item);
    const others = (item.agents || []).filter((id) => id !== agentId);
    assignments[key] = selectedIds.includes(key) ? [...others, agentId] : others;
  }
  return assignments;
}

export default function AgentAssignmentsPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [agent, setAgent] = useState(null);
  const [rules, setRules] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [selectedSkillKeys, setSelectedSkillKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agentList, ruleList, skillList] = await Promise.all([
          fetchAgents(),
          fetchRules(),
          fetchSkills(),
        ]);
        if (cancelled) return;
        const found = (agentList || []).find((item) => item.id === agentId);
        if (!found) {
          setError(t("agents.notFound"));
          return;
        }
        const nextRules = ruleList || [];
        const nextSkills = skillList || [];
        setAgent(found);
        setRules(nextRules);
        setSkills(nextSkills);
        setSelectedRuleIds(
          nextRules
            .filter((rule) => (rule.agents || []).includes(agentId))
            .map((rule) => rule.id),
        );
        setSelectedSkillKeys(
          nextSkills
            .filter((skill) => (skill.agents || []).includes(agentId))
            .map(skillAssignKey),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? failMessage(err, t, "common.failedToLoad")
              : t("common.failedToLoad"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, t]);

  const ruleItems = useMemo(
    () =>
      sortByLabel(
        rules.map((rule) => ({
          id: rule.id,
          label: rule.name || rule.id,
          subtitle: rule.id,
        })),
        (item) => item.label,
        locale,
      ),
    [rules, locale],
  );

  const skillItems = useMemo(
    () =>
      sortByLabel(
        skills.map((skill) => ({
          id: skillAssignKey(skill),
          label: skill.name || skill.id,
          subtitle: skillAssignKey(skill),
        })),
        (item) => item.label,
        locale,
      ),
    [skills, locale],
  );

  async function handleSave(event) {
    event.preventDefault();
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        saveRuleAssignments(
          mapWithAgent(rules, selectedRuleIds, agent.id, (rule) => rule.id),
        ),
        saveSkillAssignments(
          mapWithAgent(skills, selectedSkillKeys, agent.id, skillAssignKey),
        ),
      ]);
      const savedMsg = t("assignments.saved");
      setStatus(savedMsg);
      navigate("/agents", { state: { status: savedMsg } });
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "common.saveFailed")
          : t("common.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  const title = agent
    ? t("assignments.titleNamed", { name: agentCompanyLabel(agent) })
    : t("assignments.titleFallback");

  return (
    <form
      onSubmit={handleSave}
      className="flex h-full min-h-0 flex-col gap-2"
    >
      <PageHeader
        icon={ListChecks}
        title={title}
        backTo="/agents"
        actions={
          <IconButton
            type="submit"
            icon={Save}
            disabled={saving || !agent}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("assignments.save")}
          </IconButton>
        }
      />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status ? translateKnownMessage(t, status) : status} />
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4 md:grid-cols-2">
        <ItemAssignmentPicker
          legend={t("assignments.legendRules")}
          items={ruleItems}
          selectedIds={selectedRuleIds}
          onChange={setSelectedRuleIds}
          emptyLabel={t("common.noRules")}
        />
        <ItemAssignmentPicker
          legend={t("assignments.legendSkills")}
          items={skillItems}
          selectedIds={selectedSkillKeys}
          onChange={setSelectedSkillKeys}
          emptyLabel={t("common.noSkills")}
        />
      </div>
    </form>
  );
}
