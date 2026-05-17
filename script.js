import * as utils from './utils.js';
import * as store from './storage.js';
import * as ui from './ui.js';
import * as yt from './youtube-player.js';
import * as auth from './auth.js';

const APP_VERSION = "1.1.0";

let playList = [
  {
    videoId: "dQw4w9WgXcQ", // Default to a well-known video
    start: 0,
    end: 200,
    title: "Rick Astley - Never Gonna Give You Up",
  },
];

let textarea = document.getElementById("playlist-object");
let inputModeSelect = document.getElementById("input-mode");
let jsonModePanel = document.getElementById("json-mode-panel");
let textModePanel = document.getElementById("text-mode-panel");
let durationSettingWrapper = document.getElementById("duration-setting-wrapper");
let defaultDurationInput = document.getElementById("default-video-duration");
let videoUrlInput = document.getElementById("playlist-video-url");
let timelineTextarea = document.getElementById("playlist-timelines");
let videoContainer = document.querySelector(".video-container");
let autoTimelineBtn = document.getElementById("auto-timeline-btn");
let prevButton = document.getElementById("prev-button");
let nextButton = document.getElementById("next-button");
let playPauseButton = document.getElementById("play-pause-button");
let audioOnlyButton = document.getElementById("audio-only-button");
let autoplayButton = document.getElementById("autoplay-toggle");
let savePlaylistButton = document.getElementById("save-playlist-button");
let exportLibraryButton = document.getElementById("export-library-button");
let importLibraryButton = document.getElementById("import-library-button");
let importLibraryInput = document.getElementById("import-library-input");
let isAudioOnlyMode = false;
let isAutoplayEnabled = false;
let isLibraryCollapsed = false;
let isPlaylistCollapsed = false;
let activeLibraryName = null;
let currentId = 0;

let playListElement = document.getElementById("play-list");
if (!playListElement) {
  console.error("Critical: 'play-list' element not found.");
}

const updatePlayList = () => {
  ui.renderPlayList(playListElement, playList, currentId);
  ui.updateTitles(yt.getPlayer(), playList, currentId);
};

playListElement?.addEventListener("click", function(event) {
  const target = event.target.closest(".playlist-item");
  if (!target) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  playByIndex(index, true); // 手動點擊清單項目強制播放
});

inputModeSelect?.addEventListener("change", function() {
  applyInputMode(inputModeSelect.value);
  saveToStorage();
});

function saveToStorage() {
  store.saveState({
    playList,
    currentId,
    isAudioOnlyMode,
    isAutoplayEnabled,
    inputMode: inputModeSelect.value, // 儲存目前的輸入模式
    isLibraryCollapsed,
    isPlaylistCollapsed,
    activeLibraryName
  });
}

function loadFromStorage() {
  const data = store.loadState();
  if (data) {
    if (Array.isArray(data.playList)) playList = data.playList;
    if (typeof data.currentId === 'number') currentId = data.currentId;
    if (typeof data.isAudioOnlyMode === 'boolean') isAudioOnlyMode = data.isAudioOnlyMode;
    if (typeof data.isAutoplayEnabled === 'boolean') isAutoplayEnabled = data.isAutoplayEnabled;
    if (data.inputMode) inputModeSelect.value = data.inputMode;
    if (typeof data.isLibraryCollapsed === 'boolean') isLibraryCollapsed = data.isLibraryCollapsed;
    if (typeof data.isPlaylistCollapsed === 'boolean') isPlaylistCollapsed = data.isPlaylistCollapsed;
    if (data.activeLibraryName) activeLibraryName = data.activeLibraryName;
  }
}

// 處理多組歌單庫的功能
function saveCurrentPlaylistToLibrary(playlistNameOverride = null) {
  if (!playList || playList.length === 0 || !playList[0].videoId) return;

  let library = store.getLibrary();
  const currentVideoId = playList[0].videoId;

  let existingKeyForUrl = store.findPlaylistByVideoId(currentVideoId);
  
  // 名稱優先序：手動指定 > 目前載入的歌單名稱 > YouTube 影片標題 > 第一首曲目標題
  let playlistName = playlistNameOverride || activeLibraryName;

  if (!playlistName) {
    const player = yt.getPlayer();
    if (player && typeof player.getVideoData === "function" && player.getVideoData()?.title) {
      playlistName = player.getVideoData().title;
    } else if (playList[0].title) {
      playlistName = playList[0].title;
    } else {
      playlistName = `Video: ${playList[0].videoId}`;
    }
  }

  // 如果找到相同 URL 但名稱不同的舊歌單，先將其刪除以實現「以 URL 為準」的覆蓋
  if (existingKeyForUrl && existingKeyForUrl !== playlistName) {
    delete library[existingKeyForUrl];
  }

  // 只要 URL 存在過，或是名稱重複，皆視為「更新」
  const isOverwriting = !!existingKeyForUrl || library.hasOwnProperty(playlistName);

  // 直接賦值即可達成覆蓋舊歌單的邏輯 (Silent Overwrite)
  library[playlistName] = {
    playList: JSON.parse(JSON.stringify(playList)),
    inputMode: inputModeSelect?.value || "text",
    currentId: currentId
  };

  activeLibraryName = playlistName;
  store.saveLibrary(library);
  saveToStorage();
  refreshLibraryUI();

  if (isOverwriting) {
    ui.showToast(`Playlist "${playlistName}" updated.`, "success");
  } else {
    ui.showToast(`Playlist "${playlistName}" saved.`, "success");
  }
}

function deletePlaylistFromLibrary(name) {
  store.deletePlaylist(name);
  if (activeLibraryName === name) activeLibraryName = null;
  saveToStorage();
  refreshLibraryUI();
  ui.showToast(`Playlist "${name}" deleted.`, "success");
}

function refreshLibraryUI() {
  ui.renderLibraryMenu(store.getLibrary(), activeLibraryName, {
    onLoad: loadLibraryPlaylist,
    onDelete: deletePlaylistFromLibrary
  });
}

function syncInputFieldsFromPlaylist() {
  if (textarea) textarea.value = JSON.stringify(playList, null, 2);
  if (videoUrlInput) videoUrlInput.value = playList[0] ? `https://www.youtube.com/watch?v=${playList[0].videoId}` : "";
  if (timelineTextarea) {
    timelineTextarea.value = playList.map(item => {
      const start = utils.formatSecondsToText(item.start);
      const end = utils.formatSecondsToText(item.end);
      return `${start} ${end} ${item.title || ""}`.trim();
    }).join("\n");
  }
}

function applyInputMode(mode) {
  if (!jsonModePanel || !textModePanel) return;
  const useTextMode = mode === "text";
  jsonModePanel.style.display = useTextMode ? "none" : "block";
  textModePanel.style.display = useTextMode ? "block" : "none";
  if (durationSettingWrapper) durationSettingWrapper.style.display = useTextMode ? "block" : "none";
}

function playByIndex(index, forcePlay = undefined) {
  if (!playList || playList.length === 0) {
    updatePlayList();
    return;
  }
  
  const safeIndex = Math.min(Math.max(0, index), playList.length - 1);
  currentId = safeIndex;
  
  updatePlayList();
  
  // 自動捲動到當前播放項目
  const activeItem = playListElement?.querySelector(".playlist-item.active");
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const shouldPlay = forcePlay ?? isAutoplayEnabled;

  if (shouldPlay) {
    yt.loadVideo(
      playList[currentId].videoId,
      playList[currentId].start,
      playList[currentId].end
    );
  } else {
    yt.cueVideo(
      playList[currentId].videoId,
      playList[currentId].start,
      playList[currentId].end
    );
  }
  updateCommentsDisplay(playList[currentId].videoId);
  saveToStorage();
}

function playPrevious(forcePlay = undefined) {
  if (!playList.length) return;
  const prevIndex = currentId > 0 ? currentId - 1 : 0;
  playByIndex(prevIndex, forcePlay);
}

function playNext(forcePlay = undefined) {
  if (!playList.length) return;
  const nextIndex = currentId < playList.length - 1 ? currentId + 1 : currentId;
  playByIndex(nextIndex, forcePlay);
}

function togglePlayPause() {
  yt.togglePlay();
}

function updatePlayPauseButtonLabel() {
  yt.updatePlayPauseButton(playPauseButton);
}

function updateTogglesUI() {
  if (audioOnlyButton) {
    audioOnlyButton.classList.toggle("on", isAudioOnlyMode);
  }
  if (autoplayButton) {
    autoplayButton.classList.toggle("on", isAutoplayEnabled);
  }
}

function toggleAudioOnlyMode() {
  isAudioOnlyMode = !isAudioOnlyMode;
  videoContainer?.classList.toggle("audio-only", isAudioOnlyMode);
  updateTogglesUI();
  saveToStorage();
}

function toggleAutoplayMode() {
  isAutoplayEnabled = !isAutoplayEnabled;
  updateTogglesUI();
  saveToStorage();
}

prevButton?.addEventListener("click", () => playPrevious(true));
nextButton?.addEventListener("click", () => playNext(true));
playPauseButton?.addEventListener("click", togglePlayPause);

// 改回監聽 click 事件
audioOnlyButton?.addEventListener("click", toggleAudioOnlyMode);
autoplayButton?.addEventListener("click", toggleAutoplayMode);

function handleGlobalHotkey(event) {
  const target = event.target;
  const isTypingTarget =
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable);
  if (isTypingTarget) return;

  const key = (event.key || "").toLowerCase();

  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.code === "Space" || key === " ") {
    event.preventDefault();
    event.stopPropagation();
    togglePlayPause();
    return;
  }

  if (key === "c") {
    event.preventDefault();
    event.stopPropagation();
    toggleAudioOnlyMode();
    return;
  }

  if (key === "z") {
    event.preventDefault();
    event.stopPropagation();
    playPrevious(true);
    return;
  }
  if (key === "x") {
    event.preventDefault();
    event.stopPropagation();
    playNext(true);
  }
}

document.addEventListener("keydown", handleGlobalHotkey, true);

let updateButton = document.getElementById("update-button");
let exportButton = document.getElementById("export-button");
let importButton = document.getElementById("import-button");
let importFileInput = document.getElementById("import-file-input"); // This is for single playlist import
updateButton?.addEventListener("click", async function (event) {
  if (inputModeSelect?.value === "json") {
    let playListString = textarea?.value || "[]";
    try {
      playList = JSON.parse(playListString);
      if (!Array.isArray(playList)) {
        alert("JSON must be an array of tracks.");
        return;
      }
    } catch (exception) {
      alert("JSON format error. Please check your input and try again.");
      return;
    }
  } else {
    const urlValue = videoUrlInput?.value?.trim() || videoUrlInput?.placeholder || "";
    const videoId = utils.extractVideoId(urlValue);
    if (!videoId) {
      alert("Please provide a valid YouTube URL.");
      return;
    }

    // 針對 defaultDurationInput 進行更嚴謹的數值解析
    const rawDuration = defaultDurationInput?.value;
    let defaultDuration = 300; // 預設值

    if (rawDuration !== undefined && rawDuration !== null && rawDuration.trim() !== '') {
      const parsed = parseInt(rawDuration, 10); // 確保使用十進位解析
      if (!isNaN(parsed) && parsed >= 1) { // 確保是有效數字且大於等於 1
        defaultDuration = parsed;
      }
    }
    console.log("Default Duration Input Value:", rawDuration, "-> Parsed Default Duration:", defaultDuration); // 除錯日誌

    const timelineValue = timelineTextarea?.value?.trim();

    if (!timelineValue) {
      // 如果 Timeline Text 為空，自動播放全片 (0 到 影片長度)
      const metadata = await yt.getVideoMetadata(videoId);
      playList = [{
        videoId,
        start: 0,
        end: metadata ? metadata.duration : 86400, // 沒抓到則預設一個大值
        title: metadata ? metadata.title : "Full Video",
      }];
    } else {
      const parsedRows = utils.parseTimelineText(timelineValue, defaultDuration);
      if (!parsedRows.length) {
        alert("No valid timeline rows found.");
        return;
      }
      playList = parsedRows.map((row) => ({
        videoId,
        start: row.start,
        end: row.end || (row.start + defaultDuration),
        title: row.title,
      }));
    }
  }

  currentId = 0;
  activeLibraryName = null; // 重新輸入視為新歌單
  updatePlayList(); // 立即更新 UI 計數
  syncInputFieldsFromPlaylist();
  playByIndex(currentId); // 遵循 Autoplay 設定
  refreshLibraryUI();
  ui.showToast("Playlist updated.", "success");
});

function loadLibraryPlaylist(name) {
  const library = store.getLibrary();
  const data = library[name];
  if (data) {
    playList = data.playList;
    inputModeSelect.value = data.inputMode || "text";
    currentId = data.currentId || 0;
    activeLibraryName = name;
    saveToStorage();
    applyInputMode(inputModeSelect.value);
    refreshLibraryUI();
    syncInputFieldsFromPlaylist();
    ui.showToast(`Playlist "${name}" loaded.`, "info");
    playByIndex(currentId);
  }
}

savePlaylistButton?.addEventListener("click", () => saveCurrentPlaylistToLibrary()); // This button saves the current playlist to library

exportLibraryButton?.addEventListener("click", function() {
  const library = store.getLibrary();
  const playlistNames = Object.keys(library);

  if (playlistNames.length === 0) {
    alert("No playlists in the library to export.");
    return;
  }

  // 彈出確認視窗，顯示即將匯出的歌單數量
  if (!confirm(`You are about to export all ${playlistNames.length} playlists in your library. Proceed?`)) {
    return;
  }

  // 檢查 JSZip 是否載入成功
  if (typeof JSZip === "undefined") {
    alert("JSZip library is not loaded. Please check your internet connection.");
    return;
  }

  const zip = new JSZip();
  
  playlistNames.forEach(playlistName => {
    const playlistData = library[playlistName];
    const fileName = `${utils.sanitizeStringForFilename(playlistName)}.json`;
    // 將檔案加入 ZIP
    zip.file(fileName, JSON.stringify(playlistData.playList, null, 2));
  });

  // 生成 ZIP 檔並下載
  zip.generateAsync({ type: "blob" }).then(function(content) {
    const now = new Date();
    const dateStr = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0');
    const zipName = `youtube_library_${dateStr}.zip`;
    
    const url = URL.createObjectURL(content);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = zipName;
    anchor.click();
    URL.revokeObjectURL(url);
    ui.showToast(`Exported ${playlistNames.length} playlists to "${zipName}".`, "success");
  });
});

importLibraryButton?.addEventListener("click", () => importLibraryInput?.click());

importLibraryInput?.addEventListener("change", function(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const library = store.getLibrary();
  let processedCount = 0;
  let newlyImported = [];
  let updated = [];

  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result || "");

        const processItem = (name, itemData) => {
          const currentVideoId = itemData.playList && itemData.playList[0] ? itemData.playList[0].videoId : null;
          let existingKey = null;

          if (currentVideoId) {
            existingKey = store.findPlaylistByVideoId(currentVideoId);
          }

          // 若 URL 沒重複，檢查名稱是否重複
          if (!existingKey && library.hasOwnProperty(name)) {
            existingKey = name;
          }

          const isOverwrite = !!existingKey;
          if (existingKey && existingKey !== name) {
            delete library[existingKey];
          }

          library[name] = itemData;
          if (isOverwrite) {
            updated.push(name);
          } else {
            newlyImported.push(name);
          }
        };

        if (Array.isArray(data)) {
          const playlistName = file.name.replace(/\.[^/.]+$/, "");
          processItem(playlistName, { playList: data, inputMode: "json", currentId: 0 });
        } else if (typeof data === 'object' && data !== null) {
          Object.keys(data).forEach(key => {
            processItem(key, data[key]);
          });
        }
      } catch (err) {
        console.error(`Failed to parse ${file.name}`, err);
      } finally {
        processedCount++;
        if (processedCount === files.length) {
          store.saveLibrary(library);
          refreshLibraryUI();
          importLibraryInput.value = "";
          
          let msg = "";
          if (newlyImported.length > 0) msg += `Imported: ${newlyImported.join(", ")}. `;
          if (updated.length > 0) msg += `Updated: ${updated.join(", ")}`;
          if (msg) ui.showToast(msg.trim(), "success");
        }
      }
    };
    reader.readAsText(file);
  });
});

// This function is now only used for the current playlist export
function getSafeExportFileName() {
  const player = yt.getPlayer();
  const rawTitle =
    player &&
    typeof player.getVideoData === "function" &&
    player.getVideoData() &&
    player.getVideoData().title
      ? player.getVideoData().title
      : "youtube-playlist";
  
  // Use the new generic sanitizer
  return `${utils.sanitizeStringForFilename(rawTitle)}.json`;
}

exportButton?.addEventListener("click", function () {
  syncInputFieldsFromPlaylist();
  const fileName = getSafeExportFileName();
  utils.downloadTextFile(
    fileName,
    JSON.stringify(playList, null, 2),
    "application/json"
  );
  ui.showToast(`Current playlist exported as "${fileName}".`, "success");
});

importButton?.addEventListener("click", function() { // This button triggers single playlist import
  importFileInput?.click();
});

importFileInput?.addEventListener("change", function (event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (loadEvent) {
    try {
      const rawData = JSON.parse(String(loadEvent.target.result || ""));
      if (!Array.isArray(rawData)) {
        alert("Import failed: JSON must be an array.");
        return;
      }

      const parsed = rawData.map((item, index) => {
        if (!item || typeof item !== "object") {
          throw new Error(`Item ${index + 1} is not an object.`);
        }
        if (typeof item.videoId !== "string" || !item.videoId.trim()) {
          throw new Error(`Item ${index + 1} has invalid videoId.`);
        }
        const start = Number(item.start);
        const end = Number(item.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          throw new Error(`Item ${index + 1} has invalid start/end.`);
        }
        return {
          videoId: item.videoId.trim(),
          start: Math.max(0, Math.floor(start)),
          end: Math.max(Math.floor(start), Math.floor(end)),
          title: typeof item.title === "string" ? item.title : "",
        };
      });

      if (!parsed.length) {
        alert("Import failed: playlist is empty.");
        return;
      }

      playList = parsed;
      currentId = 0;
      activeLibraryName = null; // 外部匯入視為新歌單，清除庫中的高亮
      syncInputFieldsFromPlaylist();
      playByIndex(currentId); // 匯入後遵循 Autoplay 設定
      refreshLibraryUI();
      ui.showToast(`Playlist "${file.name}" imported successfully.`, "success");
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      importFileInput.value = "";
    }
  };

  reader.onerror = function () {
    alert("Import failed: unable to read file.");
    importFileInput.value = "";
  };

  reader.readAsText(file);
});

function initVersionDisplay() {
  const versionElement = document.getElementById("version-display");
  if (versionElement) versionElement.textContent = `v${APP_VERSION}`;
}

/**
 * 初始化並建立網頁下方的留言框
 */
function initCommentBox() {
  const container = document.createElement('div');
  container.className = "comments-container";
  container.style.cssText = "margin-top: 30px; padding: 20px; border-top: 2px solid #444; background: #1a1a1a; display: none;";
  
  const header = document.createElement('h3');
  header.textContent = "💬 影片熱門留言 (Top Comments)";
  header.style.color = "#eee";
  header.style.marginBottom = "10px";
  
  const list = document.createElement('div');
  list.id = "video-comments-list";
  list.className = "comments-list";

  container.appendChild(header);
  container.appendChild(list);
  document.body.appendChild(container);
}

async function updateCommentsDisplay(videoId) {
  const list = document.getElementById("video-comments-list");
  if (!list || !videoId) return;
  
  list.innerHTML = '<div style="color: #888;">正在從 YouTube 讀取留言...</div>';
  const comments = await yt.getVideoComments(videoId);
  
  if (comments && comments.error) {
    let errorMsg = "";
    if (comments.status === 403) {
      errorMsg = "❌ 無法讀取留言 (403 Forbidden)<br>這通常是因為：影片留言已關閉或授權不足。";
    } else if (comments.status === 401) {
      errorMsg = "❌ 登入已過期，請重新登入以查看留言。";
      auth.requestAccessToken(true); // 嘗試背景刷新
    } else {
      errorMsg = `❌ 讀取失敗 (錯誤碼: ${comments.status})<br>原因: ${comments.reason || '未知'}`;
    }
    list.innerHTML = `<div style="color: #ff4d4d; padding: 10px; border: 1px dashed #ff4d4d; border-radius: 5px;">${errorMsg}</div>`;
    return;
  }

  if (!comments || comments.length === 0) {
    list.innerHTML = '<div style="color: #888;">此影片目前沒有留言，或是留言功能已關閉。</div>';
    return;
  }
  
  list.innerHTML = "";
  comments.forEach(c => {
    const card = document.createElement('div');
    card.className = "comment-card";
    
    const author = document.createElement('span');
    author.className = "comment-author";
    author.textContent = c.author;
    
    const text = document.createElement('div');
    text.className = "comment-text";
    text.textContent = c.text; // 搭配 pre-wrap !important 顯示換行
    
    card.appendChild(author);
    card.appendChild(text);
    list.appendChild(card);
  });
}

function togglePlaylistCollapse() {
  isPlaylistCollapsed = !isPlaylistCollapsed;
  applyPlaylistCollapse();
  saveToStorage();
}

function applyPlaylistCollapse() {
  const topSection = document.querySelector('.top-section');
  const expandBtn = document.getElementById('playlist-expand-btn');
  if (!topSection) return;
  topSection.classList.toggle('playlist-hidden', isPlaylistCollapsed);
  if (expandBtn) expandBtn.style.display = isPlaylistCollapsed ? 'block' : 'none';
}

// --- 初始化順序調整 ---
async function initializeApp() {
  try {
    // 1. 讀取 API 金鑰設定檔
    const response = await fetch('api_key.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const config = await response.json();

    // 2. 注入金鑰與初始化
    yt.setApiKey(config.YOUTUBE_API_KEY);
    auth.initGoogleSignIn(config.GOOGLE_CLIENT_ID);
    auth.restoreSession();
    
    // 3. 初始載入留言
    updateCommentsDisplay(playList[currentId]?.videoId);
  } catch (error) {
    console.error("應用程式初始化失敗:", error);
    ui.showToast("無法載入 API 設定檔", "error");
    // 降級處理
    auth.initGoogleSignIn(""); 
    auth.restoreSession();
  }
}

initializeApp();

initCommentBox(); // 建立留言框

loadFromStorage();
updatePlayList();
syncInputFieldsFromPlaylist();
// 移除硬編碼的 "text"，改用從 Storage 讀取的內容
if (inputModeSelect) applyInputMode(inputModeSelect.value);
initVersionDisplay();
updateTogglesUI();
videoContainer?.classList.toggle("audio-only", isAudioOnlyMode);
applyPlaylistCollapse();

document.getElementById('playlist-collapse-btn')?.addEventListener('click', togglePlaylistCollapse);
document.getElementById('playlist-expand-btn')?.addEventListener('click', togglePlaylistCollapse);

refreshLibraryUI();

const libraryToggle = document.getElementById("library-toggle");
const libraryPanel = document.querySelector(".library-panel");
if (libraryToggle && libraryPanel) {
  libraryToggle.addEventListener("click", () => {
    isLibraryCollapsed = !isLibraryCollapsed;
    libraryPanel.classList.toggle("library-collapsed", isLibraryCollapsed);
    saveToStorage();
  });
  // Apply initial collapse state
  libraryPanel.classList.toggle("library-collapsed", isLibraryCollapsed);
}

// 初始化 YouTube 播放器
yt.initPlayer({
  videoId: playList[currentId]?.videoId || "",
  start: playList[currentId]?.start || 0,
  end: playList[currentId]?.end || 0,
  autoplay: isAutoplayEnabled ? 1 : 0,
  onReady: (playerInstance) => {
    ui.updateTitles(playerInstance, playList, currentId);
    updatePlayPauseButtonLabel();
  },
  onStateChange: (event, shouldPlayNext) => {
    ui.updateTitles(yt.getPlayer(), playList, currentId);
    updatePlayPauseButtonLabel();
    if (shouldPlayNext) {
      if (currentId < playList.length - 1) {
        // 延遲 1.5 秒再切換，模擬人類反應，降低被判定為機器人的機率
        setTimeout(() => playNext(), 1500);
      } else {
        updatePlayList();
      }
    }
  },
  onError: (event) => {
    console.error("YouTube Player Error:", event.data);
    setTimeout(playNext, 2000);
  }
});

// 登出按鈕事件
document.getElementById("logout-button")?.addEventListener("click", () => {
  auth.logout();
});

/**
 * 從使用者的 YouTube 帳號獲取播放清單並收藏至歌單庫 (Library)
 */
async function fetchAndLoadUserPlaylists() {
  const btn = document.getElementById("test-yt-button");
  
  if (!auth.isLoggedIn()) {
    alert("請先登入 Google 以存取並收藏您的 YouTube 歌單");
    return;
  }

  if (!auth.getAccessToken()) {
    auth.requestAccessToken(false);
    return;
  }

  if (btn) btn.disabled = true;
  ui.showToast("正在獲取您的 YouTube 歌單...", "info");
  
  try {
    const playlists = await yt.getUserPlaylists();
    
    if (playlists && playlists.length > 0) {
      // 建立一個簡單的選擇介面 (這裡用 prompt 示範，實務上可做成 UI Modal)
      const listText = playlists.map((p, i) => `${i + 1}. ${p.snippet.title}`).join('\n');
      const choice = prompt(`請選擇要「收藏至歌單庫」的編號：\n\n${listText}`);
      const index = parseInt(choice) - 1;

      if (playlists[index]) {
        const selected = playlists[index];
        ui.showToast(`正在從 YouTube 抓取影片內容: ${selected.snippet.title}...`, "info");
        
        const items = await yt.getPlaylistItems(selected.id);
        
        if (items && items.length > 0) {
          let library = store.getLibrary();
          let addedCount = 0;

          // 將播放清單中的每一首歌分別存入 Library
          items.forEach(item => {
            const entryName = item.title || `Video: ${item.videoId}`;
            library[entryName] = {
              playList: [item], // 每一個項目只包含這一首歌
              inputMode: "text",
              currentId: 0
            };
            addedCount++;
          });

          store.saveLibrary(library);
          refreshLibraryUI();

          ui.showToast(`已從 "${selected.snippet.title}" 匯入 ${addedCount} 首歌曲至歌單庫！`, "success");
        } else {
          alert("該歌單內似乎沒有影片。");
        }
      }
    } else {
      alert("您的帳號中沒有公開的播放清單。");
    }
  } catch (error) {
    alert(`❌ 連接失敗: ${error.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 綁定測試按鈕事件
document.getElementById("test-yt-button")?.addEventListener("click", fetchAndLoadUserPlaylists);

/**
 * AUTO 功能：從熱門留言抓取第一則並填入 Timeline Text
 */
autoTimelineBtn?.addEventListener("click", async () => {
  const urlValue = videoUrlInput?.value?.trim() || videoUrlInput?.placeholder || "";
  const videoId = utils.extractVideoId(urlValue);
  if (!videoId) {
    ui.showToast("請先輸入有效的 YouTube 影片網址", "error");
    return;
  }

  ui.showToast("正在抓取熱門留言...", "info");
  const comments = await yt.getVideoComments(videoId);

  if (Array.isArray(comments) && comments.length > 0) {
    const rawDuration = defaultDurationInput?.value;
    const defaultDuration = (rawDuration && !isNaN(parseInt(rawDuration, 10))) 
      ? Math.max(1, parseInt(rawDuration, 10)) 
      : 300;

    let targetComment = null;
    let foundIndex = -1;

    // 依序檢查留言，找到第一個含有有效時間軸資訊的留言
    for (let i = 0; i < comments.length; i++) {
      const parsedRows = utils.parseTimelineText(comments[i].text, defaultDuration);
      if (parsedRows.length > 0) {
        targetComment = comments[i].text;
        foundIndex = i;
        break;
      }
    }

    if (targetComment) {
      timelineTextarea.value = targetComment;
      ui.showToast(`已從第 ${foundIndex + 1} 則熱門留言自動填入時間軸`, "success");
    } else {
      // 如果都沒找到有效的，則不更動內容，僅提示使用者
      ui.showToast("未在熱門留言中發現標準時間軸格式", "info");
    }
  } else {
    const errorDetail = (comments && comments.error) ? ` (${comments.reason})` : "";
    ui.showToast(`無法獲取留言${errorDetail}，請檢查影片設定`, "error");
  }
});
