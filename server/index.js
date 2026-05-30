import express from "express";
import http from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

const UNIT_TYPES = ["步兵", "弓兵", "法師", "騎兵"];
const RANKS = ["初級", "中級", "高級"];
const DAMAGE = { 初級: 1, 中級: 3, 高級: 5 };
const COUNTER = { 步兵: "弓兵", 弓兵: "法師", 法師: "騎兵", 騎兵: "步兵" };

const KINGS = ["亞歷山大大帝", "屋大維奧古斯都", "成吉思汗", "秦始皇", "路易十四"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeUnits() {
  const counts = { 初級: 7, 中級: 5, 高級: 3 };
  const deck = [];
  for (const type of UNIT_TYPES) {
    for (const rank of RANKS) {
      for (let i = 0; i < counts[rank]; i++) {
        deck.push({
          id: nanoid(8),
          kind: "unit",
          name: `${rank}${type}`,
          type,
          rank,
          damage: DAMAGE[rank],
          counterTarget: COUNTER[type],
          tapped: false,
          status: [],
        });
      }
    }
  }
  return shuffle(deck);
}

function makeMagic() {
  const defs = [
    ["火球術", 2],
    ["冰凍術", 2],
    ["力量術", 3],
    ["虛弱術", 2],
    ["增強術", 2],
    ["流星雨", 1],
    ["毒藥瓶", 1],
    ["燃血術", 1],
    ["天殞術", 1],
  ];
  return shuffle(defs.flatMap(([name, count]) =>
    Array.from({ length: count }, () => ({ id: nanoid(8), kind: "magic", name }))
  ));
}

function publicPlayerView(player, viewerId) {
  const isMe = player.id === viewerId;
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    connected: player.connected,
    hp: player.hp,
    king: player.king,
    field: player.field,
    hand: isMe ? player.hand : [],
    magic: isMe ? player.magic : [],
    handCount: player.hand.length,
    magicCount: player.magic.length,
  };
}

function viewFor(room, viewerId) {
  return {
    roomCode: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    currentPlayerId: room.currentPlayerId,
    log: room.log.slice(-30),
    players: room.players.map((p) => publicPlayerView(p, viewerId)),
  };
}

function broadcastRoom(room) {
  for (const player of room.players) {
    io.to(player.socketId).emit("room:update", viewFor(room, player.id));
  }
}

function findRoomAndPlayer(socketId) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) return { room, player };
  }
  return null;
}

function createRoomCode() {
  let code = "";
  do {
    code = `KW${Math.floor(1000 + Math.random() * 9000)}`;
  } while (rooms.has(code));
  return code;
}

function startGame(room) {
  room.status = "playing";
  room.unitDeck = makeUnits();
  room.magicDeck = makeMagic();
  const kings = shuffle(KINGS);
  room.players.forEach((p, i) => {
    p.hp = 30;
    p.king = kings[i % kings.length];
    p.field = [];
    p.magic = [];
    p.hand = [];
    const initial = p.king === "秦始皇" ? 6 : 5;
    for (let c = 0; c < initial; c++) {
      if (room.unitDeck.length) p.hand.push(room.unitDeck.shift());
    }
  });
  room.currentPlayerId = room.players[0]?.id ?? null;
  room.log.push("遊戲開始。這是線上骨架版：目前先支援建房、加房、隱藏手牌、部署與結束回合。");
}

function requireCurrentTurn(room, player) {
  return room.status === "playing" && room.currentPlayerId === player.id;
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, maxPlayers }, reply) => {
    const code = createRoomCode();
    const playerId = nanoid(10);
    const player = {
      id: playerId,
      socketId: socket.id,
      name: String(name || "玩家").slice(0, 16),
      isHost: true,
      connected: true,
      hp: 30,
      king: null,
      hand: [],
      magic: [],
      field: [],
    };

    const room = {
      code,
      hostId: playerId,
      maxPlayers: Math.max(2, Math.min(5, Number(maxPlayers) || 2)),
      status: "lobby",
      players: [player],
      unitDeck: [],
      magicDeck: [],
      currentPlayerId: null,
      log: [`${player.name} 建立房間。`],
    };

    rooms.set(code, room);
    socket.join(code);
    reply?.({ ok: true, playerId, room: viewFor(room, playerId) });
    broadcastRoom(room);
  });

  socket.on("room:join", ({ name, code }, reply) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return reply?.({ ok: false, error: "找不到房間。" });
    if (room.status !== "lobby") return reply?.({ ok: false, error: "遊戲已開始，暫不支援中途加入。" });
    if (room.players.length >= room.maxPlayers) return reply?.({ ok: false, error: "房間已滿。" });

    const playerId = nanoid(10);
    const player = {
      id: playerId,
      socketId: socket.id,
      name: String(name || "玩家").slice(0, 16),
      isHost: false,
      connected: true,
      hp: 30,
      king: null,
      hand: [],
      magic: [],
      field: [],
    };

    room.players.push(player);
    room.log.push(`${player.name} 加入房間。`);
    socket.join(room.code);
    reply?.({ ok: true, playerId, room: viewFor(room, playerId) });
    broadcastRoom(room);
  });

  socket.on("game:start", (_, reply) => {
    const found = findRoomAndPlayer(socket.id);
    if (!found) return reply?.({ ok: false, error: "你不在房間中。" });
    const { room, player } = found;
    if (!player.isHost) return reply?.({ ok: false, error: "只有房主可以開始遊戲。" });
    if (room.players.length < 2) return reply?.({ ok: false, error: "至少需要 2 位玩家。" });

    startGame(room);
    reply?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("game:deploy", ({ cardId }, reply) => {
    const found = findRoomAndPlayer(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (!requireCurrentTurn(room, player)) return reply?.({ ok: false, error: "還沒輪到你。" });

    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return reply?.({ ok: false, error: "找不到這張手牌。" });
    if (player.field.length >= 5) return reply?.({ ok: false, error: "場上已滿。" });

    const [card] = player.hand.splice(idx, 1);
    player.field.push(card);
    room.log.push(`${player.name} 部署 ${card.name}。`);
    reply?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("game:endTurn", (_, reply) => {
    const found = findRoomAndPlayer(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (!requireCurrentTurn(room, player)) return reply?.({ ok: false, error: "還沒輪到你。" });

    const alive = room.players.filter((p) => p.hp > 0);
    const currentIndex = alive.findIndex((p) => p.id === player.id);
    const next = alive[(currentIndex + 1) % alive.length];
    room.currentPlayerId = next.id;

    if (room.unitDeck.length) next.hand.push(room.unitDeck.shift());
    room.log.push(`${player.name} 結束回合。換 ${next.name}。`);
    reply?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    const found = findRoomAndPlayer(socket.id);
    if (!found) return;
    const { room, player } = found;
    player.connected = false;
    room.log.push(`${player.name} 連線中斷。`);
    broadcastRoom(room);
  });
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`King War server running on http://localhost:${PORT}`);
});
