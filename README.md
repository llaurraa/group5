# 🌍 地理小百科 - Geography Quiz King

一個互動式地理知識問答遊戲，使用 React + TypeScript + Vite 開發。

## ✨ 功能特色

- 📚 豐富的地理知識題庫
- 🎨 精美的使用者介面設計
- 💯 即時計分系統
- 📱 響應式設計，支援各種裝置
- 🚀 使用 Vite 快速開發與建置

## 🛠️ 技術棧

- **前端框架**: React 19.2.1
- **語言**: TypeScript
- **建置工具**: Vite 6.2.0
- **樣式**: Tailwind CSS
- **圖標**: Lucide React
- **字體**: Noto Sans TC

## 📋 前置要求

- Node.js (建議版本 18 或以上)
- npm 或 yarn

## 🚀 快速開始

### 1. 克隆專案

```bash
git clone https://github.com/你的用戶名/group5.git
cd group5
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 設定環境變數

複製 `.env.local.example` 為 `.env.local` 並填入你的 Gemini API Key：

```bash
cp .env.local.example .env.local
```

在 `.env.local` 中填入你的 API Key：
```
GEMINI_API_KEY=你的_API_金鑰
```

取得 API Key：https://aistudio.google.com/app/apikey

### 4. 啟動開發伺服器

```bash
npm run dev
```

開發伺服器將在 `http://localhost:3000` 啟動。

## 📦 建置專案

建置生產版本：

```bash
npm run build
```

建置完成的文件將在 `dist` 目錄中。

## 👀 預覽生產版本

```bash
npm run preview
```

## 📁 專案結構

```
group5/
├── components/          # React 組件
│   ├── FooterBar.tsx
│   ├── QuestionCard.tsx
│   └── TopBar.tsx
├── App.tsx             # 主應用組件
├── index.tsx           # 應用入口
├── index.html          # HTML 模板
├── index.css           # 全域樣式
├── constants.ts        # 常數定義
├── quizData.ts         # 題庫資料
├── types.ts            # TypeScript 型別定義
├── vite.config.ts      # Vite 配置
├── tsconfig.json       # TypeScript 配置
└── package.json        # 專案依賴
```

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

## 📄 授權

此專案僅供學習使用。

## 👥 開發團隊

第五組
