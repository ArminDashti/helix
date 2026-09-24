import json
import os
import tempfile
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import yaml
from django.test import SimpleTestCase, override_settings

from .agents import AGENT_IDS
from .config_loader import (
    _finalize_database,
    delete_custom_agent,
    fetch_openrouter_models,
    get_active_provider_settings,
    get_all_agent_metas,
    get_connectors,
    get_llm_base_url,
    get_llm_headers,
    get_openrouter_settings,
    get_provider,
    restore_seed_pipeline_agents,
    save_config,
    update_openrouter_settings,
    update_provider,
)


class WarehouseSettingsTests(SimpleTestCase):
    def test_sqlserver_settings_are_not_replaced_with_sqlite_sample(self):
        result = _finalize_database(
            {
                "engine": "sqlserver",
                "host": "db.internal",
                "port": 1433,
                "name": "Sales",
                "user": "sa",
                "password": "secret",
            }
        )
        self.assertEqual(result["engine"], "sqlserver")
        self.assertEqual(result["host"], "db.internal")
        self.assertEqual(result["name"], "Sales")

    def test_sqlserver_clears_leftover_sample_filename(self):
        result = _finalize_database(
            {
                "engine": "sqlserver",
                "host": "db.internal",
                "name": "helix-sample.sqlite",
            }
        )
        self.assertEqual(result["engine"], "sqlserver")
        self.assertEqual(result["name"], "")


class PipelineAgentTests(SimpleTestCase):
    def test_seed_pipeline_agents_are_listed_and_deletable(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                # MARKDOWN_FILES_DIR is overridden too: delete_custom_agent rewrites the rule and
                # skill assignment maps, and a deleted seed agent must not leak into the real store.
                with override_settings(MARKDOWN_FILES_DIR=str(Path(tmp) / "markdown-files")):
                    save_config({"pipeline_agents_restored": False, "deleted_agents": list(AGENT_IDS)})
                    restore_seed_pipeline_agents()
                    ids = {meta["id"] for meta in get_all_agent_metas()}
                    self.assertTrue(set(AGENT_IDS).issubset(ids))
                    victim = AGENT_IDS[0]
                    delete_custom_agent(victim)
                    ids_after = {meta["id"] for meta in get_all_agent_metas()}
                    self.assertNotIn(victim, ids_after)


class FourAgentPipelineTests(SimpleTestCase):
    def test_default_flow_uses_four_agent_spine(self):
        from .pipeline_graph import compile_pipeline_flow, default_pipeline_flow

        graph = compile_pipeline_flow(default_pipeline_flow())
        self.assertEqual(graph["entry"], "orchester")
        node_ids = [node["id"] for node in graph["nodes"]]
        self.assertEqual(
            node_ids,
            ["orchester", "guardian", "researcher", "final-approver"],
        )

    def test_guardian_blocks_write_prompt(self):
        from .pipeline_run import _guardian_hard_block

        blocked = _guardian_hard_block(
            "DROP TABLE Sales.Moshtary",
            {"username": "armin", "is_admin": True},
        )
        self.assertIsNotNone(blocked)

    def test_guardian_allows_grid_ask(self):
        from .pipeline_run import _guardian_hard_block

        self.assertIsNone(
            _guardian_hard_block(
                "Show top selling products as a grid",
                {"username": "guest", "is_admin": False, "is_guest": True},
            )
        )

    def test_jalali_tir_1405_gregorian_bounds(self):
        from .jalali_dates import calendar_hint_for_prompt, jalali_to_gregorian

        gy, gm, gd = jalali_to_gregorian(1405, 4, 1)
        self.assertEqual((gy, gm, gd), (2026, 6, 22))
        hint = calendar_hint_for_prompt(
            "میزان فروش پر فروش ترین کالای مرکز کرمان در تیر 1405"
        )
        self.assertIn("Sal = 1405", hint)
        self.assertIn("TarikhFaktor >= '2026-06-22'", hint)
        self.assertIn("TarikhFaktor < '2026-07-23'", hint)
        self.assertIn("YEAR(TarikhFaktor) = 1405", hint)
        self.assertIn("N'کرمان'", hint)

    def test_langgraph_pipeline_gather_then_approve(self):
        from . import markdown_store as store
        from .pipeline_run import _run_orchester

        ctx = {
            "prompt": "top products",
            "mode": "analytical_report",
            "language": "en",
            "report_type": "low",
            "actor": {"username": "armin", "is_admin": True},
            "artifacts": {},
            "step_log": [],
            "pipeline_started": 0,
        }
        by_agent: dict[str, int] = {}
        prompts: dict[str, list] = {}

        def fake_chat(agent_id, messages, tools=None, session_id=None):
            by_agent[agent_id] = by_agent.get(agent_id, 0) + 1
            prompts.setdefault(agent_id, []).append(messages)
            n = by_agent[agent_id]
            if agent_id == "guardian":
                return {
                    "role": "assistant",
                    "content": '{"result":"pass","message":"allowed"}',
                }
            if agent_id == "researcher":
                if n == 1:
                    return {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_sql",
                                "type": "function",
                                "function": {
                                    "name": "execute_select",
                                    "arguments": '{"sql":"SELECT TOP 1 1 AS n"}',
                                },
                            }
                        ],
                    }
                return {
                    "role": "assistant",
                    "content": (
                        '{"goals":"top products","what_was_done":'
                        '"SELECT returned 1 row","message":"gathered"}'
                    ),
                }
            if agent_id == "final-approver":
                return {
                    "role": "assistant",
                    "content": (
                        '{"result":"pass","gaps":[],'
                        '"text_report":"One row returned.",'
                        '"message":"ok"}'
                    ),
                }
            return {"role": "assistant", "content": "{}"}

        with patch(
            "api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat
        ):
            with patch("api.pipeline_run.execute_select") as exe:
                exe.return_value = {
                    "sql": "SELECT TOP 1 1 AS n",
                    "columns": ["n"],
                    "rows": [{"n": 1}],
                }
                with patch.object(
                    store, "assemble_agent_prompt", return_value="system"
                ):
                    with patch.object(
                        store,
                        "list_rag_docs",
                        return_value=[
                            {
                                "id": "top-products-notes",
                                "title": "Top products notes",
                                "content": "Top products are ranked by line total.",
                                "tokens": 12,
                            }
                        ],
                    ):
                        status, message = _run_orchester(ctx)
        self.assertEqual(status, "done")
        self.assertIn("ok", message.lower())
        self.assertIsNotNone(ctx.get("final_payload"))
        self.assertEqual(ctx["final_payload"]["text_report"], "One row returned.")
        self.assertGreaterEqual(by_agent.get("researcher", 0), 1)
        self.assertGreaterEqual(by_agent.get("final-approver", 0), 1)
        # The knowledge document matching the prompt rides along with the researcher's system
        # prompt, and both the run totals and the payload carry what the run cost.
        researcher_system = str(prompts["researcher"][0][0]["content"])
        self.assertIn("Retrieved knowledge", researcher_system)
        self.assertIn("Top products notes", researcher_system)
        self.assertEqual(ctx["rag"]["docs"], ["top-products-notes"])
        self.assertGreater(ctx["rag"]["tokens"], 0)
        self.assertEqual(
            ctx["final_payload"]["token_usage"]["calls"], sum(by_agent.values())
        )
        self.assertGreater(ctx["final_payload"]["token_usage"]["total_tokens"], 0)

    def test_orchester_sql_error_stays_in_tool_result(self):
        from .pipeline_run import _dispatch_tool

        ctx = {
            "prompt": "top products",
            "mode": "grid",
            "language": "en",
            "actor": {"username": "armin", "is_admin": True},
            "artifacts": {},
        }
        with patch("api.pipeline_run.execute_select") as exe:
            exe.side_effect = ValueError("Invalid object name")
            result_json, done = _dispatch_tool(
                "execute_select", {"sql": "SELECT 1"}, ctx
            )
        self.assertFalse(done)
        self.assertIn("Invalid object name", result_json)
        self.assertIn("Invalid object name", ctx.get("last_error") or "")

    def test_orchester_user_message_includes_calendar_hint(self):
        from .pipeline_run import _build_user_message

        ctx = {
            "prompt": "تیر 1405 کرمان",
            "mode": "grid",
            "language": "fa",
            "actor": {"username": "armin", "is_admin": True},
            "db_intent": {"found": False, "checked_tables": []},
        }
        user = _build_user_message(ctx)
        self.assertIn("TarikhFaktor >= '2026-06-22'", user)

    def test_orchester_hard_block_without_llm(self):
        from .pipeline_run import _run_orchester

        ctx = {
            "prompt": "DROP TABLE Sales.Moshtary",
            "mode": "grid",
            "language": "en",
            "actor": {"username": "armin", "is_admin": True},
            "artifacts": {},
            "step_log": [],
        }
        with patch("api.pipeline_langgraph.complete_chat_messages") as chat:
            status, message = _run_orchester(ctx)
        chat.assert_not_called()
        self.assertEqual(status, "fail")
        self.assertIn("not allowed", message.lower())

    def test_orchester_self_retry_edge_on_failure(self):
        from .pipeline_graph import compile_pipeline_flow, default_pipeline_flow, next_edge

        graph = compile_pipeline_flow(default_pipeline_flow())
        edge = next_edge(graph, "orchester", "fail", {})
        self.assertIsNone(edge)
        self.assertEqual(graph["entry"], "orchester")

    def test_default_edge_limit_is_one(self):
        from .pipeline_graph import DEFAULT_EDGE_LIMIT, compile_pipeline_flow, default_pipeline_flow

        self.assertEqual(DEFAULT_EDGE_LIMIT, 1)
        graph = compile_pipeline_flow(default_pipeline_flow())
        for edge in graph.get("edges") or []:
            self.assertLessEqual(edge.get("limit", DEFAULT_EDGE_LIMIT), 1)

    def test_research_flow_matches_default_seed(self):
        from .pipeline_graph import compile_pipeline_flow, default_pipeline_flow, research_pipeline_flow

        default_graph = compile_pipeline_flow(default_pipeline_flow())
        research_graph = compile_pipeline_flow(research_pipeline_flow())
        self.assertEqual(research_graph["entry"], "orchester")
        self.assertEqual(
            [n["id"] for n in research_graph["nodes"]],
            [n["id"] for n in default_graph["nodes"]],
        )

    def test_four_agents_registered_in_roster(self):
        for agent_id in (
            "orchester",
            "guardian",
            "researcher",
            "final-approver",
        ):
            self.assertIn(agent_id, AGENT_IDS)

    def test_web_searcher_registered_as_sub_agent(self):
        from .agents import SUB_AGENT_IDS, is_sub_agent
        from .config_loader import get_all_agent_metas

        self.assertIn("web-searcher", SUB_AGENT_IDS)
        self.assertTrue(is_sub_agent("web-searcher"))
        ids = {meta["id"] for meta in get_all_agent_metas()}
        self.assertIn("web-searcher", ids)

    def test_sub_agent_blocked_from_pipeline_graph(self):
        from .pipeline_graph import default_pipeline_graph, normalize_pipeline_graph

        graph = default_pipeline_graph()
        with self.assertRaises(ValueError):
            normalize_pipeline_graph(
                {
                    "entry": "web-searcher",
                    "nodes": [
                        {"id": "web-searcher", "position": {"x": 0, "y": 0}},
                        {"id": "orchester", "position": {"x": 0, "y": 100}},
                    ],
                    "edges": [
                        {
                            "id": "e1",
                            "source": "web-searcher",
                            "target": "orchester",
                            "when": {"type": "always"},
                        }
                    ],
                }
            )
        self.assertEqual(graph["entry"], "orchester")
        self.assertNotIn("web-searcher", [n["id"] for n in graph["nodes"]])

    def test_web_searcher_prompt_excludes_warehouse(self):
        from . import markdown_store as store

        with patch("api.db_dialects.list_tables", return_value=[{"schema": "Sales", "name": "Moshtary", "full_name": "Sales.Moshtary"}]):
            with patch("api.docs_catalog.format_live_catalog_for_prompt", return_value="### Sales.Moshtary"):
                prompt = store.assemble_agent_prompt("web-searcher")
        self.assertNotIn("## Live catalog", prompt)
        self.assertNotIn("Sales.Moshtary", prompt)
        self.assertIn("web-searcher", prompt.lower())

    def test_normalize_web_search_queries(self):
        from .pipeline_run import _normalize_web_search_queries

        self.assertEqual(
            _normalize_web_search_queries([" inflation ", "rates", "rates", "", 4, 5, 6]),
            ["inflation", "rates", "4"],
        )

    def test_search_web_tool_sets_brief(self):
        from .pipeline_run import _dispatch_tool

        ctx: dict = {"artifacts": {}}
        with patch("api.pipeline_run.search_web") as search:
            search.return_value = [
                {
                    "query": "retail margin",
                    "title": "Bench",
                    "url": "https://example.com",
                    "snippet": "10%",
                }
            ]
            with patch("api.pipeline_run.web_search_enabled", return_value=True):
                result_json, done = _dispatch_tool(
                    "search_web",
                    {"queries": ["retail margin"], "objective": "benchmarks"},
                    ctx,
                )
        self.assertFalse(done)
        self.assertTrue(ctx.get("_web_search_invoked"))
        self.assertIn("Bench", ctx.get("web_search_brief") or "")
        self.assertIn('"ok":true', result_json.lower().replace(" ", ""))

    def test_assemble_prompt_includes_references_section(self):
        from . import markdown_store as store

        with patch.object(store, "list_references") as refs:
            refs.return_value = [
                {"name": "tables", "content": "# tables"},
                {"name": "base-instruction", "content": "# base"},
            ]
            with patch("api.db_dialects.list_tables", return_value=[{"schema": "Sales", "name": "Moshtary", "full_name": "Sales.Moshtary"}]):
                with patch.object(store, "list_rules", return_value=[]):
                    with patch.object(store, "list_skills", return_value=[]):
                        with patch(
                            "api.docs_catalog.format_live_catalog_for_prompt",
                            return_value="### Sales.Moshtary\nColumns: ccMoshtary, NameMoshtary",
                        ):
                            prompt = store.assemble_agent_prompt("orchester")
        self.assertIn("## References", prompt)
        self.assertIn("base-instruction", prompt)
        self.assertIn("## Live catalog", prompt)
        self.assertIn("NameMoshtary", prompt)


class AgentAssetContractTests(SimpleTestCase):
    """One rule and one skill per agent, catalog-agnostic text, web search gated by config."""

    def test_every_agent_has_exactly_one_rule_and_one_skill(self):
        from . import markdown_store as store
        from .agents import SYNC_AGENT_IDS

        self.assertEqual(store.agent_asset_issues(), [])
        rules = store.list_rules()
        skills = store.list_skills()
        for agent_id in SYNC_AGENT_IDS:
            owned_rules = [rule["id"] for rule in rules if agent_id in (rule["agents"] or [])]
            owned_skills = [skill["id"] for skill in skills if agent_id in (skill["agents"] or [])]
            self.assertEqual(len(owned_rules), 1, f"{agent_id}: {owned_rules}")
            self.assertEqual(len(owned_skills), 1, f"{agent_id}: {owned_skills}")

    def test_agent_prompt_carries_one_rule_and_one_skill(self):
        from . import markdown_store as store

        for agent_id in ("orchester", "guardian", "researcher", "final-approver"):
            prompt = store.assemble_agent_prompt(agent_id, include_warehouse=False)
            self.assertEqual(prompt.count("\n### "), 2, agent_id)

    def test_rules_and_skills_name_no_specific_catalog(self):
        from . import markdown_store as store

        banned = ("SalesLT", "AdventureWorks", "MarkazPakhsh", "TarikhFaktor", "DarkhastFaktor")
        texts = {f"rule {rule['id']}": rule.get("content") or "" for rule in store.list_rules()}
        texts.update(
            {
                f"skill {skill['scope']}/{skill['id']}": skill.get("content") or ""
                for skill in store.list_skills()
            }
        )
        for name, text in texts.items():
            for token in banned:
                self.assertNotIn(token, text, f"{name} hardcodes {token}")

    @staticmethod
    def _ui_i18n_dir() -> Path | None:
        """Locate the web UI i18n directory, in-repo or via the Docker /host mount."""
        from django.conf import settings as dj_settings

        base = Path(dj_settings.BASE_DIR)
        candidates = [
            base.parent.parent / "helix-webui" / "src" / "i18n",
            base.parent / "helix-webui" / "src" / "i18n",
        ]
        host = Path("/host")
        if host.is_dir():
            candidates += sorted(host.glob("*/GitHub/*/helix-webui/src/i18n"))
        for path in candidates:
            if path.is_dir():
                return path
        return None

    def test_no_agent_asset_or_ui_string_names_a_warehouse(self):
        """The data target is whatever Settings points at, so the wording stays generic.

        "warehouse" (and its Persian equivalent) must not appear in the shipped agent assets — AGENT.md,
        rules, skills, the schema reference — in the assembled runtime prompts, or in the web UI
        strings. Knowledge documents the operator writes under `markdown-files/rag/` and stored run
        history are user data, not product wording, and are not scanned.
        """
        from django.conf import settings as dj_settings

        from . import markdown_store as store

        banned = ("warehouse", "انبار")
        md_root = Path(dj_settings.MARKDOWN_FILES_DIR)
        roots = [
            Path(dj_settings.AGENTS_DIR),
            md_root / "instructions",
            md_root / "rules",
            md_root / "skills",
            md_root / "references",
        ]
        ui_i18n = self._ui_i18n_dir()
        if ui_i18n is not None:
            roots.append(ui_i18n)

        scanned = 0
        for root in roots:
            if not root.is_dir():
                continue
            for path in sorted(root.rglob("*")):
                if not path.is_file() or path.suffix not in (".md", ".json"):
                    continue
                scanned += 1
                text = path.read_text(encoding="utf-8", errors="replace").lower()
                for token in banned:
                    self.assertNotIn(token, text, f"{path} names a {token}")
        self.assertGreater(scanned, 0, "no agent assets were scanned")

        with patch(
            "api.db_dialects.list_tables",
            return_value=[{"schema": "Sales", "name": "Moshtary", "full_name": "Sales.Moshtary"}],
        ):
            with patch("api.docs_catalog.format_live_catalog_for_prompt", return_value="### Sales.Moshtary"):
                prompts = {
                    agent_id: store.assemble_agent_prompt(agent_id)
                    for agent_id in ("orchester", "guardian", "researcher", "final-approver", "web-searcher")
                }
        for agent_id, prompt in prompts.items():
            for token in banned:
                self.assertNotIn(token, prompt.lower(), f"{agent_id} prompt names a {token}")

    def test_web_search_tool_follows_the_disabled_agent_list(self):
        from . import markdown_store as store  # noqa: F401  (ensures dirs exist)
        from .config_loader import save_config
        from .pipeline_run import active_tools

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"disabled_agents": ["web-searcher"]})
                off = [tool["function"]["name"] for tool in active_tools()]
                self.assertNotIn("search_web", off)
                self.assertIn("execute_select", off)
                self.assertEqual(
                    [tool["function"]["name"] for tool in active_tools(("execute_select", "search_web"))],
                    ["execute_select"],
                )
                save_config({"disabled_agents": []})
                on = [tool["function"]["name"] for tool in active_tools()]
                self.assertIn("search_web", on)

    def test_disabled_web_search_cannot_be_dispatched(self):
        from .pipeline_run import _dispatch_tool

        ctx: dict = {"artifacts": {}}
        with patch("api.pipeline_run.web_search_enabled", return_value=False):
            with patch("api.pipeline_run.search_web") as search:
                payload, done = _dispatch_tool("search_web", {"queries": ["x"]}, ctx)
        self.assertFalse(done)
        self.assertIn("disabled", payload)
        search.assert_not_called()


class DocsCatalogPromptTests(SimpleTestCase):
    def test_filter_tables_reference_keeps_matching_sections_only(self):
        from .docs_catalog import filter_tables_reference

        md = (
            "# Generic\n\n"
            "## Sales.Moshtary\n\n| Column | Description |\n| ccMoshtary | id |\n\n"
            "## Missing.Table\n\n| Column | Description |\n| x | y |\n"
        )
        filtered = filter_tables_reference(md, {"Sales.Moshtary"})
        self.assertIn("Sales.Moshtary", filtered)
        self.assertNotIn("Missing.Table", filtered)

    def test_format_live_catalog_lists_columns(self):
        from . import docs_catalog

        with patch.object(
            docs_catalog.db_sql,
            "list_tables",
            return_value=[{"schema": "SalesLT", "name": "Product", "full_name": "SalesLT.Product"}],
        ):
            with patch.object(
                docs_catalog.db_sql,
                "list_columns",
                return_value=[{"name": "ProductID"}, {"name": "Name"}],
            ):
                with patch.object(docs_catalog, "_docs_markdown", return_value=""):
                    text = docs_catalog.format_live_catalog_for_prompt(max_tables=5)
        self.assertIn("SalesLT.Product", text)
        self.assertIn("ProductID", text)
        self.assertIn("Name", text)


class LlmSettingsTests(SimpleTestCase):
    def test_cursor_provider_migrates_to_openai_compatible(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "cursor"})
                self.assertEqual(get_provider(), "openai_compatible")
                raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
                self.assertEqual(raw.get("provider"), "openai_compatible")
                with self.assertRaises(ValueError):
                    update_provider("cursor")

    def test_cursor_headless_cli_provider_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            workspace = Path(tmp) / "ws"
            workspace.mkdir()
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "cursor_headless_cli",
                        "openrouter": {"workspace": str(workspace)},
                    }
                )
                self.assertEqual(get_provider(), "cursor_headless_cli")
                self.assertEqual(update_provider("cursor_headless_cli"), "cursor_headless_cli")
                settings = get_openrouter_settings()
                self.assertEqual(settings["workspace"], str(workspace))

    def test_host_workspace_path_is_usable_without_local_dir(self):
        from .llm_client import is_usable_workspace

        self.assertTrue(is_usable_workspace("C:/Users/armin/GitHub/helix"))
        self.assertTrue(is_usable_workspace(r"\\server\share\proj"))
        self.assertFalse(is_usable_workspace("relative/path"))

    def test_map_host_workspace_rewrites_under_root(self):
        from . import llm_client

        with patch.dict(
            os.environ,
            {
                "HOST_WORKSPACE_ROOT": "C:/Users",
                "HOST_WORKSPACE_MOUNT": "/host",
            },
            clear=False,
        ):
            # Path must not exist on this machine so rewrite applies (Docker case).
            mapped = llm_client.map_host_workspace("C:/Users/nobody/proj-xyz")
            self.assertEqual(mapped, "/host/nobody/proj-xyz")
            self.assertEqual(
                llm_client.map_host_workspace("D:/other/proj"),
                "D:/other/proj",
            )

    def test_openai_compatible_requires_stored_base_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "openai_compatible", "openrouter": {}})
                self.assertEqual(get_provider(), "openai_compatible")
                self.assertEqual(get_llm_base_url(), "")
                self.assertEqual(get_openrouter_settings()["base_url"], "")

    def test_workspace_persists_and_returns_in_settings(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "openai_compatible",
                        "openrouter": {
                            "base_url": "http://127.0.0.1:8081/v1",
                        },
                    }
                )
                update_openrouter_settings(
                    {
                        "workspace": "C:/Users/armin/GitHub/helix",
                        "mode": "agent",
                    }
                )
                settings = get_openrouter_settings()
                self.assertEqual(
                    settings["workspace"], "C:/Users/armin/GitHub/helix"
                )
                self.assertEqual(settings["mode"], "agent")
                # ask/plan coerce to agent on read/write
                update_openrouter_settings({"mode": "ask"})
                self.assertEqual(get_openrouter_settings()["mode"], "agent")
                raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
                self.assertEqual(
                    raw["openrouter"]["workspace"], "C:/Users/armin/GitHub/helix"
                )
                self.assertEqual(raw["openrouter"]["mode"], "agent")

    def test_openrouter_defaults_base_url_and_saves_custom(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "openrouter"})
                self.assertEqual(
                    get_llm_base_url(), "https://openrouter.ai/api/v1"
                )
                update_provider("openai_compatible")
                update_openrouter_settings(
                    {"base_url": "https://api.openai.com/v1/"}
                )
                self.assertEqual(get_provider(), "openai_compatible")
                self.assertEqual(get_llm_base_url(), "https://api.openai.com/v1")

    def test_host_docker_internal_falls_back_when_unresolvable(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "openai_compatible",
                        "openrouter": {
                            "base_url": "http://host.docker.internal:8140/v1"
                        },
                    }
                )
                with patch(
                    "api.config_loader.socket.getaddrinfo",
                    side_effect=OSError(11001, "getaddrinfo failed"),
                ):
                    self.assertEqual(
                        get_llm_base_url(), "http://127.0.0.1:8140/v1"
                    )

    def test_unresolvable_container_hostname_falls_back_to_localhost(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "openai_compatible",
                        "openrouter": {
                            "base_url": "http://cursor-openai-adapter-api:8140/v1"
                        },
                    }
                )
                with patch(
                    "api.config_loader.socket.getaddrinfo",
                    side_effect=OSError(11001, "getaddrinfo failed"),
                ):
                    self.assertEqual(
                        get_llm_base_url(),
                        "http://127.0.0.1:8140/v1",
                    )

    def test_opencode_go_connector_is_selectable_and_owns_its_endpoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "openrouter"})
                self.assertEqual(update_provider("opencode_go"), "opencode_go")
                self.assertEqual(get_provider(), "opencode_go")
                self.assertEqual(
                    get_llm_base_url(), "https://opencode.ai/zen/go/v1"
                )
                settings = get_openrouter_settings()
                self.assertEqual(
                    settings["base_url"], "https://opencode.ai/zen/go/v1"
                )
                self.assertEqual(settings["default_model"], "deepseek-v4-flash")
                self.assertEqual(
                    settings["agents"]["orchester"]["model"], "deepseek-v4-flash"
                )

    def test_connector_catalog_labels_the_opencode_go_connector(self):
        connectors = {entry["id"]: entry for entry in get_connectors()}
        self.assertEqual(connectors["opencode_go"]["label"], "OpenCode-Go")
        # API key only: the endpoint is the vendor's, so the form never asks for it.
        self.assertFalse(connectors["opencode_go"]["asks_base_url"])
        self.assertFalse(connectors["opencode_go"]["asks_workspace"])
        self.assertTrue(connectors["opencode_go"]["api_key_required"])
        self.assertNotIn("token", connectors["opencode_go"])

    def test_provider_settings_expose_the_connector_catalog(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                payload = get_active_provider_settings()
                self.assertEqual(payload["provider"], "opencode_go")
                ids = [entry["id"] for entry in payload["connectors"]]
                self.assertIn("opencode_go", ids)
                self.assertIn("openrouter", ids)

    def test_switching_connector_keeps_user_typed_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "openrouter",
                        "openrouter": {
                            "base_url": "https://openrouter.ai/api/v1",
                            "default_model": "my-model",
                            "agents": {"orchester": {"model": "my-model"}},
                        },
                    }
                )
                update_provider("opencode_go")
                raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
                self.assertEqual(
                    raw["openrouter"]["base_url"], "https://opencode.ai/zen/go/v1"
                )
                self.assertEqual(raw["openrouter"]["default_model"], "my-model")
                self.assertEqual(
                    raw["openrouter"]["agents"]["orchester"]["model"], "my-model"
                )
                self.assertEqual(raw["openrouter"]["token_env"], "OPENCODE_GO_API_KEY")

    def test_switching_away_from_a_managed_endpoint_clears_the_stale_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings({"token": "sk-test"})
                self.assertEqual(
                    get_llm_base_url(), "https://opencode.ai/zen/go/v1"
                )
                update_provider("openai_compatible")
                self.assertEqual(get_llm_base_url(), "")
                self.assertEqual(get_openrouter_settings()["base_url"], "")

    def test_opencode_go_pins_its_base_url_when_settings_are_saved(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings(
                    {
                        "base_url": "http://localhost:9999/v1",
                        "token": "sk-test",
                        "default_model": "kimi-k3",
                    }
                )
                settings = get_openrouter_settings()
                self.assertEqual(
                    settings["base_url"], "https://opencode.ai/zen/go/v1"
                )
                self.assertEqual(settings["default_model"], "kimi-k3")
                self.assertTrue(settings["token_configured"])


    def test_opencode_go_requests_carry_a_user_agent(self):
        """Cloudflare answers urllib's default User-Agent with 403/1010 on opencode.ai."""
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings({"token": "sk-test"})
                self.assertTrue(get_llm_headers()["User-Agent"])
                captured = {}

                class _Response:
                    def __enter__(self):
                        return self

                    def __exit__(self, *exc):
                        return False

                    def read(self):
                        return json.dumps(
                            {"data": [{"id": "deepseek-v4-flash"}]}
                        ).encode("utf-8")

                def _fake_urlopen(request, timeout=None):
                    captured["headers"] = {
                        key.lower(): value for key, value in request.header_items()
                    }
                    captured["url"] = request.full_url
                    return _Response()

                with patch(
                    "api.config_loader._MODELS_CACHE",
                    {"fetched_at": 0.0, "models": [], "base_url": ""},
                ), patch("api.config_loader.urllib.request.urlopen", _fake_urlopen):
                    models = fetch_openrouter_models(force=True)

                self.assertEqual(
                    captured["url"], "https://opencode.ai/zen/go/v1/models"
                )
                self.assertIn("user-agent", captured["headers"])
                self.assertEqual(
                    captured["headers"]["authorization"], "Bearer sk-test"
                )
                self.assertIn("deepseek-v4-flash", [m["id"] for m in models])


    def test_settings_flow_switches_connector_then_saves_the_key(self):
        """The Settings form PUTs provider first, then the section — the order the webui uses."""
        from django.test import Client

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "openrouter"})
                client = Client()

                response = client.put(
                    "/api/admin/provider/",
                    data=json.dumps({"provider": "opencode_go"}),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 200)
                provider_payload = response.json()
                self.assertEqual(provider_payload["provider"], "opencode_go")
                self.assertIn(
                    "opencode_go",
                    [c["id"] for c in provider_payload["connectors"]],
                )

                response = client.put(
                    "/api/admin/openrouter/",
                    data=json.dumps({"openrouter": {"token": "sk-test"}}),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 200)
                settings = response.json()["openrouter"]
                self.assertEqual(
                    settings["base_url"], "https://opencode.ai/zen/go/v1"
                )
                self.assertEqual(settings["default_model"], "deepseek-v4-flash")
                self.assertTrue(settings["token_configured"])


    def test_opencode_go_chat_request_carries_the_connector_headers(self):
        from .llm_client import complete_chat_messages

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings({"token": "sk-test"})
                captured = {}

                class _Response:
                    def __enter__(self):
                        return self

                    def __exit__(self, *exc):
                        return False

                    def read(self):
                        return json.dumps(
                            {"choices": [{"message": {"content": "pong"}}]}
                        ).encode("utf-8")

                def _fake_urlopen(request, timeout=None):
                    captured["headers"] = {
                        key.lower(): value for key, value in request.header_items()
                    }
                    captured["url"] = request.full_url
                    captured["body"] = json.loads(request.data.decode("utf-8"))
                    return _Response()

                with patch("api.llm_client.urllib.request.urlopen", _fake_urlopen):
                    message = complete_chat_messages(
                        "orchester", [{"role": "user", "content": "ping"}]
                    )

                self.assertEqual(message["content"], "pong")
                self.assertEqual(
                    captured["url"],
                    "https://opencode.ai/zen/go/v1/chat/completions",
                )
                self.assertIn("user-agent", captured["headers"])
                self.assertEqual(
                    captured["headers"]["authorization"], "Bearer sk-test"
                )
                self.assertEqual(captured["body"]["model"], "deepseek-v4-flash")

    def test_opencode_go_chat_request_carries_a_session_header(self):
        """Go answers a request with no x-opencode-session with 400 MissingSessionID."""
        from .llm_client import complete_chat_messages

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings({"token": "sk-test"})
                sent: list[dict[str, str]] = []

                class _Response:
                    def __enter__(self):
                        return self

                    def __exit__(self, *exc):
                        return False

                    def read(self):
                        return json.dumps(
                            {"choices": [{"message": {"content": "pong"}}]}
                        ).encode("utf-8")

                def _fake_urlopen(request, timeout=None):
                    sent.append(
                        {key.lower(): value for key, value in request.header_items()}
                    )
                    return _Response()

                with patch("api.llm_client.urllib.request.urlopen", _fake_urlopen):
                    complete_chat_messages(
                        "guardian",
                        [{"role": "user", "content": "ping"}],
                        session_id="run-1",
                    )
                    complete_chat_messages(
                        "researcher",
                        [{"role": "user", "content": "ping"}],
                        session_id="run-1",
                    )
                    complete_chat_messages(
                        "orchester", [{"role": "user", "content": "ping"}]
                    )

                # One run is one conversation: every agent call in it shares the id, and Go can
                # route and cache the run together.
                self.assertEqual(sent[0]["x-opencode-session"], "run-1")
                self.assertEqual(sent[1]["x-opencode-session"], "run-1")
                # A call with no conversation of its own still sends a routable session.
                self.assertTrue(sent[2]["x-opencode-session"])

    def test_opencode_go_models_request_carries_a_session_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go"})
                update_openrouter_settings({"token": "sk-test"})
                captured = {}

                class _Response:
                    def __enter__(self):
                        return self

                    def __exit__(self, *exc):
                        return False

                    def read(self):
                        return json.dumps({"data": []}).encode("utf-8")

                def _fake_urlopen(request, timeout=None):
                    captured["headers"] = {
                        key.lower(): value for key, value in request.header_items()
                    }
                    return _Response()

                with patch(
                    "api.config_loader._MODELS_CACHE",
                    {"fetched_at": 0.0, "models": [], "base_url": ""},
                ), patch("api.config_loader.urllib.request.urlopen", _fake_urlopen):
                    fetch_openrouter_models(force=True)

                self.assertTrue(captured["headers"]["x-opencode-session"])

    def test_per_agent_models_survive_a_settings_round_trip(self):
        """The Settings form PUTs back what it was given, so no known agent may be missing."""
        from .config_loader import get_agent_model

        agents = ("guardian", "researcher", "final-approver")
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "provider": "opencode_go",
                        "openrouter": {
                            "base_url": "https://opencode.ai/zen/go/v1",
                            "default_model": "deepseek-v4.1-flash",
                            "agents": {
                                agent_id: {"model": "deepseek-v4.1-flash"}
                                for agent_id in agents
                            },
                        },
                    }
                )

                settings = get_openrouter_settings()
                for agent_id in agents:
                    self.assertEqual(
                        settings["agents"][agent_id]["model"],
                        "deepseek-v4.1-flash",
                    )

                update_openrouter_settings({"agents": settings["agents"]})
                raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
                for agent_id in agents:
                    self.assertEqual(
                        raw["openrouter"]["agents"][agent_id]["model"],
                        "deepseek-v4.1-flash",
                    )
                    self.assertEqual(get_agent_model(agent_id), "deepseek-v4.1-flash")

    def test_agent_without_its_own_model_follows_the_connector_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config({"provider": "opencode_go", "openrouter": {}})
                settings = get_openrouter_settings()
                self.assertEqual(
                    settings["agents"]["final-approver"]["model"],
                    "deepseek-v4-flash",
                )


class _PauseSpoolMixin:
    """Keep parked-run spool files out of the machine's real temp dir."""

    def _isolate_pause_spool(self):
        from . import run_store

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        patcher = patch.object(run_store, "SPOOL_DIR", Path(tmp.name))
        patcher.start()
        self.addCleanup(patcher.stop)
        run_store._PAUSED.clear()
        self.addCleanup(run_store._PAUSED.clear)


class PausedRunStoreTests(_PauseSpoolMixin, SimpleTestCase):
    """A parked run must be answerable from a request that did not park it."""

    def setUp(self):
        self._isolate_pause_spool()

    def test_a_paused_run_outlives_the_process_that_parked_it(self):
        from . import run_store

        ctx = {"run_id": "run-spool-1", "prompt": "hi", "clarifications": []}
        run_store.pause_run(
            ctx,
            agent_id="guardian",
            node="guardian",
            questions=[{"id": "q1", "text": "Which cost column?"}],
        )
        # Another worker (or a restart): the in-memory registry is gone, the spool is not.
        run_store._PAUSED.clear()

        item = run_store.pop_paused("run-spool-1")
        self.assertIsNotNone(item)
        self.assertEqual(item["agent_id"], "guardian")
        self.assertEqual(item["node"], "guardian")
        self.assertEqual(item["questions"][0]["id"], "q1")
        self.assertEqual(item["ctx"]["prompt"], "hi")
        # Consumed once: answering again must not replay the run.
        self.assertIsNone(run_store.pop_paused("run-spool-1"))

    def test_unknown_expired_and_hostile_run_ids_are_refused(self):
        from . import run_store

        self.assertIsNone(run_store.pop_paused(""))
        self.assertIsNone(run_store.pop_paused("never-parked"))
        # run_id comes from the request path and names a file: it must not escape the spool dir.
        self.assertIsNone(run_store.pop_paused("../../etc/passwd"))
        self.assertIsNone(run_store.peek_paused("..\\..\\windows\\system32"))

        run_store.pause_run(
            {"run_id": "run-ttl-1"},
            agent_id="researcher",
            node="researcher",
            questions=[],
        )
        with patch.object(run_store, "PAUSE_TTL_SECONDS", -1.0):
            self.assertIsNone(run_store.pop_paused("run-ttl-1"))


class OperatorQuestionTests(_PauseSpoolMixin, SimpleTestCase):
    """A run can stop and ask the operator; the answer resumes the node that asked."""

    def setUp(self):
        self._isolate_pause_spool()

    def _ctx(self, **overrides):
        ctx = {
            "prompt": "top products",
            "mode": "analytical_report",
            "language": "en",
            "report_type": "low",
            "actor": {"username": "armin", "is_admin": True},
            "artifacts": {},
            "step_log": [],
            "pipeline_started": 0,
            "run_id": uuid.uuid4().hex,
        }
        ctx.update(overrides)
        return ctx

    @staticmethod
    def _drain(ctx, entry=None):
        from .pipeline_run import _orchester_events

        return list(_orchester_events(ctx, entry=entry))

    @staticmethod
    def _resume(run_id, answers):
        from .pipeline_run import resume_pipeline_events

        events = []
        for chunk in resume_pipeline_events(run_id, answers):
            line = chunk.strip()
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
        return events

    @staticmethod
    def _researcher_script():
        """Researcher turns: one SELECT, then the completion JSON."""
        return [
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "r1",
                        "type": "function",
                        "function": {
                            "name": "execute_select",
                            "arguments": json.dumps({"sql": "SELECT TOP 1 1 AS n"}),
                        },
                    }
                ],
            },
            {
                "role": "assistant",
                "content": '{"goals":"g","what_was_done":"SELECT 1 row","message":"gathered"}',
            },
        ]

    def _chat(self, answers, seen=None):
        """Fake LLM. ``answers`` maps agent id to responses consumed in call order.

        ``seen`` collects each call's message list per agent, for assertions on what a prompt
        actually carried.
        """
        counters: dict[str, int] = {}

        def fake_chat(agent_id, messages, tools=None, session_id=None):
            if seen is not None:
                seen.setdefault(agent_id, []).append(list(messages))
            queue = answers.get(agent_id) or [{"role": "assistant", "content": "{}"}]
            index = counters.get(agent_id, 0)
            counters[agent_id] = index + 1
            return queue[min(index, len(queue) - 1)]

        return fake_chat

    @staticmethod
    def _user_prompt(messages) -> str:
        """First user turn of a node's prompt (the pipeline brief)."""
        for msg in messages:
            if msg.get("role") == "user":
                return str(msg.get("content") or "")
        return ""

    SELECT = {"sql": "SELECT TOP 1 1 AS n", "columns": ["n"], "rows": [{"n": 1}]}
    PASS_GUARDIAN = {"role": "assistant", "content": '{"result":"pass","message":"allowed"}'}
    APPROVE = {
        "role": "assistant",
        "content": '{"result":"pass","gaps":[],"text_report":"One row.","message":"ok"}',
    }

    def test_orchester_asks_before_the_run_and_the_answer_starts_it(self):
        from . import markdown_store as store
        from . import run_store

        ctx = self._ctx()
        seen: dict[str, list] = {}
        fake_chat = self._chat(
            {
                "orchester": [
                    {
                        "role": "assistant",
                        "content": '{"questions":["Which period should the report cover?"]}',
                    },
                    {"role": "assistant", "content": "{}"},
                ],
                "guardian": [self.PASS_GUARDIAN],
                "researcher": self._researcher_script(),
                "final-approver": [self.APPROVE],
            },
            seen,
        )

        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    events = self._drain(ctx)

        questions = [event for event in events if event.get("event") == "question"]
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["agent_id"], "orchester")
        self.assertEqual(questions[0]["run_id"], ctx["run_id"])
        self.assertEqual([q["id"] for q in questions[0]["questions"]], ["q1"])
        self.assertIn("period", questions[0]["questions"][0]["text"])
        # Parked, not finished: no result yet, and the run is waiting for an answer.
        self.assertNotIn("result", [event.get("event") for event in events])
        self.assertNotIn("researcher", seen)
        self.assertIsNotNone(run_store.peek_paused(ctx["run_id"]))

        seen.clear()
        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    resumed = self._resume(ctx["run_id"], {"q1": "last quarter"})

        self.assertEqual(resumed[-1]["event"], "result")
        self.assertEqual(
            ctx["clarifications"],
            [{"question": "Which period should the report cover?", "answer": "last quarter"}],
        )
        # The answer reaches the agents that run after the pause.
        self.assertIn("last quarter", self._user_prompt(seen["researcher"][-1]))
        self.assertIsNone(run_store.peek_paused(ctx["run_id"]))

    def test_researcher_asks_mid_run_and_resumes_its_own_tool_loop(self):
        from . import markdown_store as store

        ctx = self._ctx()
        seen: dict[str, list] = {}
        fake_chat = self._chat(
            {
                "orchester": [{"role": "assistant", "content": "{}"}],
                "guardian": [self.PASS_GUARDIAN],
                "researcher": [
                    {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "c1",
                                "type": "function",
                                "function": {
                                    "name": "ask_operator",
                                    "arguments": json.dumps({"question": "Which region?"}),
                                },
                            }
                        ],
                    },
                    *self._researcher_script(),
                ],
                "final-approver": [self.APPROVE],
            },
            seen,
        )

        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    events = self._drain(ctx)

        questions = [event for event in events if event.get("event") == "question"]
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["agent_id"], "researcher")
        self.assertEqual(questions[0]["questions"][0]["text"], "Which region?")

        seen.clear()
        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    resumed = self._resume(ctx["run_id"], {"q1": "EMEA"})

        self.assertEqual(resumed[-1]["event"], "result")
        # The paused thread continued rather than restarting: one system message, the ask_operator
        # call it made already answered, and the operator's answer as the newest user turn.
        messages = seen["researcher"][0]
        self.assertEqual(sum(1 for m in messages if m.get("role") == "system"), 1)
        asks = [
            m
            for m in messages
            if m.get("role") == "assistant" and m.get("tool_calls")
            and m["tool_calls"][0]["function"]["name"] == "ask_operator"
        ]
        self.assertEqual(len(asks), 1)
        self.assertEqual(sum(1 for m in messages if m.get("role") == "tool"), 1)
        self.assertIn("EMEA", str(messages[-1].get("content") or ""))

    def test_guardian_needs_input_pauses_instead_of_failing(self):
        from . import markdown_store as store

        ctx = self._ctx()
        seen: dict[str, list] = {}
        fake_chat = self._chat(
            {
                "orchester": [{"role": "assistant", "content": "{}"}],
                "guardian": [
                    {
                        "role": "assistant",
                        "content": (
                            '{"result":"needs_input","message":"ambiguous",'
                            '"question":"Which cost column do you mean?"}'
                        ),
                    },
                    self.PASS_GUARDIAN,
                ],
                "researcher": self._researcher_script(),
                "final-approver": [self.APPROVE],
            },
            seen,
        )

        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    events = self._drain(ctx)

        questions = [event for event in events if event.get("event") == "question"]
        self.assertEqual([q["agent_id"] for q in questions], ["guardian"])
        self.assertEqual(questions[0]["questions"][0]["text"], "Which cost column do you mean?")
        # needs_input is a pause, not the guardian's reject path.
        self.assertNotIn("fail", [event.get("result") for event in events])
        self.assertNotIn("researcher", seen)

        seen.clear()
        with patch("api.pipeline_langgraph.complete_chat_messages", side_effect=fake_chat):
            with patch("api.pipeline_run.execute_select", return_value=self.SELECT):
                with patch.object(store, "assemble_agent_prompt", return_value="system"):
                    resumed = self._resume(ctx["run_id"], {"q1": "TotalCost"})

        self.assertEqual(resumed[-1]["event"], "result")
        self.assertIn("TotalCost", self._user_prompt(seen["researcher"][-1]))

    def test_answering_an_unknown_run_reports_expired(self):
        events = self._resume("nope-not-a-run", {"q1": "x"})
        self.assertEqual(events[0]["event"], "error")
        self.assertEqual(events[0]["kind"], "pause_expired")

    def test_operator_answers_are_folded_into_every_prompt(self):
        from .pipeline_run import _build_user_message, _operator_answers_text

        ctx = self._ctx(
            clarifications=[{"question": "Which period?", "answer": "last quarter"}]
        )
        self.assertIn("last quarter", _operator_answers_text(ctx))
        self.assertIn("last quarter", _build_user_message(ctx))
        self.assertEqual(_operator_answers_text(self._ctx()), "")

    def test_answer_endpoint_requires_a_run_id(self):
        from django.test import Client

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                client = Client()
                response = client.post(
                    "/api/runs//answer",
                    data=json.dumps({"answers": {"q1": "x"}}),
                    content_type="application/json",
                )
        self.assertIn(response.status_code, (400, 404))


class SqlExecuteTests(SimpleTestCase):
    def test_ensure_sqlserver_top_inserts_top_on_plain_select(self):
        from .sql_execute import _ensure_sqlserver_top

        self.assertEqual(
            _ensure_sqlserver_top("SELECT a FROM Sales.Moshtary", 100),
            "SELECT TOP (100) a FROM Sales.Moshtary",
        )

    def test_ensure_sqlserver_top_skips_when_top_present(self):
        from .sql_execute import _ensure_sqlserver_top

        sql = "SELECT TOP 5 a FROM Sales.Moshtary"
        self.assertEqual(_ensure_sqlserver_top(sql, 100), sql)

    def test_execute_select_uses_fetchmany_and_retries_link_failure(self):
        from .sql_execute import execute_select

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = False
        mock_cur.description = [("a",)]
        mock_cur.fetchmany.return_value = [(1,)]
        mock_cur.execute.side_effect = [
            Exception(
                "('08S01', '[08S01] Communication link failure (SQLEndTran(SQL_ROLLBACK))')"
            ),
            None,
        ]

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "database": {
                            "engine": "sqlserver",
                            "host": "db.internal",
                            "port": 1433,
                            "name": "Sales",
                            "user": "u",
                            "password": "p",
                        },
                        "sql": {
                            "require_row_limit": False,
                            "max_rows": 10,
                            "max_retries": 2,
                            "forbid_select_star": True,
                            "enforce_allowlist": False,
                        },
                    }
                )
                with patch("api.sql_execute.connect", return_value=mock_conn):
                    result = execute_select("SELECT a FROM Sales.Moshtary")

        self.assertEqual(result["rows"], [{"a": 1}])
        mock_cur.fetchmany.assert_called_with(10)
        mock_cur.fetchall.assert_not_called()
        self.assertEqual(mock_cur.execute.call_count, 2)

    def test_execute_select_retries_pyodbc_exception_set(self):
        from .sql_execute import execute_select

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = False
        mock_cur.description = [("a",)]
        mock_cur.fetchmany.return_value = [(1,)]
        mock_cur.execute.side_effect = [
            SystemError(
                "<class 'pyodbc.Error'> returned a result with an exception set"
            ),
            None,
        ]

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "database": {
                            "engine": "sqlserver",
                            "host": "db.internal",
                            "port": 1433,
                            "name": "Sales",
                            "user": "u",
                            "password": "p",
                        },
                        "sql": {
                            "require_row_limit": False,
                            "max_rows": 10,
                            "max_retries": 2,
                            "forbid_select_star": True,
                            "enforce_allowlist": False,
                        },
                    }
                )
                with patch("api.sql_execute.connect", return_value=mock_conn):
                    result = execute_select("SELECT a FROM Sales.Moshtary")

        self.assertEqual(result["rows"], [{"a": 1}])
        self.assertEqual(mock_cur.execute.call_count, 2)

    def test_sqlserver_connection_close_does_not_raise(self):
        from .db_dialects.sqlserver import _SqlServerConnection

        inner = MagicMock()
        inner.close.side_effect = SystemError(
            "<class 'pyodbc.Error'> returned a result with an exception set"
        )
        wrapper = _SqlServerConnection(inner)
        with wrapper as conn:
            self.assertIs(conn, inner)
        inner.close.assert_called_once()

    def test_sqlserver_connection_skips_close_when_query_failed(self):
        from .db_dialects.sqlserver import _SqlServerConnection

        inner = MagicMock()
        wrapper = _SqlServerConnection(inner)
        with self.assertRaises(RuntimeError):
            with wrapper:
                raise RuntimeError("query failed")
        inner.close.assert_not_called()

    def test_execute_select_exhausted_systemerror_is_friendly(self):
        from .sql_execute import execute_select

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.__exit__.return_value = False
        mock_cur.execute.side_effect = SystemError(
            "<class 'pyodbc.Error'> returned a result with an exception set"
        )

        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "helix.config.yaml"
            with override_settings(HELIX_CONFIG_PATH=str(config_path)):
                save_config(
                    {
                        "database": {
                            "engine": "sqlserver",
                            "host": "db.internal",
                            "port": 1433,
                            "name": "Sales",
                            "user": "u",
                            "password": "p",
                        },
                        "sql": {
                            "require_row_limit": False,
                            "max_rows": 10,
                            "max_retries": 1,
                            "forbid_select_star": True,
                            "enforce_allowlist": False,
                        },
                    }
                )
                with patch("api.sql_execute.connect", return_value=mock_conn):
                    with self.assertRaises(ValueError) as raised:
                        execute_select("SELECT a FROM Sales.Moshtary")

        self.assertIn("SQL Server closed the connection", str(raised.exception))
        self.assertIsNone(raised.exception.__cause__)
        self.assertNotIn("exception set", str(raised.exception).lower())


class TokenUsageTests(SimpleTestCase):
    def test_estimator_charges_persian_text_more_than_ascii(self):
        from .token_usage import estimate_tokens

        self.assertEqual(estimate_tokens(""), 0)
        self.assertEqual(estimate_tokens(None), 0)
        self.assertLess(estimate_tokens("short"), estimate_tokens("a much longer piece of text"))
        # Same character count, different script: non-Latin text costs more tokens per char.
        self.assertGreater(estimate_tokens("مجموع فروش"), estimate_tokens("abcdefghij"))

    def test_provider_usage_is_used_verbatim_when_reported(self):
        from .token_usage import record_call, snapshot

        ctx: dict = {}
        record_call(
            ctx,
            "researcher",
            messages=[{"role": "user", "content": "hi"}],
            reply="ok",
            usage={"prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150},
        )
        totals = snapshot(ctx)
        self.assertEqual(totals["total_tokens"], 150)
        self.assertEqual(totals["prompt_tokens"], 120)
        self.assertEqual(totals["completion_tokens"], 30)
        self.assertEqual(totals["calls"], 1)
        self.assertFalse(totals["estimated"])
        self.assertEqual(totals["by_agent"]["researcher"]["total_tokens"], 150)

    def test_missing_usage_falls_back_to_an_estimate(self):
        from .token_usage import record_call, snapshot

        ctx: dict = {}
        record_call(ctx, "guardian", messages=[{"role": "user", "content": "x" * 400}], reply="y" * 40)
        totals = snapshot(ctx)
        self.assertTrue(totals["estimated"])
        self.assertGreater(totals["total_tokens"], 0)
        self.assertGreater(totals["prompt_tokens"], totals["completion_tokens"])

    def test_totals_accumulate_across_calls_and_agents(self):
        from .token_usage import record_call, snapshot

        ctx: dict = {}
        record_call(ctx, "guardian", messages=[], reply="a", usage={"total_tokens": 10})
        record_call(ctx, "researcher", messages=[], reply="b", usage={"total_tokens": 25})
        record_call(ctx, "researcher", messages=[], reply="c", usage={"total_tokens": 5})
        totals = snapshot(ctx)
        self.assertEqual(totals["total_tokens"], 40)
        self.assertEqual(totals["calls"], 3)
        self.assertEqual(totals["by_agent"]["researcher"]["calls"], 2)
        self.assertEqual(totals["by_agent"]["researcher"]["total_tokens"], 30)

    def test_snapshot_of_an_empty_ctx_is_zeroed(self):
        from .token_usage import snapshot

        totals = snapshot({})
        self.assertEqual(totals["total_tokens"], 0)
        self.assertEqual(totals["calls"], 0)
        self.assertNotIn("by_agent", totals)

    def test_step_and_result_events_carry_the_running_totals(self):
        import json as _json

        from .pipeline_run import _step_event, result_chunk
        from .token_usage import record_call

        ctx = {"run_id": "run-1", "pipeline_started": 0}
        record_call(ctx, "researcher", messages=[], reply="x", usage={"total_tokens": 42})
        ctx["rag"] = {"docs": ["glossary"], "tokens": 7, "budget_tokens": 1500, "available_docs": 2}
        step = _step_event(
            ctx, agent_id="researcher", node_id="researcher", status="done", message="ok"
        )
        self.assertEqual(step["token_usage"]["total_tokens"], 42)
        self.assertEqual(step["rag"]["tokens"], 7)
        chunk = result_chunk({"mode": "grid"}, ctx)
        payload = _json.loads(chunk[len("data: ") :].strip())
        self.assertEqual(payload["token_usage"]["total_tokens"], 42)
        self.assertEqual(payload["rag"]["docs"], ["glossary"])


class RagKnowledgeStoreTests(SimpleTestCase):
    def test_documents_round_trip_with_token_counts(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import markdown_store as store

                created = store.create_rag_doc(
                    "sales-glossary",
                    "---\nname: Sales glossary\n---\n\nNet sales excludes returns.\n",
                )
                self.assertEqual(created["title"], "Sales glossary")
                self.assertGreater(created["tokens"], 0)

                listed = store.list_rag_docs()
                self.assertEqual([item["id"] for item in listed], ["sales-glossary"])
                totals = store.rag_totals()
                self.assertEqual(totals["docs"], 1)
                self.assertEqual(totals["tokens"], listed[0]["tokens"])

                longer = "---\nname: Sales glossary\n---\n\n" + "Net sales excludes returns. " * 20
                updated = store.update_rag_doc("sales-glossary", longer)
                self.assertGreater(updated["tokens"], created["tokens"])

                store.delete_rag_doc("sales-glossary")
                with self.assertRaises(FileNotFoundError):
                    store.get_rag_doc("sales-glossary")

    def test_document_ids_must_be_safe_and_unique(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import markdown_store as store

                store.create_rag_doc("known-doc", "body")
                with self.assertRaises(FileExistsError):
                    store.create_rag_doc("known-doc", "body")
                with self.assertRaises(ValueError):
                    store.create_rag_doc("../escape", "body")

    def test_endpoints_list_save_and_delete_documents(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from django.test import Client

                client = Client()
                empty = client.get("/api/rag/")
                self.assertEqual(empty.status_code, 200)
                self.assertEqual(empty.json()["docs"], [])
                self.assertGreater(empty.json()["totals"]["budget_tokens"], 0)

                created = client.post(
                    "/api/rag/",
                    data=json.dumps({"id": "ops-notes", "content": "Ops notes body"}),
                    content_type="application/json",
                )
                self.assertEqual(created.status_code, 201)
                self.assertGreater(created.json()["tokens"], 0)

                listing = client.get("/api/rag/").json()
                self.assertEqual([item["id"] for item in listing["docs"]], ["ops-notes"])
                self.assertEqual(listing["totals"]["docs"], 1)

                updated = client.put(
                    "/api/rag/ops-notes/",
                    data=json.dumps({"content": "Ops notes body", "title": "Ops notes"}),
                    content_type="application/json",
                )
                self.assertEqual(updated.status_code, 200)
                self.assertEqual(updated.json()["title"], "Ops notes")

                deleted = client.delete("/api/rag/ops-notes/")
                self.assertEqual(deleted.status_code, 204)
                self.assertEqual(client.get("/api/rag/").json()["docs"], [])


class RagRetrievalTests(SimpleTestCase):
    def _seed(self, store):
        store.create_rag_doc(
            "sales-glossary",
            "---\nname: Sales glossary\n---\n\nNet sales is line total minus returns.\n",
        )
        store.create_rag_doc(
            "delivery-policy",
            "---\nname: Delivery policy\n---\n\nDeliveries are counted per shipment.\n",
        )

    def test_matching_documents_are_selected_and_counted(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import markdown_store as store
                from .rag_context import select_rag_context

                self._seed(store)
                rag = select_rag_context("Show net sales by category")
                self.assertEqual(rag["docs"], ["sales-glossary"])
                self.assertIn("Sales glossary", rag["text"])
                self.assertNotIn("Delivery policy", rag["text"])
                # The retrieved entry is charged for what it injects, inside the run's budget.
                self.assertGreater(rag["tokens"], 0)
                self.assertLessEqual(rag["tokens"], rag["budget_tokens"])
                self.assertEqual(rag["available_docs"], 2)

    def test_prompt_without_a_match_retrieves_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import markdown_store as store
                from .rag_context import select_rag_context

                self._seed(store)
                rag = select_rag_context("zzz qqq")
                self.assertEqual(rag["text"], "")
                self.assertEqual(rag["docs"], [])
                self.assertEqual(rag["tokens"], 0)
                self.assertEqual(rag["available_docs"], 2)

    def test_the_token_budget_caps_what_is_retrieved(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import markdown_store as store
                from .rag_context import select_rag_context

                for index in range(3):
                    store.create_rag_doc(
                        f"sales-note-{index}",
                        f"---\nname: Sales note {index}\n---\n\n" + ("sales detail " * 200),
                    )
                rag = select_rag_context("sales detail", budget_tokens=120, max_docs=3)
                self.assertLessEqual(rag["tokens"], 120)
                self.assertLess(len(rag["docs"]), 3)
                self.assertGreater(rag["tokens"], 0)

    def test_an_empty_store_retrieves_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from .rag_context import select_rag_context

                rag = select_rag_context("net sales by category")
                self.assertEqual(rag["docs"], [])
                self.assertEqual(rag["tokens"], 0)
                self.assertEqual(rag["available_docs"], 0)


class ResultsStoreTests(SimpleTestCase):
    def test_create_result_persists_duration_in_list_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import results_store

                item = results_store.create_result(
                    prompt="top products",
                    mode="grid",
                    language="en",
                    payload={"grid": {"columns": [], "rows": []}},
                    duration_s=12.44,
                )
                self.assertEqual(item["duration_s"], 12.44)
                listed = results_store.list_results()
                self.assertEqual(listed[0]["duration_s"], 12.44)

    def test_create_result_ignores_invalid_duration(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import results_store

                item = results_store.create_result(
                    prompt="no duration",
                    mode="grid",
                    language="en",
                    payload={},
                    duration_s="slow",
                )
                self.assertIsNone(item["duration_s"])
                listed = results_store.list_results()
                self.assertIsNone(listed[0]["duration_s"])

    def test_create_result_persists_tokens_and_retrieval_in_list_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import results_store

                item = results_store.create_result(
                    prompt="top products",
                    mode="grid",
                    language="en",
                    payload={},
                    token_usage={
                        "prompt_tokens": 1200,
                        "completion_tokens": 300,
                        "total_tokens": 1500,
                        "calls": 4,
                        "estimated": True,
                    },
                    rag={"docs": ["sales-glossary"], "tokens": 210, "budget_tokens": 1500},
                )
                self.assertEqual(item["token_usage"]["total_tokens"], 1500)
                self.assertTrue(item["token_usage"]["estimated"])
                listed = results_store.list_results()[0]
                self.assertEqual(listed["token_usage"]["total_tokens"], 1500)
                self.assertEqual(listed["token_usage"]["calls"], 4)
                self.assertEqual(listed["rag"]["docs"], ["sales-glossary"])
                self.assertEqual(listed["rag"]["tokens"], 210)

    def test_create_result_drops_an_empty_usage_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import results_store

                item = results_store.create_result(
                    prompt="no usage",
                    mode="grid",
                    language="en",
                    payload={},
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0},
                    rag={"docs": [], "tokens": 0},
                )
                self.assertIsNone(item["token_usage"])
                self.assertIsNone(item["rag"])
                listed = results_store.list_results()[0]
                self.assertIsNone(listed["token_usage"])
                self.assertIsNone(listed["rag"])


class LogsCollectionTests(SimpleTestCase):
    def test_post_log_persists_client_reported_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from django.test import Client

                client = Client()
                response = client.post(
                    "/api/logs/",
                    data=json.dumps(
                        {
                            "kind": "api",
                            "message": "Failed to fetch during run stream",
                            "prompt": "top products",
                            "mode": "chart",
                            "language": "en",
                            "path": "/api/runs/stream",
                        }
                    ),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 201)
                payload = response.json()
                self.assertEqual(payload["log"]["kind"], "api")
                self.assertIn("Failed to fetch", payload["log"]["message"])

                listed = client.get("/api/logs/")
                self.assertEqual(listed.status_code, 200)
                logs = listed.json()["logs"]
                self.assertEqual(len(logs), 1)
                self.assertEqual(logs[0]["prompt"], "top products")

    def test_post_log_requires_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from django.test import Client

                client = Client()
                response = client.post(
                    "/api/logs/",
                    data=json.dumps({"kind": "api"}),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)

    def test_post_log_persists_snapshot_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from django.test import Client

                client = Client()
                response = client.post(
                    "/api/logs/",
                    data=json.dumps(
                        {
                            "kind": "api",
                            "message": "Stream ended without a result",
                            "prompt": "sales trend",
                            "mode": "grid",
                            "language": "fa",
                            "path": "/api/runs/stream",
                            "run_id": "abc123",
                            "node_id": "data-gatherer__2",
                            "agent_id": "data-gatherer",
                            "detail": "Connection reset",
                            "duration_s": 4.52,
                            "report_type": "medium",
                            "chart_type": "bar",
                            "steps": [
                                {
                                    "agent_id": "user",
                                    "node_id": "",
                                    "status": "done",
                                    "message": "Received prompt",
                                },
                                {
                                    "agent_id": "data-gatherer",
                                    "node_id": "data-gatherer__2",
                                    "status": "running",
                                    "message": "Running data gatherer",
                                },
                            ],
                        }
                    ),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 201)
                log = response.json()["log"]
                self.assertEqual(log["run_id"], "abc123")
                self.assertEqual(log["node_id"], "data-gatherer__2")
                self.assertEqual(log["agent_id"], "data-gatherer")
                self.assertEqual(log["detail"], "Connection reset")
                self.assertEqual(log["duration_s"], 4.52)
                self.assertEqual(log["report_type"], "medium")
                self.assertEqual(log["chart_type"], "bar")
                self.assertEqual(len(log["steps"]), 2)
                self.assertEqual(log["steps"][1]["status"], "running")

    def test_persist_failure_writes_pipeline_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MARKDOWN_FILES_DIR=tmp):
                from . import logs_store
                from .pipeline_run import _persist_failure

                ctx = {
                    "prompt": "top customers",
                    "mode": "grid",
                    "language": "en",
                    "report_type": "low",
                    "chart_type": "line",
                    "run_id": "run-xyz",
                    "pipeline_started": 1000.0,
                    "last_error": "Underlying SQL syntax error",
                    "step_log": [
                        {
                            "agent_id": "user",
                            "node_id": "",
                            "status": "done",
                            "message": "Received prompt",
                        },
                        {
                            "agent_id": "researcher",
                            "node_id": "researcher__1",
                            "status": "failed",
                            "message": "Bad SQL",
                        },
                    ],
                }
                with patch("api.pipeline_run._agent_time.time", return_value=1005.25):
                    item = _persist_failure(
                        "Agent failed",
                        ctx=ctx,
                        agent_id="researcher__1",
                        kind="sql",
                    )
                self.assertEqual(item["run_id"], "run-xyz")
                self.assertEqual(item["node_id"], "researcher__1")
                self.assertEqual(item["agent_id"], "researcher")
                self.assertEqual(item["detail"], "Underlying SQL syntax error")
                self.assertEqual(item["duration_s"], 5.25)
                self.assertEqual(len(item["steps"]), 2)
                stored = logs_store.get_log(item["id"])
                self.assertEqual(stored["report_type"], "low")
                self.assertEqual(stored["chart_type"], "line")


class DbExplorerObjectKindTests(SimpleTestCase):
    def _get(self, query: str = ""):
        from django.test import RequestFactory

        from . import views

        request = RequestFactory().get(f"/api/db-explorer/tables/{query}")
        return views.db_explorer_tables(request)

    def test_defaults_to_tables(self):
        with patch(
            "api.db_sql.list_objects",
            return_value=[
                {"schema": "dbo", "name": "T", "full_name": "dbo.T", "kind": "table"}
            ],
        ) as mocked:
            response = self._get()
        self.assertEqual(response.status_code, 200)
        mocked.assert_called_once_with("tables")
        data = json.loads(response.content)
        self.assertEqual(data["kind"], "tables")
        self.assertEqual(len(data["tables"]), 1)

    def test_kind_is_passed_through(self):
        with patch("api.db_sql.list_objects", return_value=[]) as mocked:
            response = self._get("?kind=procedures")
        self.assertEqual(response.status_code, 200)
        mocked.assert_called_once_with("procedures")
        self.assertEqual(json.loads(response.content)["kind"], "procedures")

    def test_unknown_kind_is_rejected(self):
        response = self._get("?kind=triggers")
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("kind must be one of", data["error"])
