import * as utils from './utils.js';
import * as store from './storage.js';
import * as ui from './ui.js';

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

let playListElement = document.getElementById("play-list");
if (!playListElement) {
  console.error("Critical: 'play-list' element not found.");
}

const updatePlayList = () => ui.renderPlayList(playListElement, playList, currentId);

playListElement?.addEventListener("click", function (event) {
  const target = event.target.closest(".playlist-item");
  if (!target) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  playByIndex(index);
});

inputModeSelect?.addEventListener("change", function () {
  applyInputMode(inputModeSelect.value);
  saveToStorage();
});

function saveToStorage() {
  store.saveState({
    playList,
    currentId,
    isAudioOnlyMode,
    inputMode: inputModeSelect.value, // 儲存目前的輸入模式
    isLibraryCollapsed,
    activeLibraryName
  });
}

function loadFromStorage() {
  const data = store.loadState();
  if (data) {
    if (data.playList) playList = data.playList;
    if (typeof data.currentId === 'number') currentId = data.currentId;
    if (typeof data.isAudioOnlyMode === 'boolean') isAudioOnlyMode = data.isAudioOnlyMode;
    if (data.inputMode) inputModeSelect.value = data.inputMode;
    if (typeof data.isLibraryCollapsed === 'boolean') isLibraryCollapsed = data.isLibraryCollapsed;
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
}

function playByIndex(index) {
  if (!playList[index]) return;
  currentId = index;
  updatePlayList();
  ui.updateTitles(player, playList, currentId);
  
  // 自動捲動到當前播放項目
  const activeItem = playListElement?.querySelector(".playlist-item.active");
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
  if (!playPauseButton) return;
  if (!player || typeof player.getPlayerState !== "function" || !YT?.PlayerState) {
    playPauseButton.textContent = "⏯ Play/Pause (Space)";
    return;
  }
  const state = player.getPlayerState();
  playPauseButton.textContent =
    state === YT.PlayerState.PLAYING ? "⏸ Pause (Space)" : "▶ Play (Space)";
}

function updateAudioOnlyButtonLabel() {
  if (audioOnlyButton) audioOnlyButton.textContent = isAudioOnlyMode
    ? "🎧 Audio Only: On (C)"
    : "🎧 Audio Only: Off (C)";
}

function toggleAudioOnlyMode() {
  isAudioOnlyMode = !isAudioOnlyMode;
  videoContainer?.classList.toggle("audio-only", isAudioOnlyMode);
  updateAudioOnlyButtonLabel();
  saveToStorage();
}

prevButton?.addEventListener("click", playPrevious);
nextButton?.addEventListener("click", playNext);
playPauseButton?.addEventListener("click", togglePlayPause);
audioOnlyButton?.addEventListener("click", toggleAudioOnlyMode);

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
updateButton?.addEventListener("click", function (event) {
  if (inputModeSelect?.value === "json") {
    let playListString = textarea?.value || "[]";
    try {
      playList = JSON.parse(playListString);
    } catch (exception) {
      alert("JSON format error. Please check your input and try again.");
      return;
    }
  } else {
    const videoId = utils.extractVideoId(videoUrlInput?.value);
    if (!videoId) {
      alert("Please provide a valid YouTube URL.");
      return;
    }

    const parsedRows = utils.parseTimelineText(timelineTextarea?.value);
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
  refreshLibraryUI();
  ui.showToast("Playlist updated and playing.", "success");
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

savePlaylistButton?.addEventListener("click", () => saveCurrentPlaylistToLibrary());

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

importLibraryInput?.addEventListener("change", function (event) {
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

importButton?.addEventListener("click", function () {
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
      playByIndex(currentId);
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

loadFromStorage();
updatePlayList();
syncInputFieldsFromPlaylist();
// 移除硬編碼的 "text"，改用從 Storage 讀取的內容
if (inputModeSelect) applyInputMode(inputModeSelect.value);
updateAudioOnlyButtonLabel();
videoContainer?.classList.toggle("audio-only", isAudioOnlyMode);
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

let player; // Declare player globally

window.onYouTubeIframeAPIReady = function() {
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
  ui.updateTitles(player, playList, currentId);
  updatePlayPauseButtonLabel();
};

// 載入 YouTube IFrame API (放在定義回調之後更安全)
let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag && firstScriptTag.parentNode) {
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
  document.head.appendChild(tag);
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
  ui.updateTitles(player, playList, currentId);
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
