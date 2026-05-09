# 部署到 ClawCloud Run

本指南說明如何將 CCSP Web 部署到 [ClawCloud Run](https://run.clawcloud.com) App Launchpad。

---

## 架構總覽

| 元件 | 說明 |
|------|------|
| **Web 服務** | Next.js 15 standalone server，Port 3000 |
| **Python importer** | 打包在同一個 image，由 refresh-detail API 與 cron job 呼叫 |
| **資料庫** | SQLite，掛載於 Persistent Storage `/app/data` |
| **排程** | ClawCloud Run Cron Job，每日 04:00（UTC+8）|

> **重要：** SQLite 不支援多實例同時寫入，請將 instance count 設為 **1**。

---

## 前置條件

- Docker Desktop（本機 build image）
- GitHub 帳號（推送到 GHCR）或 Docker Hub 帳號
- ClawCloud Run 帳號

---

## 一、建立並推送 Docker Image

### 1-1 登入 GHCR

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u ansonhui6040 --password-stdin
```

### 1-2 Build image

在 repo 根目錄執行：

```bash
docker build -t ghcr.io/ansonhui6040/ccsp-web:latest .
```

### 1-3 推送

```bash
docker push ghcr.io/ansonhui6040/ccsp-web:latest
```

> **建議：** 設定 GitHub Actions 自動化（見第十章），push main 時自動 build + push。

---

## 二、在 ClawCloud Run 建立應用

### 2-1 進入 App Launchpad

登入 ClawCloud Run → 選擇區域（建議 **Singapore** / 台灣使用者延遲最低）→  
點選 **App Launchpad** → **Create App**。

### 2-2 設定 Image Source

| 欄位 | 值 |
|------|----|
| **Image** | `ghcr.io/ansonhui6040/ccsp-web:latest` |
| **Image Registry** | GitHub Container Registry（需設定 Secret 若為 private repo）|

若 image 為 private，先在 ClawCloud Run 加入 Image Pull Secret：  
Settings → Image Pull Secrets → 填入 `ghcr.io` / GitHub token。

### 2-3 設定 Port

| 欄位 | 值 |
|------|----|
| **Container Port** | `3000` |
| **Protocol** | HTTP |

### 2-4 啟用 Public Network Access

開啟 **Public Access**，ClawCloud Run 會分配一個公開 URL（例如 `https://xxxx.sealoshzh.site`）。  
若有自訂網域，可在 DNS 設定 CNAME 指向此 URL。

### 2-5 設定 Environment Variables

| 變數 | 值 |
|------|----|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_PATH` | `/app/data/ccsp.sqlite` |
| `CCSP_DB_PATH` | `/app/data/ccsp.sqlite` |
| `CCSP_DATA_DIR` | `/app/data` |
| `IMPORTER_PYTHON` | `/app/importer/.venv/bin/python` |
| `APP_ORIGIN` | `https://your-domain.example.com`（選填，有自訂網域時填入）|

### 2-6 設定 Persistent Storage

| 欄位 | 值 |
|------|----|
| **Mount Path** | `/app/data` |
| **Size** | 3 GB（可依需求調整）|

> **注意：** 必須在初次 deploy 之前設定好 storage，否則資料庫會放在 container 本地而在重啟後遺失。

### 2-7 設定 Instance Count

**Replicas = 1**（SQLite 不支援多實例同時寫入）。

### 2-8 部署

點選 **Deploy** 並等待容器啟動（約 1–2 分鐘）。

---

## 三、初始化資料庫

部署完成後，進入 ClawCloud Run **Terminal**（App 頁面 → Terminal tab）執行：

### 方法 A：使用 update_courses.sh（推薦）

```bash
cd /app
/app/importer/.venv/bin/python -m ccsp_importer.cli init-db
YEAR=114 SEMESTER=2 bash /app/scripts/update_courses.sh
```

### 方法 B：逐步執行

```bash
cd /app/importer

# 建立資料表
/app/importer/.venv/bin/python -m ccsp_importer.cli init-db

# 抓主課程資料
/app/importer/.venv/bin/python -m ccsp_importer.cli scrape --year 114 --semester 2

# 解析備註（tags / warnings / rules）
/app/importer/.venv/bin/python -m ccsp_importer.cli parse-notes --year 114 --semester 2
```

> `init-db` 只需在**第一次部署**時執行。之後每日更新只需執行 `scrape` + `parse-notes`。

---

## 四、設定 Cron Job（每日自動更新）

在 ClawCloud Run **Cron Jobs** 頁面建立：

| 欄位 | 值 |
|------|----|
| **Task Name** | `ccsp-update-main-courses` |
| **Task Type** | Execute Command |
| **Cron Expression** | `0 4 * * *` |
| **Command** | `YEAR=114 SEMESTER=2 bash /app/scripts/update_courses.sh` |

> ClawCloud Run Singapore 時區為 **UTC+8**，`0 4 * * *` 即每日台灣時間 04:00 執行。

---

## 五、測試 refresh-detail API

在瀏覽器開啟應用，進入任一課程詳細頁，點選「取得詳細資料」或「更新詳細資料」。

或用 curl（需從同源發出，帶 Origin header）：

```bash
curl -X POST \
  -H "Origin: https://your-domain.example.com" \
  https://your-domain.example.com/api/courses/114/2/COURSE_CODE/refresh-detail
```

預期回應：`{"ok": true}` 或包含課程詳細資料的 JSON。

---

## 六、更新 image（日後 re-deploy）

1. 本機重新 build + push：

   ```bash
   docker build -t ghcr.io/ansonhui6040/ccsp-web:latest .
   docker push ghcr.io/ansonhui6040/ccsp-web:latest
   ```

2. 在 ClawCloud Run 點選 **Redeploy** 或勾選 **Auto Update Image**。

若啟用 GitHub Actions（第十章），push main 會自動 build + push，ClawCloud Run 開啟 Auto Update 後會自動拉取新 image。

---

## 七、Environment Variables 完整列表

| 變數 | 預設值（image 內） | 說明 |
|------|--------------------|------|
| `NODE_ENV` | `production` | Next.js 模式 |
| `PORT` | `3000` | HTTP 監聽 port |
| `HOSTNAME` | `0.0.0.0` | 綁定所有介面 |
| `DATABASE_PATH` | `/app/data/ccsp.sqlite` | SQLite 路徑（web + importer）|
| `CCSP_DB_PATH` | `/app/data/ccsp.sqlite` | 備用 SQLite 路徑 |
| `CCSP_DATA_DIR` | `/app/data` | Importer 資料目錄 |
| `IMPORTER_PYTHON` | `/app/importer/.venv/bin/python` | Python 可執行檔路徑 |
| `APP_ORIGIN` | —（選填）| 自訂網域，用於 same-origin check |

---

## 八、資料備份

在 ClawCloud Run Terminal 執行：

```bash
cp /app/data/ccsp.sqlite /app/data/ccsp.$(date '+%Y%m%d').sqlite.bak
```

或從 ClawCloud Run 的 Persistent Storage 管理頁面下載檔案。

---

## 九、常見問題

### Q: 容器啟動後網頁顯示資料庫錯誤

A: 確認 Persistent Storage 已掛載到 `/app/data`，且已執行 `init-db`。

### Q: refresh-detail API 回傳 403

A: 確認請求帶有正確的 `Origin` header（與應用網域相同），或在開發模式下測試。

### Q: refresh-detail API 回傳 429

A: 同一 IP 超過每分鐘 5 次限制，稍後再試。

### Q: update_courses.sh 失敗，找不到 python

A: 確認 `IMPORTER_PYTHON=/app/importer/.venv/bin/python` 已設定在 Environment Variables。

### Q: SQLite database is locked

A: Instance count 超過 1，請調回 1。ClawCloud Run 重啟容器時也可能短暫出現，重試即可。

### Q: GHCR image pull 失敗（401 Unauthorized）

A: 若 repository 為 private，需在 ClawCloud Run 設定 Image Pull Secret。  
或將 GitHub Packages 設定為 public visibility。

### Q: Cron Job 沒有執行

A: 確認 Cron Expression 格式正確（`0 4 * * *`），且 ClawCloud Run Cron Job 頁面顯示 **Enabled**。  
查看 Cron Job logs 確認執行結果。
