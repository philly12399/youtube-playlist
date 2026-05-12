/**
 * 檔名合法化處理
 */
export function sanitizeStringForFilename(inputString) {
  const sanitized = inputString
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "untitled-playlist";
}

/**
 * 秒數轉為 hh:mm:ss 格式
 */
export function formatSecondsToText(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

/**
 * 從 URL 或 ID 字串中提取 YouTube Video ID
 */
export function extractVideoId(videoInput) {
  const value = (videoInput || "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    return url.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

/**
 * 解析時間軸文字
 */
export function parseTimelineText(text, defaultAddSeconds = 300) {
  const lines = (text || "").split("\n");
  const parsedRows = [];

  const isTimeToken = (tok) => {
    const parts = tok.split(":");
    return (parts.length >= 2 && parts.length <= 3) && parts.every((p) => /^\d+$/.test(p));
  };

  const timeTokenToSeconds = (tok) => {
    const nums = tok.split(":").map(Number);
    return nums.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
  };

  for (let rawLine of lines) {
    let line = rawLine.trim().replace(/^[0-9１２３４５６７８９０]+[\.\s、]+\s*/, "");
    line = line.replace(/[~～]/g, " ").trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
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

  for (let i = 0; i < parsedRows.length - 1; i++) {
    if (parsedRows[i].end > parsedRows[i + 1].start) {
      parsedRows[i].end = parsedRows[i + 1].start;
    }
  }
  return parsedRows;
}

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}