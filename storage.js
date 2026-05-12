export const STORAGE_KEY = "yt_playlist_manager_data";
export const LIBRARY_KEY = "yt_playlist_library_collection";

export function saveState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Failed to load state", e);
    return null;
  }
}

export function getLibrary() {
  return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}");
}

export function saveLibrary(library) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function deletePlaylist(name) {
  const library = getLibrary();
  delete library[name];
  saveLibrary(library);
  return library;
}

export function findPlaylistByVideoId(videoId) {
  const library = getLibrary();
  for (const key in library) {
    if (library[key].playList?.[0]?.videoId === videoId) return key;
  }
  return null;
}