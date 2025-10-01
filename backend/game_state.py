from typing import List, Dict, Any

class GameState:
    """
    遊戲狀態物件，紀錄玩家血量、金錢、持有物品與敘事歷史。
    """
    def __init__(self, hp: int = 10, gold: int = 0,
                 items: List[Dict[str, Any]] | None = None,
                 history: List[str] | None = None) -> None:
        self.hp: int = hp
        self.gold: int = gold
        # items 以 list 儲存，每個元素為 {'name': str, 'qty': int}
        self.items: List[Dict[str, Any]] = items if items is not None else []
        # history 以 list 儲存過往敘事
        self.history: List[str] = history if history is not None else []

def apply_state_patch(state: GameState,
                      delta_stats: Dict[str, int] | None,
                      new_items: List[Dict[str, Any]] | None,
                      narration: str | None) -> GameState:
    """
    根據 LLM 回傳的增量資料更新遊戲狀態：
    - 調整 hp/gold。
    - 合併或新增物品。
    - 將最新敘事加入 history。
    """
    # 更新血量與金錢
    if delta_stats:
        state.hp += delta_stats.get("hp", 0)
        state.gold += delta_stats.get("gold", 0)

    # 合併物品：相同名稱的物品數量累加，沒有則新增
    if new_items:
        for item in new_items:
            found = False
            for existing in state.items:
                if existing.get("name") == item.get("name"):
                    existing["qty"] = existing.get("qty", 0) + item.get("qty", 0)
                    found = True
                    break
            if not found:
                # 使用 copy 確保不受外部物件影響
                state.items.append(item.copy())

    # 記錄敘事
    if narration:
        state.history.append(narration)

    return state
