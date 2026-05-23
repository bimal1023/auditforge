"""
MCP client helpers for spawning stdio-transport MCP server subprocesses.

MCPClient      — single server
MultiMCPClient — multiple servers; merges their tool lists and routes calls
                 by tool name automatically.

Usage (single):
    async with MCPClient("mcp_servers/sec_edgar/server.py") as c:
        tools = c.anthropic_tools()
        result = await c.call_tool("search_company", {"name": "Apple"})

Usage (multi):
    async with MultiMCPClient(
        "mcp_servers/sec_edgar/server.py",
        "mcp_servers/web_search/server.py",
    ) as c:
        tools = c.anthropic_tools()          # merged list from both servers
        result = await c.call_tool("search_web", {"query": "Apple revenue"})
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import Tool


def _devnull_errlog():
    """
    Return an open /dev/null write handle for use as errlog in stdio_client.

    Celery replaces sys.stderr with a LoggingProxy that has no fileno().
    The MCP library's stdio_client captures sys.stderr as a default parameter
    at import time, so runtime swaps of sys.stderr have no effect. Passing an
    explicit /dev/null file bypasses the bad default entirely.
    MCP communicates with its subprocess over pipes, not stderr, so silencing
    stderr here only suppresses the subprocess's own startup noise.
    """
    return open(os.devnull, "w")


class MCPClient:
    """Async context manager wrapping a single MCP stdio server process."""

    def __init__(
        self,
        script_path: str,
        extra_env: dict[str, str] | None = None,
    ) -> None:
        env = {**os.environ}
        if extra_env:
            env.update(extra_env)

        self._params = StdioServerParameters(
            command=sys.executable,
            args=[script_path],
            env=env,
        )
        self._session: ClientSession | None = None
        self._tools: list[Tool] = []
        self._cm = None
        self._errlog = None

    async def __aenter__(self) -> "MCPClient":
        self._errlog = _devnull_errlog()
        self._cm = stdio_client(self._params, errlog=self._errlog)
        read, write = await self._cm.__aenter__()
        self._session = ClientSession(read, write)
        await self._session.__aenter__()
        await self._session.initialize()
        resp = await self._session.list_tools()
        self._tools = resp.tools
        return self

    async def __aexit__(self, *exc: Any) -> None:
        # Suppress anyio "cancel scope in different task" RuntimeErrors that
        # surface when Celery's forked worker tears down the event loop while
        # an exception is still propagating through an anyio task group.
        try:
            if self._session:
                try:
                    await self._session.__aexit__(*exc)
                except Exception:
                    pass
        finally:
            try:
                if self._cm:
                    try:
                        await self._cm.__aexit__(*exc)
                    except Exception:
                        pass
            finally:
                if self._errlog:
                    self._errlog.close()

    # ------------------------------------------------------------------
    # Anthropic integration helpers
    # ------------------------------------------------------------------

    def anthropic_tools(self) -> list[dict]:
        """Return tool definitions in the format expected by anthropic.messages.create."""
        return [
            {
                "name": t.name,
                "description": t.description or "",
                "input_schema": t.inputSchema,
            }
            for t in self._tools
        ]

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """
        Call an MCP tool and return the result as a JSON string suitable for
        inserting into the Anthropic tool_result content block.
        """
        if self._session is None:
            raise RuntimeError("MCPClient not entered — use as async context manager")
        result = await self._session.call_tool(name, arguments)
        parts: list[str] = []
        for block in result.content:
            if hasattr(block, "text"):
                parts.append(block.text)
            else:
                parts.append(json.dumps(block.model_dump()))
        text = "\n".join(parts) if parts else "{}"
        # SEC filings can be 50K+ chars — cap to keep input tokens under control
        if len(text) > 12_000:
            text = text[:12_000] + "\n...[truncated — use key figures above]"
        return text


# ---------------------------------------------------------------------------
# Multi-server client
# ---------------------------------------------------------------------------

class MultiMCPClient:
    """
    Manages multiple MCPClient instances simultaneously.
    Tool names across servers must be unique — raises ValueError on collision.
    """

    def __init__(self, *script_paths: str, extra_env: dict[str, str] | None = None) -> None:
        self._script_paths = script_paths
        self._extra_env = extra_env
        self._clients: list[MCPClient] = []
        self._tool_map: dict[str, MCPClient] = {}  # tool_name → owning client

    async def __aenter__(self) -> "MultiMCPClient":
        for path in self._script_paths:
            client = MCPClient(path, self._extra_env)
            await client.__aenter__()
            for tool in client._tools:
                if tool.name in self._tool_map:
                    raise ValueError(
                        f"Tool name collision: '{tool.name}' is exposed by more than one MCP server"
                    )
                self._tool_map[tool.name] = client
            self._clients.append(client)
        return self

    async def __aexit__(self, *exc: Any) -> None:
        for client in reversed(self._clients):
            await client.__aexit__(*exc)

    def anthropic_tools(self) -> list[dict]:
        """Merged Anthropic-format tool list from all connected servers."""
        tools: list[dict] = []
        for client in self._clients:
            tools.extend(client.anthropic_tools())
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """Route the call to whichever server owns this tool name."""
        client = self._tool_map.get(name)
        if client is None:
            raise ValueError(f"Unknown tool: '{name}'")
        return await client.call_tool(name, arguments)
