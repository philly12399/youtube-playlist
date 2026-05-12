let player;
let debouncing = false;

/**
 * 初始化 YouTube 播放器
 */
export function initPlayer(config) {
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player("video-youtube", {
            height: "500px",
            width: "1000px",
            videoId: config.videoId || "",
            playerVars: {
                autoplay: 0,
                start: config.start || 0,
                end: config.end || 0,
            },
            events: {
                onStateChange: (event) => handleStateChange(event, config.onStateChange),
                onError: config.onError
            },
        });
        if (config.onReady) config.onReady(player);
    };

    // 載入 API 腳本
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        document.head.appendChild(tag);
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
        buttonElement.textContent = "⏯ Play/Pause (Space)";
        return;
    }
    buttonElement.textContent =
        state === YT.PlayerState.PLAYING ? "⏸ Pause (Space)" : "▶ Play (Space)";
}