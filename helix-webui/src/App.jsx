import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ApiStatusProvider } from "./context/ApiStatusContext.jsx";
import { I18nProvider } from "./context/I18nContext.jsx";
import AboutMePage from "./pages/AboutMePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AgentAssignmentsPage from "./pages/AgentAssignmentsPage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import DbExplorerPage from "./pages/DbExplorerPage.jsx";
import DocsPage from "./pages/DocsPage.jsx";
import EditAgentPage from "./pages/EditAgentPage.jsx";
import EditRulePage from "./pages/EditRulePage.jsx";
import EditSkillPage from "./pages/EditSkillPage.jsx";
import NewAgentPage from "./pages/NewAgentPage.jsx";
import NewRulePage from "./pages/NewRulePage.jsx";
import NewSkillPage from "./pages/NewSkillPage.jsx";
import CanvasPage from "./pages/CanvasPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SkillsPage from "./pages/SkillsPage.jsx";

const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <I18nProvider>
      <ApiStatusProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<AnalysisPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="results/:resultId" element={<ResultsPage />} />
            <Route path="canvas" element={<CanvasPage />} />
            <Route path="report-design" element={<Navigate to="/canvas" replace />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="logs/:logId" element={<LogsPage />} />
            <Route path="run" element={<Navigate to="/" replace />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="rules/new" element={<NewRulePage />} />
            <Route path="rules/:ruleId" element={<EditRulePage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="skills/new" element={<NewSkillPage />} />
            <Route path="skills/:scope/:skillId" element={<EditSkillPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="agents/new" element={<NewAgentPage />} />
            <Route path="agents/:agentId/assignments" element={<AgentAssignmentsPage />} />
            <Route path="agents/:agentId" element={<EditAgentPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="db-explorer" element={<DbExplorerPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="about-me" element={<AboutMePage />} />
            <Route path="instructions" element={<Navigate to="/rules" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ApiStatusProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
