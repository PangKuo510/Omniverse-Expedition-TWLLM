"use client";

import { useEffect, useMemo, useState } from 'react';

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
  const [apiKey, setApiKey] = useState('');        // 動態輸入的 OpenAI API Key
  const [status, setStatus] = useState('');        // 顯示系統狀態/錯誤
  const [apiBase, setApiBase] = useState('');      // 後端 API 位址

  // 初始化時從 localStorage 讀取 API Key 與 API Base
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedKey = window.localStorage.getItem('oe_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
    const savedBase = window.localStorage.getItem('oe_api_base');
    if (savedBase) {
      setApiBase(savedBase);
    } else {
      setApiBase('http://localhost:8000');
    }
  }, []);

  function persistApiKey(value) {
    setApiKey(value);
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem('oe_api_key', value);
      } else {
        window.localStorage.removeItem('oe_api_key');
      }
    }
  }

  function persistApiBase(value) {
    setApiBase(value);
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem('oe_api_base', value);
      } else {
        window.localStorage.removeItem('oe_api_base');
      }
    }
  }

  const resolvedApiBase = useMemo(() => {
    const trimmed = (apiBase || '').trim();
    if (trimmed) return trimmed.replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, [apiBase]);

  // 呼叫後端 /api/turn 並更新畫面
  async function handleTurn(playerInput) {
    if (!playerInput) return;
    const base = resolvedApiBase;
    if (!base) {
      setStatus('請先設定後端 API 位址。');
      return;
    }
    try {
      setStatus('');
      const res = await fetch(`${base}/api/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerInput, gameState, apiKey })
      });
      if (!res.ok) {
        throw new Error(`伺服器回應錯誤：${res.status}`);
      }
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
      setStatus('呼叫 API 發生錯誤，請確認後端服務與 API Key 設定。');
    }
  }

  // 儲存遊戲進度
  async function handleSave() {
    const base = resolvedApiBase;
    if (!base) {
      setStatus('請先設定後端 API 位址。');
      return;
    }
    try {
      setStatus('');
      await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: 'default', game_state: gameState })
      });
      alert('遊戲已儲存！');
    } catch (err) {
      console.error('儲存失敗', err);
      setStatus('儲存失敗，請確認後端服務是否運行。');
    }
  }

  // 載入遊戲進度
  async function handleLoad() {
    const base = resolvedApiBase;
    if (!base) {
      setStatus('請先設定後端 API 位址。');
      return;
    }
    try {
      setStatus('');
      const res = await fetch(`${base}/api/load?player_id=default`);
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
      setStatus('載入失敗，請確認後端服務是否運行。');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4">
      <h1 className="text-3xl font-bold mb-4 text-center">《語境之門 x LLM》</h1>
      {/* API Key 設定區塊 */}
      <div className="w-full max-w-5xl mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="api-base-input">
            後端 API 位址
          </label>
          <div className="flex">
            <input
              id="api-base-input"
              type="text"
              value={apiBase}
              onChange={(e) => persistApiBase(e.target.value)}
              placeholder="http://localhost:8000"
              className="flex-grow p-2 border rounded-l"
            />
            <button
              type="button"
              onClick={() => persistApiBase(apiBase)}
              className="px-4 py-2 bg-slate-600 text-white rounded-r hover:bg-slate-700"
            >
              保存位置
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            若部署於遠端主機，請輸入完整的公開網址（例：<code>https://example.com</code>）。
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="api-key-input">
            OpenAI API Key（僅在瀏覽器暫存）
          </label>
          <div className="flex">
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => persistApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-grow p-2 border rounded-l"
            />
            <button
              type="button"
              onClick={() => persistApiKey(apiKey)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-r hover:bg-emerald-700"
            >
              保存金鑰
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            API Key 只會保存在瀏覽器的 localStorage，不會傳到其他地方。
          </p>
        </div>
      </div>
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
      {status && (
        <div className="w-full max-w-5xl mt-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded">
          {status}
        </div>
      )}
    </div>
  );
}
