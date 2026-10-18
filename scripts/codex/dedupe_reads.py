#!/usr/bin/env python3
"""Block duplicate unchanged file reads within one Codex turn."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import shlex
import sys
import tempfile
from pathlib import Path
from typing import Any


PATH_KEYS = {"file", "filepath", "filename", "file_path", "file_uri", "path", "relative_path", "uri"}
RANGE_KEYS = {
    "end", "end_byte", "end_line", "endline", "line", "line_number", "limit", "max_chars",
    "num_lines", "offset", "range", "start", "start_byte", "start_line", "startline",
}
FULL_READ_COMMANDS = {"bat", "cat", "nl"}
PARTIAL_READ_COMMANDS = {"head", "less", "more", "sed", "tail"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def repository_root(cwd: str) -> Path | None:
    current = Path(cwd).resolve()
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists():
            return candidate
    return None


def read_fingerprint(path_value: str, cwd: Path, root: Path) -> tuple[str, str] | None:
    if path_value.startswith("file://"):
        path_value = path_value[7:]
    path = Path(path_value)
    if not path.is_absolute():
        path = cwd / path
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to(root)
        if not resolved.is_file():
            return None
        digest = hashlib.sha256()
        with resolved.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        return str(resolved), digest.hexdigest()
    except (OSError, RuntimeError, ValueError):
        return None


def direct_read_candidates(tool_name: str, tool_input: Any, cwd: Path, root: Path) -> list[dict[str, str]]:
    if "read" not in tool_name.lower() and "open_file" not in tool_name.lower():
        return []

    paths: list[str] = []
    range_values: dict[str, Any] = {}

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                normalized = key.lower().replace("-", "_")
                compact = normalized.replace("_", "")
                if compact in {item.replace("_", "") for item in PATH_KEYS} and isinstance(child, str):
                    paths.append(child)
                if compact in {item.replace("_", "") for item in RANGE_KEYS}:
                    range_values[normalized] = child
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(tool_input)
    scope = "full" if not range_values else "partial:" + json.dumps(range_values, sort_keys=True, ensure_ascii=False)
    candidates = []
    for value in paths:
        fingerprint = read_fingerprint(value, cwd, root)
        if fingerprint:
            candidates.append({"path": fingerprint[0], "content": fingerprint[1], "scope": scope})
    return candidates


def shell_read_candidates(command: str, cwd: Path, root: Path) -> list[dict[str, str]]:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        return []

    segments: list[list[str]] = []
    segment: list[str] = []
    for token in tokens:
        if token and all(character in ";&|" for character in token):
            if segment:
                segments.append(segment)
                segment = []
        else:
            segment.append(token)
    if segment:
        segments.append(segment)

    candidates = []
    for words in segments:
        command_name = Path(words[0]).name.lower()
        if command_name not in FULL_READ_COMMANDS | PARTIAL_READ_COMMANDS:
            continue
        arguments = words[1:]
        if command_name == "sed" and any(arg in {"-i", "--in-place"} or arg.startswith("-i") for arg in arguments):
            continue

        positional = []
        skip_next = False
        for argument in arguments:
            if skip_next:
                skip_next = False
                continue
            if command_name == "sed" and argument in {"-e", "--expression", "-f", "--file"}:
                skip_next = True
                continue
            if argument.startswith("-") or argument in {"", "-"}:
                continue
            positional.append(argument)
        if not positional:
            continue
        scope = "full" if command_name in FULL_READ_COMMANDS else "partial:" + json.dumps(
            {"command": command_name, "arguments": arguments}, sort_keys=True, ensure_ascii=False
        )
        path_values = positional[-1:] if command_name == "sed" else positional
        if command_name in {"head", "tail", "less", "more"}:
            path_values = positional[-1:]
        for path_value in path_values:
            fingerprint = read_fingerprint(path_value, cwd, root)
            if fingerprint:
                candidates.append({"path": fingerprint[0], "content": fingerprint[1], "scope": scope})
    return candidates


def candidates_for(event: dict[str, Any], root: Path) -> list[dict[str, str]]:
    tool_name = str(event.get("tool_name", ""))
    tool_input = event.get("tool_input", {})
    cwd = Path(str(event.get("cwd", root))).resolve()
    if tool_name.lower() == "bash":
        command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
        candidates = shell_read_candidates(command, cwd, root) if isinstance(command, str) else []
    else:
        candidates = direct_read_candidates(tool_name, tool_input, cwd, root)
    unique = {candidate_key(candidate): candidate for candidate in candidates}
    return list(unique.values())


def candidate_key(candidate: dict[str, str]) -> str:
    return sha256_bytes(json.dumps(candidate, sort_keys=True).encode("utf-8"))


def response_failed(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    if response.get("isError") is True or response.get("is_error") is True:
        return True
    for key in ("exit_code", "exitCode"):
        if key in response and response[key] not in (None, 0):
            return True
    status = str(response.get("status", "")).lower()
    if status in {"error", "failed", "failure"}:
        return True
    outcome = response.get("outcome")
    if isinstance(outcome, dict):
        code = outcome.get("exitCode", outcome.get("exit_code"))
        if code not in (None, 0):
            return True
    return False


def state_location(event: dict[str, Any], root: Path) -> Path:
    identity = f"{event.get('session_id', '')}\0{root}"
    name = sha256_bytes(identity.encode("utf-8"))
    return Path(tempfile.gettempdir()) / "codex-read-dedupe" / f"{name}.json"


def load_state(path: Path, turn_id: str) -> dict[str, Any]:
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    if state.get("turn_id") != turn_id:
        return {"turn_id": turn_id, "completed": [], "pending": {}}
    state.setdefault("completed", [])
    state.setdefault("pending", {})
    return state


def save_state(path: Path, state: dict[str, Any]) -> None:
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return 0
    if not isinstance(event, dict):
        return 0

    root = repository_root(str(event.get("cwd", "")))
    if root is None:
        return 0
    event_name = event.get("hook_event_name")
    turn_id = str(event.get("turn_id", ""))
    tool_use_id = str(event.get("tool_use_id", ""))
    if not turn_id or not tool_use_id:
        return 0

    candidates = candidates_for(event, root) if event_name == "PreToolUse" else []
    if event_name not in {"PreToolUse", "PostToolUse"}:
        return 0

    state_path = state_location(event, root)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = state_path.with_suffix(".lock")
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        state = load_state(state_path, turn_id)

        if event_name == "PreToolUse" and candidates:
            known = {candidate_key(item) for item in state["completed"]}
            for pending_items in state["pending"].values():
                known.update(candidate_key(item) for item in pending_items)
            repeated = next((item for item in candidates if candidate_key(item) in known), None)
            if repeated:
                print(json.dumps({
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            f"重复读取已拦截：{repeated['path']} 在本任务中已按相同范围读取，且文件内容未变化。"
                            "请复用已读结果；文件内容改变或需要新的局部范围时可以继续读取。"
                        ),
                    }
                }))
                return 0
            state["pending"][tool_use_id] = candidates
            save_state(state_path, state)
        elif event_name == "PostToolUse":
            pending = state["pending"].pop(tool_use_id, [])
            if pending and not response_failed(event.get("tool_response")):
                completed = {candidate_key(item): item for item in state["completed"]}
                completed.update({candidate_key(item): item for item in pending})
                state["completed"] = list(completed.values())
            save_state(state_path, state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
