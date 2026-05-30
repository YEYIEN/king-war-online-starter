import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./style.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

function App() {
  const socket = useMemo(() => io(SERVER_URL), []);
  const [name, setName] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState("");

  React.useEffect(() => {
    socket.on("room:update", (nextRoom) => setRoom(nextRoom));
    return () => socket.off("room:update");
  }, [socket]);

  function safeName() {
    return name.trim() || "玩家";
  }

  function createRoom() {
    socket.emit("room:create", { name: safeName(), maxPlayers }, (res) => {
      if (!res?.ok) return setMessage(res?.error || "建立失敗");
      setPlayerId(res.playerId);
      setRoom(res.room);
      setMessage("");
    });
  }

  function joinRoom() {
    socket.emit("room:join", { name: safeName(), code: roomCodeInput }, (res) => {
      if (!res?.ok) return setMessage(res?.error || "加入失敗");
      setPlayerId(res.playerId);
      setRoom(res.room);
      setMessage("");
    });
  }

  function startGame() {
    socket.emit("game:start", {}, (res) => {
      if (!res?.ok) setMessage(res?.error || "開始失敗");
    });
  }

  function deploy(cardId) {
    socket.emit("game:deploy", { cardId }, (res) => {
      if (!res?.ok) setMessage(res?.error || "無法部署");
      else setMessage("");
    });
  }

  function endTurn() {
    socket.emit("game:endTurn", {}, (res) => {
      if (!res?.ok) setMessage(res?.error || "無法結束回合");
      else setMessage("");
    });
  }

  if (!room) {
    return (
      <main className="page centered">
        <section className="card hero">
          <h1>國王戰爭 Online</h1>
          <p>線上多人骨架版：先測試建房、加房、隱藏手牌與同步。</p>

          <label>暱稱 / 遊戲 ID</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 Wayne" />

          <div className="twoCols">
            <section>
              <h2>創建房間</h2>
              <label>遊玩人數</label>
              <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 人</option>)}
              </select>
              <button onClick={createRoom}>創建房間</button>
            </section>

            <section>
              <h2>加入房間</h2>
              <label>房間代碼</label>
              <input value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="例如 KW1234" />
              <button onClick={joinRoom}>加入房間</button>
            </section>
          </div>

          {message && <p className="error">{message}</p>}
        </section>
      </main>
    );
  }

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const isMyTurn = room.currentPlayerId === playerId;

  if (room.status === "lobby") {
    return (
      <main className="page centered">
        <section className="card hero">
          <h1>房間 {room.roomCode}</h1>
          <p>把房間代碼傳給朋友，讓他們加入。</p>
          <p>人數：{room.players.length} / {room.maxPlayers}</p>

          <div className="playerList">
            {room.players.map((p) => (
              <div key={p.id} className="playerRow">
                <strong>{p.name}</strong>
                <span>{p.isHost ? "房主" : "玩家"}｜{p.connected ? "在線" : "斷線"}</span>
              </div>
            ))}
          </div>

          {isHost ? <button onClick={startGame}>開始遊戲</button> : <p>等待房主開始遊戲...</p>}
          {message && <p className="error">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>國王戰爭 Online</h1>
          <p>房間 {room.roomCode}｜{isMyTurn ? "輪到你" : "等待其他玩家"}</p>
        </div>
        <button disabled={!isMyTurn} onClick={endTurn}>結束回合</button>
      </header>

      {message && <p className="error">{message}</p>}

      <section className="players">
        {room.players.map((p) => (
          <article key={p.id} className={`playerCard ${p.id === room.currentPlayerId ? "active" : ""}`}>
            <h2>{p.name}{p.id === playerId ? "（你）" : ""}</h2>
            <p>HP {p.hp}｜國王：{p.king || "未抽取"}</p>
            <p>手牌 {p.handCount}｜魔法 {p.magicCount}</p>
            <h3>場上兵種</h3>
            <div className="miniGrid">
              {p.field.map((card) => <div key={card.id} className="miniCard">{card.name}</div>)}
            </div>
          </article>
        ))}
      </section>

      <section className="myArea">
        <div className="card">
          <h2>你的兵種手牌</h2>
          <div className="hand">
            {me?.hand.map((card) => (
              <button key={card.id} className="gameCard" disabled={!isMyTurn} onClick={() => deploy(card.id)}>
                <strong>{card.name}</strong>
                <span>傷害 {card.damage}｜剋 {card.counterTarget}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>你的魔法卡</h2>
          <div className="hand">
            {me?.magic.map((card) => <div key={card.id} className="gameCard">{card.name}</div>)}
          </div>
        </div>

        <div className="card">
          <h2>遊戲紀錄</h2>
          <div className="log">
            {room.log.slice().reverse().map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
