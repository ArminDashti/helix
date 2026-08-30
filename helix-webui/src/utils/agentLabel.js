export function agentCompanyLabel(agent) {
  if (!agent) return "";
  const role = String(agent.name || agent.role || "").trim();
  return role || agent.id || "";
}
