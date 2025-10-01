import { useState } from 'react';

export default function Home() {
  // 初始遊戲狀態：血量 10、金錢 0、無物品與歷史
  const [gameState, setGameState] = useState({
    hp: 10,
    gold: 0,
    items: [],
    history: []
  });
  const [messages, setMessages] = useState([]);    // 紀錄敘事訊息
  const [options, setOptions] = useState([]);      // 當前可選選項
  const [input, setInput] = useState('');          // 玩家輸入字串

  // 呼叫後端 /api/turn 並更新畫面
  async function handleTurn(playerInput) {
    if (!playerInput) return;
    try {
      const res = await fetch('http://localhost:8000/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerInput, gameState })
      });
      const data = await res.json();
      // 將敘事加入訊息紀錄
      setMessages(prev => [...prev, data.narration]);
      // 更新遊戲狀態（HP、Gold、items）
      setGameState(prev => ({
        ...prev,
        hp: data.hp ?? prev.hp,
        gold: data.gold ?? prev.gold,
        items: data.items ?? prev.items,
        // 在前端也維護 history，方便載入存檔時顯示
        history: [...(prev.history || []), data.narration]
      }));
      // 更新下一步的選項
      setOptions(data.options || []);
    } catch (err) {
      console.error('呼叫 API 發生錯誤', err);
    }
  }

  // 儲存遊戲進度
  async function handleSave() {
    try {
      await fetch('http://localhost:8000/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: 'default', game_state: gameState })
      });
      alert('遊戲已儲存！');
    } catch (err) {
      console.error('儲存失敗', err);
    }
  }

  // 載入遊戲進度
  async function handleLoad() {
    try {
      const res = await fetch('http://localhost:8000/api/load?player_id=default');
      const data = await res.json();
      if (data.game_state) {
        // 更新狀態與訊息
        setGameState(data.game_state);
        setMessages(data.game_state.history || []);
        setOptions([]);
      } else {
        alert('沒有可載入的存檔！');
      }
    } catch (err) {
      console.error('載入失敗', err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4">
      <h1 className="text-3xl font-bold mb-4 text-center">《語境之門 x LLM》</h1>
      <div className="flex flex-col md:flex-row w-full max-w-5xl">
        {/* 左側：遊戲敘事與選項 */}
        <div className="md:w-3/5 w-full p-4">
          {/* 顯示當前血量、金錢與物品 */}
          <div className="mb-2 text-sm">
            <strong>HP:</strong> {gameState.hp} &nbsp;
            <strong>Gold:</strong> {gameState.gold}
          </div>
          <div className="mb-2 text-sm">
            <strong>Items:</strong>
            {gameState.items.length > 0 ? (
              gameState.items.map((it, idx) => (
                <span key={idx} className="ml-2">{it.name} x {it.qty}</span>
              ))
            ) : (
              <span className="ml-2">無</span>
            )}
          </div>
          {/* 敘事訊息區塊 */}
          <div className="mb-4 h-64 overflow-y-auto border rounded p-2 bg-gray-50">
            {messages.map((msg, idx) => (
              <p key={idx} className="mb-2 p-2 rounded bg-white shadow">{msg}</p>
            ))}
          </div>
          {/* 動態選項按鈕 */}
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleTurn(opt)}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        {/* 右側：場景圖片 */}
        <div className="md:w-2/5 w-full p-4 flex items-center justify-center">
          <img
            src="https://via.placeholder.com/400x300"
            alt="placeholder"
            className="w-full h-auto object-cover rounded"
          />
        </div>
      </div>
      {/* 玩家自由輸入欄 */}
      <div className="w-full max-w-5xl mt-4 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入..."
          className="flex-grow p-2 border rounded-l"
        />
        <button
          onClick={() => { handleTurn(input); setInput(''); }}
          className="px-4 py-2 bg-green-500 text-white rounded-r hover:bg-green-600"
        >
          送出
        </button>
      </div>
      {/* 存檔／載入按鈕 */}
      <div className="w-full max-w-5xl mt-4 flex space-x-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          儲存遊戲
        </button>
        <button
          onClick={handleLoad}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          載入遊戲
        </button>
      </div>
    </div>
  );
}
