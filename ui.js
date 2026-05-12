import * as utils from './utils.js';

/**
 * 顯示 Toast 通知
 */
let toastTimeout;
export function showToast(message, type = "info") {
  const toast = document.getElementById("toast-notification");
  if (!toast) return;

  toast.textContent = message;
  toast.className = "toast-show";
  toast.classList.add(`toast-${type}`);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.remove(`toast-${type}`);
    toast.textContent = "";
  }, 3000);
}

/**
 * 動態調整字體大小以適應容器
 */
export function adjustFontSize(element, originalSize) {
  if (!element) return;
  let size = originalSize;
  element.style.fontSize = size + "em";
  while (element.scrollWidth > element.clientWidth && size > 0.6) {
    size -= 0.05;
    element.style.fontSize = size + "em";
  }
}

/**
 * 更新播放清單 UI 列表
 */
export function renderPlayList(container, playList, currentId) {
  if (!container) return;
  container.innerHTML = "";

  playList.forEach((item, i) => {
    const startText = utils.formatSecondsToText(item.start);
    const endText = utils.formatSecondsToText(item.end);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `playlist-item ${currentId === i ? "active" : ""}`;
    btn.dataset.index = i;
    btn.innerHTML = `<span class="playlist-index">${i + 1}</span>. ${startText} ~ ${endText}${item.title ? `  ${item.title}` : ""}`;
    container.appendChild(btn);
  });

  updatePlaylistCount(playList, currentId);
}

/**
 * 統一更新 歌曲/總數 顯示
 */
function updatePlaylistCount(playList, currentId) {
  const countElement = document.getElementById("playlist-count");
  if (!countElement) return;

  if (Array.isArray(playList) && playList.length > 0) {
    // 確保 currentId 是有效數字，且不會超出陣列長度
    const validId = typeof currentId === 'number' ? currentId : 0;
    const safeCurrent = Math.min(Math.max(0, validId), playList.length - 1);
    countElement.textContent = `(${safeCurrent + 1} / ${playList.length})`;
  } else {
    countElement.textContent = "(0 / 0)";
  }
}

/**
 * 更新主標題與當前曲目顯示
 */
export function updateTitles(player, playList, currentId) {
  const titleElement = document.getElementById("main-video-title");
  const trackElement = document.getElementById("current-track-title");

  if (titleElement) {
    let displayTitle = "YouTube Playlist Manager";
    if (player && typeof player.getVideoData === "function") {
      const videoData = player.getVideoData();
      if (videoData && videoData.title) displayTitle = videoData.title;
    }
    titleElement.textContent = displayTitle;
    adjustFontSize(titleElement, 2.2);
  }

  if (trackElement) {
    const currentItem = playList[currentId];
    trackElement.textContent = (currentItem && currentItem.title) ? `🎤：${currentItem.title}` : "";
    adjustFontSize(trackElement, 1.6);
  }

  updatePlaylistCount(playList, currentId);
}

/**
 * 渲染歌單庫菜單
 */
export function renderLibraryMenu(library, activeLibraryName, callbacks) {
  const libraryList = document.getElementById("library-list");
  const libraryToggle = document.getElementById("library-toggle");
  if (!libraryList || !library) return;

  const keys = Object.keys(library);
  libraryList.innerHTML = '';

  if (libraryToggle) {
    libraryToggle.innerHTML = `<span id="library-toggle-icon" style="display: inline-block; transition: transform 0.2s; font-size: 0.7em;">▼</span> 📂 Playlists Library (${keys.length})`;
  }

  if (keys.length === 0) {
    libraryList.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">No saved playlists yet.</div>';
    return;
  }

  keys.forEach((name, index) => {
    const playlistData = library[name];
    const firstVideoId = playlistData.playList?.[0]?.videoId || "";
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
    itemDiv.querySelector(".lib-content-left").onclick = () => callbacks.onLoad(name);
    itemDiv.querySelector(".lib-del-btn").onclick = (e) => { e.stopPropagation(); callbacks.onDelete(name); };
    libraryList.appendChild(itemDiv);
  });
}