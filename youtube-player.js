import * as auth from './auth.js';

let player;
let debouncing = false;

// YouTube Data API 配置
let YOUTUBE_API_KEY = ""; 
const REQUEST_DELAY_MS = 1000;
let lastRequestTime = 0;
let videoMetadataCache = new Map();

/**
 * 設定 API 金鑰
 */
export function setApiKey(key) {
  YOUTUBE_API_KEY = key;
}

/**
 * 解析 YouTube ISO 8601 持續時間格式 (例如 PT1M30S)
 */
function parseISODuration(duration) {
  const match = duration.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const days = parseInt(match[1] || 0);
  const hours = parseInt(match[2] || 0);
  const minutes = parseInt(match[3] || 0);
  const seconds = parseInt(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * 取得影片元數據（包含上傳日期）
 */
export async function getVideoMetadata(videoId) {
  // 檢查快取
  if (videoMetadataCache.has(videoId)) {
    return videoMetadataCache.get(videoId);
  }

  // 速率限制：每個請求之間間隔 1 秒
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    await new Promise(r => 
      setTimeout(r, REQUEST_DELAY_MS - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.append("part", "snippet,contentDetails");
    url.searchParams.append("id", videoId);

    const headers = {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // 若已登入，使用 OAuth token；否則使用 API Key
    if (auth.isLoggedIn()) {
      headers["Authorization"] = `Bearer ${auth.getAccessToken()}`;
    } else {
      url.searchParams.append("key", YOUTUBE_API_KEY);
    }

    let response = await fetch(url.toString(), {
      method: "GET",
      headers
    });

    // 如果使用 Token 請求失敗（401/403），嘗試退回到 API Key 模式再試一次
    if ((response.status === 401 || response.status === 403) && auth.isLoggedIn() && YOUTUBE_API_KEY) {
        const fallbackUrl = new URL(url.toString());
        fallbackUrl.searchParams.append("key", YOUTUBE_API_KEY);
        response = await fetch(fallbackUrl.toString(), {
            method: "GET",
            headers: { "Accept": "application/json" }
        });
    }

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("API 速率限制，等待後重試...");
        await new Promise(r => setTimeout(r, 5000));
        return getVideoMetadata(videoId);
      }
      throw new Error(`API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items?.[0]) return null;

    const item = data.items[0];
    const metadata = {
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      duration: parseISODuration(item.contentDetails?.duration || "PT0S")
    };

    // 快取 24 小時
    videoMetadataCache.set(videoId, metadata);
    setTimeout(() => videoMetadataCache.delete(videoId), 24 * 60 * 60 * 1000);

    return metadata;
  } catch (error) {
    console.error("無法取得影片元數據:", error);
    return null;
  }
}

/**
 * 初始化 YouTube 播放器
 */
export function initPlayer(config) {
    const setupPlayer = () => {
        if (player) return; // 避免重複初始化
        player = new YT.Player("video-youtube", {
            host: 'https://www.youtube.com', // 強制使用主站來源
            height: "500px",
            width: "1000px",
            videoId: config.videoId || "",
            playerVars: {
                autoplay: config.autoplay !== undefined ? config.autoplay : 1, 
                start: config.start || 0,
                end: config.end || 0,
                origin: window.location.protocol === 'file:' ? null : window.location.origin,
                enablejsapi: 1,
                widget_referrer: window.location.href,
                rel: 0,
                iv_load_policy: 3
            },
            events: {
                onReady: (event) => {
                    if (config.onReady) config.onReady(player);
                },
                onStateChange: (event) => handleStateChange(event, config.onStateChange),
                onError: (event) => {
                    console.error("YouTube Player Error:", event.data);
                    if (config.onError) config.onError(event);
                }
            },
        });
    };

    // 如果 API 已經載入完成，直接初始化
    if (window.YT && window.YT.Player) {
        setupPlayer();
        return;
    }

    window.onYouTubeIframeAPIReady = setupPlayer;

    // 載入 API 腳本
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            document.head.appendChild(tag);
        }
    }
}

function handleStateChange(event, externalCallback) {
    if (event.data == YT.PlayerState.PLAYING) debouncing = false;
    
    // 處理自動下一首的防抖動邏輯
    let shouldPlayNext = false;
    if (!debouncing && event.data == YT.PlayerState.ENDED) {
        debouncing = true;
        shouldPlayNext = true;
    }
    
    if (externalCallback) externalCallback(event, shouldPlayNext);
}

export function loadVideo(videoId, start, end) {
    if (!player || typeof player.loadVideoById !== "function") return;
    player.loadVideoById({
        videoId: videoId,
        startSeconds: start,
        endSeconds: end,
    });
}

export function cueVideo(videoId, start, end) {
    if (!player || typeof player.cueVideoById !== "function") return;
    player.cueVideoById({
        videoId: videoId,
        startSeconds: start,
        endSeconds: end,
    });
}

export function togglePlay() {
    if (!player || typeof player.getPlayerState !== "function") return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

export function getPlayerState() {
    if (!player || typeof player.getPlayerState !== "function") return null;
    return player.getPlayerState();
}

export function getPlayer() {
    return player;
}

export function updatePlayPauseButton(buttonElement) {
    if (!buttonElement) return;
    const state = getPlayerState();
    if (state === null || !window.YT) {
        buttonElement.textContent = "⏯ Play/Pause (space)";
        return;
    }
    buttonElement.textContent =
        state === YT.PlayerState.PLAYING ? "⏸ (space)" : "▶ (space)";
}

/**
 * 取得使用者的 YouTube 頻道信息（需要認證）
 */
export async function getUserChannelInfo() {
  if (!auth.isLoggedIn()) {
    console.warn("使用者未登入");
    return null;
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true",
      {
        headers: {
          "Authorization": `Bearer ${auth.getAccessToken()}`,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);

    const data = await response.json();
    return data.items?.[0] || null;
  } catch (error) {
    console.error("無法取得頻道信息:", error);
    return null;
  }
}

/**
 * 取得使用者的播放清單（需要認證）
 */
export async function getUserPlaylists() {
  if (!auth.isLoggedIn()) {
    console.warn("使用者未登入");
    return [];
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50",
      {
        headers: {
          "Authorization": `Bearer ${auth.getAccessToken()}`,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("無法取得播放清單:", error);
    return [];
  }
}

/**
 * 取得特定播放清單中的影片內容
 */
export async function getPlaylistItems(playlistId) {
  if (!auth.isLoggedIn()) return [];

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`,
      {
        headers: {
          "Authorization": `Bearer ${auth.getAccessToken()}`,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);

    const data = await response.json();
    // 將 YouTube 的格式轉為我們專案用的格式
    return (data.items || []).map(item => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      start: 0,
      end: 3600 // 預設 1 小時，之後可由 metadata 更新
    }));
  } catch (error) {
    console.error("無法取得播放清單內容:", error);
    return [];
  }
}

/**
 * 取得影片留言
 */
export async function getVideoComments(videoId) {
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    url.searchParams.append("part", "snippet");
    url.searchParams.append("videoId", videoId);
    url.searchParams.append("maxResults", "5"); 
    url.searchParams.append("order", "relevance");
    url.searchParams.append("textFormat", "plainText"); 

    const headers = {
      "Accept": "application/json"
    };

    const token = auth.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (YOUTUBE_API_KEY && YOUTUBE_API_KEY.startsWith("AIza")) {
      url.searchParams.append("key", YOUTUBE_API_KEY);
    } else {
      console.warn("⚠️ 留言功能缺少憑證：Token 為空且 API_KEY 格式不正確。請登入或檢查 youtube-player.js 設定。");
      return { error: true, status: 401, reason: "請先登入 Google 或檢查 API Key 設定" };
    }

    let response = await fetch(url.toString(), { headers });

    // 關鍵修復：如果登入狀態下請求留言失敗（Token 過期或權限衝突），自動嘗試用 API Key 重新抓取（訪客模式）
    if ((response.status === 401 || response.status === 403) && token && YOUTUBE_API_KEY) {
      const fallbackUrl = new URL(url.toString());
      fallbackUrl.searchParams.append("key", YOUTUBE_API_KEY);
      // 移除 Authorization 標頭，純粹使用 API Key
      response = await fetch(fallbackUrl.toString(), {
        headers: { "Accept": "application/json" }
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: true, 
        status: response.status, 
        reason: errorData.error?.errors?.[0]?.reason 
      };
    }

    const data = await response.json();
    if (!data.items) return [];

    return data.items.map(item => {
      const comment = item.snippet?.topLevelComment?.snippet;
      return {
        author: comment?.authorDisplayName || "Unknown",
        text: comment?.textOriginal || comment?.textDisplay || ""
      };
    });
  } catch (error) {
    console.error("無法取得留言:", error);
    return [];
  }
}