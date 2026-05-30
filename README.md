# 國王戰爭 Online Starter

這是《國王戰爭》的線上多人骨架版。  
第一階段目標是先做到：朋友可以透過連結進入、創建房間、加入房間、隱藏手牌、同步基本場面。

目前功能：
- 輸入暱稱
- 創建房間
- 加入房間
- 房主選 2～5 人
- 房主開始遊戲
- 每位玩家只能看到自己的手牌
- 其他玩家只看到手牌數量與場上兵種
- 基本部署兵種
- 結束回合同步

尚未完整搬入：
- 完整戰鬥規則
- 魔法指定流程
- 國王卡全部被動判定
- 高級整備制
- 弓兵 / 法師完整細節

## 本機測試

先安裝 Node.js。

在此資料夾打開 PowerShell：

```powershell
npm install
cd client
npm install
cd ..
npm run dev
```

開兩個瀏覽器分頁，進入：

```text
http://localhost:5173
```

一個分頁創房，另一個分頁加入房間，即可測試多人同步。

## 部署成公開連結

最簡單方式：

1. 把這個資料夾上傳到 GitHub
2. 用 Render 建立 Web Service
3. Build Command：

```bash
npm install && cd client && npm install && npm run build
```

4. Start Command：

```bash
npm start
```

5. Render 會給你一個公開連結，例如：

```text
https://king-war-online.onrender.com
```

把這個連結傳給朋友即可。
