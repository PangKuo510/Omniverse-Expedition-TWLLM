from __future__ import annotations

import importlib
import importlib.util
import json
import logging
import os
import sqlite3
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .game_state import GameState, apply_state_patch

logger = logging.getLogger(__name__)

_openai_spec = importlib.util.find_spec("openai")
if _openai_spec is not None:
    openai = importlib.import_module("openai")
    openai.api_key = os.getenv("OPENAI_API_KEY")
else:  # pragma: no cover - fallback path when openai is unavailable
    openai = None  # type: ignore[assignment]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

current_state = GameState()


def init_db() -> None:
    conn = sqlite3.connect("db.sqlite")
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS game_saves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT,
            save_data TEXT
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


class TurnRequest(BaseModel):
    playerInput: str
    gameState: Dict[str, Any] | None = None
    apiKey: str | None = None


class TurnResponse(BaseModel):
    narration: str
    options: List[str]
    delta_stats: Dict[str, int]
    items: List[Dict[str, Any]]
    hp: int
    gold: int


class SaveRequest(BaseModel):
    player_id: str
    game_state: Dict[str, Any]


def _apply_and_serialize(
    narration: str,
    options: List[str],
    delta_stats: Dict[str, int] | None,
    items: List[Dict[str, Any]] | None,
) -> Dict[str, Any]:
    apply_state_patch(current_state, delta_stats or {}, items or [], narration)
    return {
        "narration": narration,
        "options": options,
        "delta_stats": delta_stats or {},
        "items": current_state.items,
        "hp": current_state.hp,
        "gold": current_state.gold,
    }


def _fallback_turn_response() -> Dict[str, Any]:
    logger.warning("Falling back to offline response for /api/turn")
    narration = "無法連接 AI，請稍後再試。若已設定 API Key，請確認無誤。"
    return _apply_and_serialize(narration, [], {"hp": 0, "gold": 0}, [])


@app.post("/api/turn", response_model=TurnResponse)
async def turn(req: TurnRequest) -> Any:
    if not req.playerInput:
        raise HTTPException(status_code=400, detail="playerInput is required")

    if openai is None:
        return _fallback_turn_response()

    if req.apiKey:
        openai.api_key = req.apiKey

    if not getattr(openai, "api_key", None):
        return _fallback_turn_response()

    system_prompt = (
        "你是一個角色扮演遊戲的敘事者，請以繁體中文回應。"
        "根據玩家輸入和當前遊戲狀態生成下一段故事敘事、兩個可供選擇的選項、"
        "角色能力值變化（delta_stats），以及獲得或失去的物品列表（items）。"
        "請將回應格式化為以下 JSON："
        "{\"narration\":\"文字\", \"options\":[\"選項1\",\"選項2\"], "
        "\"delta_stats\":{\"hp\":整數,\"gold\":整數}, "
        "\"items\":[{\"name\":\"物品名稱\",\"qty\":數量}]}"
    )
    user_prompt = f"玩家輸入: {req.playerInput}\n遊戲狀態: {req.gameState}"

    try:
        response = openai.ChatCompletion.create(  # type: ignore[union-attr]
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error("OpenAI ChatCompletion failed: %s", exc)
        return _fallback_turn_response()

    content = response.choices[0].message["content"].strip()

    try:
        result = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("Failed to decode OpenAI response as JSON: %s", exc)
        return _fallback_turn_response()

    narration = result.get("narration", "")
    options = result.get("options", [])
    delta_stats = result.get("delta_stats", {})
    items = result.get("items", [])

    return _apply_and_serialize(narration, options, delta_stats, items)


@app.post("/api/save")
async def save_game(req: SaveRequest) -> Dict[str, Any]:
    conn = sqlite3.connect("db.sqlite")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO game_saves (player_id, save_data) VALUES (?, ?)",
        (req.player_id, json.dumps(req.game_state)),
    )
    conn.commit()
    conn.close()
    return {"success": True}


@app.get("/api/load")
async def load_game(player_id: str) -> Dict[str, Any]:
    conn = sqlite3.connect("db.sqlite")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT save_data FROM game_saves WHERE player_id = ? ORDER BY id DESC LIMIT 1",
        (player_id,),
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        data = json.loads(row[0])
        global current_state
        current_state = GameState(
            hp=data.get("hp", 10),
            gold=data.get("gold", 0),
            items=data.get("items", []),
            history=data.get("history", []),
        )
        return {"game_state": data}
    return {"game_state": None}
