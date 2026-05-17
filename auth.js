import * as ui from './ui.js';

let accessToken = null;
let userProfile = null;

let CLIENT_ID = "";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email"
];

/**
 * 初始化 Google API 和 Sign-In
 */
export function initGoogleSignIn(clientId) {
  CLIENT_ID = clientId;
  if (!window.google) {
    console.error("Google Identity Services SDK 未載入");
    setTimeout(() => initGoogleSignIn(clientId), 500);
    return;
  }

  // 1. 初始化身分驗證 (用於顯示登入按鈕與取得基本資料)
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
  });

  // 2. 渲染登入按鈕
  google.accounts.id.renderButton(
    document.getElementById("buttonDiv"),
    { theme: "dark", size: "large", width: 200 }
  );

  // 3. 初始化授權客戶端 (用於取得 YouTube API 的 Access Token)
  window.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES.join(" "),
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Google 授權出錯:", tokenResponse.error, tokenResponse.error_description);
        ui.showToast(`授權失敗: ${tokenResponse.error}`, "error");
        return;
      }
      accessToken = tokenResponse.access_token;
      localStorage.setItem("yt_user_token", accessToken);
      console.log("✅ 已取得 YouTube Access Token");
      updateAuthUI();
    },
  });

  console.log("✅ Google Sign-In 初始化完成");
}

/**
 * 處理身分驗證響應
 */
function handleCredentialResponse(response) {
  const decoded = parseJwt(response.credential);
  userProfile = {
    name: decoded.name,
    email: decoded.email,
    picture: decoded.picture
  };

  localStorage.setItem("yt_user_profile", JSON.stringify(userProfile));
  
  // 取得身分後，接著請求 YouTube API 的授權
  console.log("嘗試取得 YouTube API 訪問權限...");
  requestAccessToken(true); 
  
  updateAuthUI();
  console.log("✅ 使用者身分已確認:", userProfile.email);
}

/**
 * 請求 Access Token (YouTube 權限)
 * @param {boolean} silent 是否靜默請求（不跳出視窗）
 */
export function requestAccessToken(silent = false) {
  if (window.tokenClient) {
    try {
      // 如果是 silent，prompt 設為空字串，Google 會嘗試在背景取得 Token
      window.tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
    } catch (err) {
      console.error("請求 Token 失敗:", err);
      if (silent) {
        console.warn("靜默授權失敗，可能需要使用者手動點擊");
      }
    }
  }
}

/**
 * 解析 JWT Token
 */
function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
  );
  return JSON.parse(jsonPayload);
}

/**
 * 恢復登入狀態（頁面載入時）
 */
export function restoreSession() {
  const savedToken = localStorage.getItem("yt_user_token");
  const savedProfile = localStorage.getItem("yt_user_profile");

  if (savedProfile) {
    userProfile = JSON.parse(savedProfile);
    // 即使 Token 可能已過期，我們先恢復身分 UI 讓使用者覺得已登入
    if (savedToken) accessToken = savedToken;
    
    updateAuthUI();
    console.log("✅ 從本地存儲恢復身分:", userProfile.email);
    
    // 💡 關鍵：F5 後自動在背景嘗試刷新 Access Token
    // 這樣可以確保 YouTube API 的存取權限在頁面載入後依然有效
    requestAccessToken(true);
  }
}

/**
 * 登出
 */
export function logout() {
  accessToken = null;
  userProfile = null;
  localStorage.removeItem("yt_user_token");
  localStorage.removeItem("yt_user_profile");
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
  updateAuthUI();
  console.log("✅ 已登出");
}

/**
 * 更新 UI
 */
function updateAuthUI() {
  const buttonDiv = document.getElementById("buttonDiv");
  const userInfo = document.getElementById("user-info");
  
  if (!buttonDiv || !userInfo) return;
  
  if (userProfile) {
    buttonDiv.style.display = "none";
    userInfo.style.display = "flex";
    const avatar = document.getElementById("user-avatar");
    const email = document.getElementById("user-email");
    if (avatar) avatar.src = userProfile.picture;
    if (email) email.textContent = userProfile.email;
  } else {
    buttonDiv.style.display = "block";
    userInfo.style.display = "none";
  }
}

export function getAccessToken() { return accessToken; }
export function isLoggedIn() { return !!userProfile; }
export function getUserProfile() { return userProfile; }

/**
 * 驗證 YouTube 連接
 */
export async function verifyYouTubeConnection() {
  if (!accessToken) {
    if (userProfile) {
      // 如果有 Profile 卻沒 Token，嘗試背景刷新一次
      requestAccessToken(true);
    }
    return null;
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (response.status === 401) {
      console.warn("Token 已失效，清除舊 Token 並要求重新授權...");
      accessToken = null;
      localStorage.removeItem("yt_user_token");
      requestAccessToken(false); 
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.items?.[0] ? {
      channelTitle: data.items[0].snippet.title,
      channelId: data.items[0].id
    } : null;
  } catch (error) {
    console.error("YouTube API 請求發生錯誤:", error);
    return null;
  }
}
