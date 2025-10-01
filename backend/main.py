from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
import openai
import os
import json
import sqlite3

# 從自訂模組引入遊戲狀態管理
from .game_state import GameState, apply_state_patch

# 讀取 OpenAI API 金鑰
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# 加入 CORS 設定，方便前端從不同來源呼叫
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 建立（或取得）全域遊戲狀態，示範用，實際應依玩家分流
current_state = GameState()

# 初始化 SQLite 資料庫與資料表
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
    gameState: Dict[str, Any] | None = None  # 客戶端傳入的狀態，目前未使用

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

@app.post("/api/turn", response_model=TurnResponse)
async def turn(req: TurnRequest) -> Any:
    """
    接收玩家輸入後呼叫 OpenAI 產生下一段敘事，
    更新遊戲狀態後回傳敘事、選項以及更新後的狀態資料。
    """
    # 建立系統提示與使用者提示
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

    # 呼叫 OpenAI ChatCompletion
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        content = response.choices[0].message["content"].strip()
        result = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 產生回覆失敗: {e}")

    narration = result.get("narration", "")
    options = result.get("options", [])
    delta_stats = result.get("delta_stats", {})
    items = result.get("items", [])

    # 更新全域遊戲狀態
    apply_state_patch(current_state, delta_stats, items, narration)

    return {
        "narration": narration,
        "options": options,
        "delta_stats": delta_stats,
        "items": current_state.items,
        "hp": current_state.hp,
        "gold": current_state.gold,
    }

@app.post("/api/save")
async def save_game(req: SaveRequest) -> Dict[str, Any]:
    """
    將目前遊戲狀態儲存至 SQLite。save_data 儲存為 JSON 字串。
    """
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
    """
    根據 player_id 載入最近一次儲存的遊戲狀態，
    並更新全域遊戲狀態方便後續呼叫。
    """
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
        # 將資料寫回全域狀態
        global current_state
        current_state = GameState(
            hp=data.get("hp", 10),
            gold=data.get("gold", 0),
            items=data.get("items", []),
            history=data.get("history", []),
        )
        return {"game_state": data}
    return {"game_state": None}
