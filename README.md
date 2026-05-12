# YouTube Playlist Manager 🎵

這是一個基於瀏覽器的 YouTube 影片片段管理工具，可以讓你針對單一 YouTube 影片自定義多個播放時間軸，實現類似「專輯曲目切換」或「精華片段播放」的功能。

## 🚀 公開部署連結
[https://philly12399.github.io/youtube-playlist/](https://philly12399.github.io/youtube-playlist/)

## ✨ 主要功能
- **兩種輸入模式**：
  - **Text 模式**：直接貼上 YouTube 網址，並使用簡單的文字格式（如 `00:01:20 歌曲名稱`）快速產生清單。
  - **JSON 模式**：支援匯入與導出標準 JSON 格式，方便進階管理。
- **個人歌單庫 (Library)**：利用瀏覽器本地儲存 (LocalStorage)，無需登入即可儲存多組歌單。
- **純音訊模式**：一鍵遮擋影片畫面，適合當作背景音樂播放器使用。
- **快捷鍵支援**：
  - `Space`: 播放 / 暫停
  - `Z`: 上一首
  - `X`: 下一首
  - `C`: 切換純音訊模式

## 📖 如何使用
1. **產生清單**：在左側「Input Playlist」區域輸入 YouTube 連結及時間點資訊。
2. **更新播放**：點擊「Update and Play」，右側會產生對應的曲目列表。
3. **儲存歌單**：點擊「Save Playlist to Library」，將當前進度存入瀏覽器庫中。
4. **管理歌單**：在庫中可以快速切換不同影片，或刪除不再需要的歌單。

## 🛠 技術棧
- 原生 JavaScript (ES6 Modules)
- YouTube IFrame Player API
- Pure.css (極簡樣式庫)
- JSZip (用於批次匯出歌單)

##  致謝
本專案的原始雛形靈感來自於 cytsunny/youtube-playlist。

## 📄 授權
本專案採用 MIT 授權。
---
*Made with ❤️ for YouTube Music Lovers.*
View on GitHub: philly12399/youtube-playlist