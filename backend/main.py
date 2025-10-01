from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any
import openai
import os
import json

openai.api_key = os.getenv("OPENAI_API_KEY")

class TurnRequest(BaseModel):
    playerInput: str
    gameState: Dict[str, Any]

app = FastAPI()

@app.post("/api/turn")
async def turn(req: TurnRequest):
    system_prompt = (
        "你是一個角色扮演遊戲的敘事者，請以繁體中文回應，"
        "根據玩家輸入和當前遊戲狀態生成下一段故事、可供選擇的選項、"
        "角色能力值的變化(delta_stats)，以及獲得或失去的物品(items)。"
        "請將回應格式化為 JSON，包含 narration、options、delta_stats 和 items。"
    )
    user_prompt = f"玩家輸入: {req.playerInput}\n遊戲狀態: {req.gameState}"
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
        return result
    except Exception:
        return {
            "narration": "發生錯誤，請稍後再試。",
            "options": [],
            "delta_stats": {},
            "items": []
        }
