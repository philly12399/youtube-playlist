let playList = [
  {
    videoId: "dQw4w9WgXcQ", // Default to a well-known video
    start: 0,
    end: 200,
  },
];

let textarea = document.getElementById("playlist-object");
let inputModeSelect = document.getElementById("input-mode");
let jsonModePanel = document.getElementById("json-mode-panel");
let textModePanel = document.getElementById("text-mode-panel");
let videoUrlInput = document.getElementById("playlist-video-url");
let timelineTextarea = document.getElementById("playlist-timelines");
let videoContainer = document.querySelector(".video-container");
let prevButton = document.getElementById("prev-button");
let nextButton = document.getElementById("next-button");
let playPauseButton = document.getElementById("play-pause-button");
let audioOnlyButton = document.getElementById("audio-only-button");
let savePlaylistButton = document.getElementById("save-playlist-button");
let exportLibraryButton = document.getElementById("export-library-button");
let importLibraryButton = document.getElementById("import-library-button");
let importLibraryInput = document.getElementById("import-library-input");
let isAudioOnlyMode = false;
let isLibraryCollapsed = false;
let activeLibraryName = null;
let currentId = 0;

const STORAGE_KEY = "yt_playlist_manager_data";
const LIBRARY_KEY = "yt_playlist_library_collection";

function saveToStorage() {
  const data = {
    playList,
    currentId,
    isAudioOnlyMode,
    inputMode: inputModeSelect.value, // 儲存目前的輸入模式
    isLibraryCollapsed,
    activeLibraryName
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.playList) playList = data.playList;
      if (typeof data.currentId === 'number') currentId = data.currentId;
      if (typeof data.isAudioOnlyMode === 'boolean') isAudioOnlyMode = data.isAudioOnlyMode;
      if (data.inputMode) inputModeSelect.value = data.inputMode;
      if (typeof data.isLibraryCollapsed === 'boolean') isLibraryCollapsed = data.isLibraryCollapsed;
      if (data.activeLibraryName) activeLibraryName = data.activeLibraryName;
    }
  } catch (e) {
    console.error("Failed to load state from storage", e);
  }
}

// 處理多組歌單庫的功能
function saveCurrentPlaylistToLibrary(playlistNameOverride = null) {
  if (!playList || playList.length === 0 || !playList[0].videoId) return;

  let library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  const currentVideoId = playList[0].videoId;

  // 檢查是否已有相同 URL (videoId) 的歌單存在於 Library 中
  let existingKeyForUrl = null;
  for (const key in library) {
    if (library[key].playList && library[key].playList[0] && library[key].playList[0].videoId === currentVideoId) {
      existingKeyForUrl = key;
      break;
    }
  }
  
  // 名稱優先序：手動指定 > 目前載入的歌單名稱 > YouTube 影片標題 > 第一首曲目標題
  let playlistName = playlistNameOverride || activeLibraryName;

  if (!playlistName) {
    if (player && typeof player.getVideoData === "function" && player.getVideoData().title) {
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
    inputMode: inputModeSelect.value,
    currentId: currentId
  };

  activeLibraryName = playlistName;
  saveToStorage();
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  renderLibraryMenu();

  if (isOverwriting) {
    showToast(`Playlist "${playlistName}" updated.`, "success");
  } else {
    showToast(`Playlist "${playlistName}" saved.`, "success");
  }
}

function deletePlaylistFromLibrary(name) {
  let library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  delete library[name];
  if (activeLibraryName === name) activeLibraryName = null;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  saveToStorage();
  renderLibraryMenu();
  showToast(`Playlist "${name}" deleted.`, "success");
}

function renderLibraryMenu(filter = "") { // Corrected: Removed duplicate function definition
  const libraryList = document.getElementById("library-list");
  if (!libraryList) return;

  const libraryToggle = document.getElementById("library-toggle");

  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  libraryList.innerHTML = '';

  const keys = Object.keys(library).filter(name => name.toLowerCase().includes(filter.toLowerCase()));
  if (libraryToggle) {
    libraryToggle.innerHTML = `<span id="library-toggle-icon" style="display: inline-block; transition: transform 0.2s; font-size: 0.7em;">▼</span> 📂 Playlists Library (${keys.length})`;
  }

  if (keys.length === 0) {
    libraryList.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">No saved playlists yet.</div>';
    return;
  }

  
  keys.forEach((name, index) => {
    const playlistData = library[name];
    const firstVideoId = playlistData.playList && playlistData.playList[0] ? playlistData.playList[0].videoId : "";
    const thumbUrl = firstVideoId ? `https://img.youtube.com/vi/${firstVideoId}/mqdefault.jpg` : "Logo.png";

    const itemDiv = document.createElement("div");
    itemDiv.className = `playlist-item library-wrap ${name === activeLibraryName ? 'active-library-playlist' : ''}`;
    
    itemDiv.innerHTML = `
      <div class="lib-content-left"><span class="playlist-index">${index + 1}.</span>
        <img src="${thumbUrl}" class="lib-thumb" alt="thumb">
        <span class="lib-text">${name}</span>
      </div>
      <button class="lib-del-btn" title="Delete Playlist">✕</button>
    `;

    itemDiv.querySelector(".lib-content-left").onclick = () => loadLibraryPlaylist(name);
    itemDiv.querySelector(".lib-del-btn").onclick = (e) => {
      e.stopPropagation();
      deletePlaylistFromLibrary(name);
    };

    libraryList.appendChild(itemDiv);
  });
}

// Helper function to sanitize a string for use as a filename
function sanitizeStringForFilename(inputString) {
  // Remove invalid characters for filenames: < > : " / \ | ? * and control characters
  // Replace multiple spaces with a single space, then trim
  const sanitized = inputString
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "untitled-playlist"; // Provide a fallback name
}

function formatSecondsToText(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

function syncInputFieldsFromPlaylist() {
  textarea.value = JSON.stringify(playList);
  videoUrlInput.value = playList[0]
    ? `https://www.youtube.com/watch?v=${playList[0].videoId}`
    : "";
  timelineTextarea.value = playList
    .map((item) => {
      const start = formatSecondsToText(item.start);
      const end = formatSecondsToText(item.end);
      const base = item.start === item.end ? start : `${start} ${end}`;
      return item.title ? `${base} ${item.title}` : base;
    })
    .join("\n");
}

function applyInputMode(mode) {
  const useTextMode = mode === "text";
  jsonModePanel.style.display = useTextMode ? "none" : "block";
  textModePanel.style.display = useTextMode ? "block" : "none";
}

function extractVideoId(videoInput) {
  const value = (videoInput || "").trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      const idFromPath = url.pathname.split("/").filter(Boolean)[0];
      return idFromPath || null;
    }
    const id = url.searchParams.get("v");
    return id || null;
  } catch (error) {
    return null;
  }
}

function parseTimelineTextFromJumpExtension(text, defaultAddSeconds = 300) {
  const lines = (text || "").split("\n");
  const parsedRows = [];

  // Same logic as youtube-jump-extension importPlaylistFromText
  const isTimeToken = (tok) => {
    const parts = tok.split(":");
    if (parts.length < 2 || parts.length > 3) return false;
    return parts.every((p) => /^\d+$/.test(p));
  };

  // Same logic as youtube-jump-extension importPlaylistFromText
  const timeTokenToSeconds = (tok) => {
    const nums = tok.split(":").map(Number);
    if (nums.length === 2) {
      return nums[0] * 60 + nums[1];
    }
    return nums[0] * 3600 + nums[1] * 60 + nums[2];
  };

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // 支援半形與全形數字開頭的序號 (例如 "1." 或 "１.")
    // 修正：要求數字後必須緊跟至少一個分隔符（點、空格或頓號），避免誤刪 00:11:44 中的小時部分
    line = line.replace(/^[0-9１２３４５６７８９０]+[\.\s、]+\s*/, "");
    if (!line) continue;

    // 將全形或半形波浪號替換為空格，確保即便沒有空格間隔也能正確切分出兩個時間標記
    line = line.replace(/[~～]/g, " ").trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    if (!tokens.length) continue;

    const first = tokens[0];
    if (!isTimeToken(first)) continue;

    const startSec = timeTokenToSeconds(first);
    let endSec = null;
    let titleIdx = 1;
    let hasExplicitEnd = false;

    if (tokens.length > 1 && isTimeToken(tokens[1])) {
      endSec = timeTokenToSeconds(tokens[1]);
      titleIdx = 2;
      hasExplicitEnd = true;
    } else {
      endSec = startSec + defaultAddSeconds;
    }

    parsedRows.push({
      start: startSec,
      end: Math.max(startSec, endSec),
      title: tokens.slice(titleIdx).join(" ").trim(),
      hasExplicitEnd,
    });
  }

  // Keep timeline continuous: if previous end overlaps next start, trim previous end.
  for (let i = 0; i < parsedRows.length - 1; i++) {
    const nextStart = parsedRows[i + 1].start;
    if (parsedRows[i].end > nextStart) {
      parsedRows[i].end = nextStart;
    }
  }

  return parsedRows;
}

inputModeSelect.addEventListener("change", function () {
  applyInputMode(inputModeSelect.value);
  saveToStorage(); // 切換模式時也儲存
});

function adjustFontSize(element, originalSize) {
  if (!element) return;
  let size = originalSize;
  element.style.fontSize = size + "em";
  // 當內容寬度大於容器寬度且字體大於 0.6em 時，持續縮小字體
  while (element.scrollWidth > element.clientWidth && size > 0.6) {
    size -= 0.05;
    element.style.fontSize = size + "em";
  }
}

function updateMainTitleDisplay() {
  const titleElement = document.getElementById("main-video-title");
  const trackElement = document.getElementById("current-track-title");

  if (titleElement) {
    let displayTitle = "YouTube Playlist Manager";
    if (player && typeof player.getVideoData === "function") {
      const videoData = player.getVideoData();
      if (videoData && videoData.title) {
        displayTitle = videoData.title;
      }
    }
    titleElement.textContent = displayTitle;
    adjustFontSize(titleElement, 2.2);
  }

  if (trackElement) {
    const currentItem = playList[currentId];
    if (currentItem && currentItem.title) {
      trackElement.textContent = `🎤：${currentItem.title}`;
    } else {
      trackElement.textContent = "";
    }
    adjustFontSize(trackElement, 1.6);
  }
}

function playByIndex(index) {
  if (!playList[index]) return;
  currentId = index;
  updatePlayList();
  updateMainTitleDisplay();
  
  // 自動捲動到當前播放項目
  const activeItem = playListElement.querySelector(".playlist-item.active");
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (!player || typeof player.loadVideoById !== "function") return;
  player.loadVideoById({
    videoId: playList[currentId].videoId,
    startSeconds: playList[currentId].start,
    endSeconds: playList[currentId].end,
  });
  saveToStorage();
}

function playPrevious() {
  if (!playList.length) return;
  const prevIndex = currentId > 0 ? currentId - 1 : 0;
  playByIndex(prevIndex);
}

function playNext() {
  if (!playList.length) return;
  const nextIndex = currentId < playList.length - 1 ? currentId + 1 : currentId;
  playByIndex(nextIndex);
}

function togglePlayPause() {
  if (!player || typeof player.getPlayerState !== "function") return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function updatePlayPauseButtonLabel() {
  if (!player || typeof player.getPlayerState !== "function") {
    playPauseButton.textContent = "⏯ Play/Pause (Space)";
    return;
  }
  const state = player.getPlayerState();
  playPauseButton.textContent =
    state === YT.PlayerState.PLAYING ? "⏸ Pause (Space)" : "▶ Play (Space)";
}

function updateAudioOnlyButtonLabel() {
  audioOnlyButton.textContent = isAudioOnlyMode
    ? "🎧 Audio Only: On (C)"
    : "🎧 Audio Only: Off (C)";
}

function toggleAudioOnlyMode() {
  isAudioOnlyMode = !isAudioOnlyMode;
  videoContainer.classList.toggle("audio-only", isAudioOnlyMode);
  updateAudioOnlyButtonLabel();
  saveToStorage();
}

prevButton.addEventListener("click", playPrevious);
nextButton.addEventListener("click", playNext);
playPauseButton.addEventListener("click", togglePlayPause);
audioOnlyButton.addEventListener("click", toggleAudioOnlyMode);

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
    playPrevious();
    return;
  }
  if (key === "x") {
    event.preventDefault();
    event.stopPropagation();
    playNext();
  }
}

document.addEventListener("keydown", handleGlobalHotkey, true);

let updateButton = document.getElementById("update-button");
let exportButton = document.getElementById("export-button");
let importButton = document.getElementById("import-button");
let importFileInput = document.getElementById("import-file-input");
updateButton.addEventListener("click", function (event) {
  if (inputModeSelect.value === "json") {
    let playListString = textarea.value;
    try {
      playList = JSON.parse(playListString);
    } catch (exception) {
      alert("JSON format error. Please check your input and try again.");
      return;
    }
  } else {
    const videoId = extractVideoId(videoUrlInput.value);
    if (!videoId) {
      alert("Please provide a valid YouTube URL.");
      return;
    }

    const parsedRows = parseTimelineTextFromJumpExtension(timelineTextarea.value);
    if (!parsedRows.length) {
      alert("No valid timeline rows found.");
      return;
    }

    playList = parsedRows.map((row) => ({
      videoId,
      start: row.start,
      end: row.end,
      title: row.title,
    }));
  }

  currentId = 0;
  activeLibraryName = null; // 重新輸入視為新歌單
  syncInputFieldsFromPlaylist();
  playByIndex(currentId);
  renderLibraryMenu();
  showToast("Playlist updated and playing.", "success");
});

function loadLibraryPlaylist(name) {
  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  const data = library[name];
  if (data) {
    playList = data.playList;
    inputModeSelect.value = data.inputMode || "text";
    currentId = data.currentId || 0;
    activeLibraryName = name;
    saveToStorage();
    applyInputMode(inputModeSelect.value);
    renderLibraryMenu();
    syncInputFieldsFromPlaylist();
    showToast(`Playlist "${name}" loaded.`, "info");
    playByIndex(currentId);
  }
}

savePlaylistButton.addEventListener("click", () => saveCurrentPlaylistToLibrary());


let toastTimeout;
exportLibraryButton.addEventListener("click", function() {
  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
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
    const fileName = `${sanitizeStringForFilename(playlistName)}.json`;
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
    showToast(`Exported ${playlistNames.length} playlists to "${zipName}".`, "success");
  });
});

importLibraryButton.addEventListener("click", () => importLibraryInput.click());

importLibraryInput.addEventListener("change", function (event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
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

          // 檢查 URL 是否重複
          if (currentVideoId) {
            for (const key in library) {
              if (library[key].playList && library[key].playList[0] && library[key].playList[0].videoId === currentVideoId) {
                existingKey = key;
                break;
              }
            }
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
          localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
          renderLibraryMenu();
          importLibraryInput.value = "";
          
          let msg = "";
          if (newlyImported.length > 0) msg += `Imported: ${newlyImported.join(", ")}. `;
          if (updated.length > 0) msg += `Updated: ${updated.join(", ")}`;
          if (msg) showToast(msg.trim(), "success");
        }
      }
    };
    reader.readAsText(file);
  });
});

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// This function is now only used for the current playlist export
function getSafeExportFileName() {
  const rawTitle =
    player &&
    typeof player.getVideoData === "function" &&
    player.getVideoData() &&
    player.getVideoData().title
      ? player.getVideoData().title
      : "youtube-playlist";
  
  // Use the new generic sanitizer
  return `${sanitizeStringForFilename(rawTitle)}.json`;
}

exportButton.addEventListener("click", function () {
  syncInputFieldsFromPlaylist();
  const fileName = getSafeExportFileName();
  downloadTextFile(
    fileName,
    JSON.stringify(playList, null, 2),
    "application/json"
  );
  showToast(`Current playlist exported as "${fileName}".`, "success");
});

importButton.addEventListener("click", function () {
  importFileInput.click();
});

importFileInput.addEventListener("change", function (event) {
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
      playByIndex(currentId);
      renderLibraryMenu();
      showToast(`Playlist "${file.name}" imported successfully.`, "success");
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

let playListElement = document.getElementById("play-list");
function updatePlayList() {
  playListElement.innerHTML = "";
  for (let i = 0; i < playList.length; i++) {
    const startText = formatSecondsToText(playList[i].start);
    const endText = formatSecondsToText(playList[i].end);
    playListElement.innerHTML += `<button type="button" class="playlist-item ${
      currentId === i ? "active" : ""
    }" data-index="${i}">
      <span class="playlist-index">${i + 1}</span>. ${startText} ~ ${endText}${playList[i].title ? `  ${playList[i].title}` : ""}
    </button>`;
  }
}

playListElement.addEventListener("click", function (event) {
  const target = event.target.closest(".playlist-item");
  if (!target) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  playByIndex(index);
});

function showToast(message, type = "info") {
  const toast = document.getElementById("toast-notification");
  if (!toast) return;

  toast.textContent = message;
  toast.className = "toast-show"; // Reset classes
  toast.classList.add(`toast-${type}`);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.remove(`toast-${type}`);
    toast.textContent = "";
  }, 3000); // Hide after 3 seconds
}

loadFromStorage();
updatePlayList();
syncInputFieldsFromPlaylist();
// 移除硬編碼的 "text"，改用從 Storage 讀取的內容
applyInputMode(inputModeSelect.value);
updateAudioOnlyButtonLabel();
videoContainer.classList.toggle("audio-only", isAudioOnlyMode);
renderLibraryMenu();

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

let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";

let firstScriptTag = document.getElementById("youtube-tracking-script");
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player; // Declare player globally

function onYouTubeIframeAPIReady() {
  player = new YT.Player("video-youtube", {
    height: "500px",
    width: "1000px",
    videoId: playList[currentId] && playList[currentId].videoId ? playList[currentId].videoId : "", // Handle empty playlist
    playerVars: { // 修正參數名稱從 playerlets 改為 playerVars
      autoplay: 0, // Autoplay is generally not allowed without user interaction
      start: playList[currentId] && playList[currentId].start !== undefined ? playList[currentId].start : 0, // Handle empty playlist or undefined start
      end: playList[currentId] && playList[currentId].end !== undefined ? playList[currentId].end : 0, // Handle empty playlist or undefined end
    },
    events: {
      onStateChange: videoPlay,
      onError: onPlayerError
    },
  });
  updateMainTitleDisplay();
  updatePlayPauseButtonLabel();
}

let debouncing = false;

function onPlayerError(event) {
  console.error("YouTube Player Error:", event.data);
  // 如果影片無法播放，2秒後自動跳下一首
  setTimeout(playNext, 2000);
}

function videoPlay(event) {
  if (event.data == YT.PlayerState.PLAYING) {
    debouncing = false;
    console.log("YouTube Video is PLAYING!!");
  }
  if (event.data == YT.PlayerState.PAUSED) {
    console.log("YouTube Video is PAUSED!!");
  }
  updateMainTitleDisplay();
  updatePlayPauseButtonLabel();

  // after loading next video, before starting the next one, one extra end event will be passed,
  // so need this debouncing logic
  if (debouncing) return;
  if (event.data == YT.PlayerState.ENDED) {
    debouncing = true;
    console.log("YouTube Video is ENDING!!");
    if (currentId < playList.length - 1) {
      playNext();
      return;
    }
    updatePlayList();
  }
}
