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
let isAudioOnlyMode = false;
let currentId = 0;

const STORAGE_KEY = "yt_playlist_manager_data";
const LIBRARY_KEY = "yt_playlist_library_collection";

function saveToStorage() {
  const data = {
    playList,
    currentId,
    isAudioOnlyMode,
    inputMode: inputModeSelect.value // 儲存目前的輸入模式
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
    }
  } catch (e) {
    console.error("Failed to load state from storage", e);
  }
}

// 處理多組歌單庫的功能
function saveCurrentPlaylistToLibrary(playlistNameOverride = null) {
  if (!playList || playList.length === 0 || !playList[0].videoId) return;

  let library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  
  // 取得一個名稱，優先順序：YouTube 影片標題 > 第一首曲目標題 > Video ID
  let playlistName = "Untitled Playlist";
  if (!playlistNameOverride) {
    if (player && typeof player.getVideoData === "function" && player.getVideoData().title) {
      playlistName = player.getVideoData().title;
    } else if (playList[0].title) {
      playlistName = playList[0].title;
    } else {
      playlistName = `Video: ${playList[0].videoId}`;
    }
    
    // Prompt user for name, pre-filling with the default
    let newName = prompt("Enter a name for this playlist:", playlistName);
    if (!newName) return; // User cancelled
    playlistName = newName.trim();
    if (!playlistName) {
      alert("Playlist name cannot be empty.");
      return;
    }
  } else {
    playlistName = playlistNameOverride;
  }

  if (library[playlistName] && !confirm(`Playlist "${playlistName}" already exists. Overwrite?`)) {
    return; // User chose not to overwrite
  }

  library[playlistName] = {
    playList: JSON.parse(JSON.stringify(playList)), // Deep copy
    inputMode: inputModeSelect.value,
    currentId: currentId // Also save the current playing index for this saved playlist
  };

  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  renderLibraryMenu();
  alert(`Playlist "${playlistName}" saved to library.`);
}

function deletePlaylistFromLibrary(name) {
  if (!confirm(`Are you sure you want to delete playlist "${name}" from the library? This cannot be undone.`)) {
    return;
  }

  let library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  delete library[name];
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  renderLibraryMenu();
}

function renderLibraryMenu() {
  const libraryList = document.getElementById("library-list");
  if (!libraryList) return;

  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  libraryList.innerHTML = '';

  Object.keys(library).forEach(name => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "playlist-item library-wrap";
    
    itemDiv.innerHTML = `
      <span class="lib-text">📂 ${name}</span>
      <button class="lib-del-btn" title="Delete Playlist">✕</button>
    `;

    itemDiv.querySelector(".lib-text").onclick = () => loadLibraryPlaylist(name);
    itemDiv.querySelector(".lib-del-btn").onclick = (e) => {
      e.stopPropagation();
      deletePlaylistFromLibrary(name);
    };

    libraryList.appendChild(itemDiv);
  });
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

    line = line.replace(/^\d+\.\s*/, "");
    if (!line) continue;

    line = line.replace(/[~～]/g, "").trim();
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

function playByIndex(index) {
  if (!playList[index]) return;
  currentId = index;
  updatePlayList();
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
  syncInputFieldsFromPlaylist();
  playByIndex(currentId);
  saveToStorage();
});

function loadLibraryPlaylist(name) {
  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
  const data = library[name];
  if (data) {
    playList = data.playList;
    inputModeSelect.value = data.inputMode || "text";
    currentId = data.currentId || 0;
    applyInputMode(inputModeSelect.value);
    syncInputFieldsFromPlaylist();
    updatePlayList();
    playByIndex(currentId);
    saveToStorage();
  }
}

savePlaylistButton.addEventListener("click", () => saveCurrentPlaylistToLibrary());

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

function getSafeExportFileName() {
  const rawTitle =
    player &&
    typeof player.getVideoData === "function" &&
    player.getVideoData() &&
    player.getVideoData().title
      ? player.getVideoData().title
      : "youtube-playlist";
  const sanitized = rawTitle
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return `${sanitized || "youtube-playlist"}.json`;
}


exportButton.addEventListener("click", function () {
  syncInputFieldsFromPlaylist();
  downloadTextFile(
    getSafeExportFileName(),
    JSON.stringify(playList, null, 2),
    "application/json"
  );
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
      syncInputFieldsFromPlaylist();
      updatePlayList();
      playByIndex(currentId);
      saveToStorage();
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
      ${i + 1}. ${startText} ~ ${endText}${playList[i].title ? `  ${playList[i].title}` : ""}
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

loadFromStorage();
updatePlayList();
syncInputFieldsFromPlaylist();
// 移除硬編碼的 "text"，改用從 Storage 讀取的內容
applyInputMode(inputModeSelect.value);
updateAudioOnlyButtonLabel();
videoContainer.classList.toggle("audio-only", isAudioOnlyMode);
renderLibraryMenu();

let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";

let firstScriptTag = document.getElementById("youtube-tracking-script");
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("video-youtube", {
    height: "500px",
    width: "1000px",
    videoId: playList[currentId] && playList[currentId].videoId ? playList[currentId].videoId : "", // Handle empty playlist
    playerVars: { // 修正參數名稱從 playerlets 改為 playerVars
      autoplay: 0, // Autoplay is generally not allowed without user interaction
      start: playList[currentId] && playList[currentId].start ? playList[currentId].start : 0, // Handle empty playlist
      end: playList[currentId] && playList[currentId].end ? playList[currentId].end : 0, // Handle empty playlist
    },
    events: {
      onStateChange: videoPlay,
    },
  });
  updatePlayPauseButtonLabel();
}

let debouncing = false;

function videoPlay(event) {
  if (event.data == YT.PlayerState.PLAYING) {
    debouncing = false;
    console.log("YouTube Video is PLAYING!!");
  }
  if (event.data == YT.PlayerState.PAUSED) {
    console.log("YouTube Video is PAUSED!!");
  }
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
