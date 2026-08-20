/**
 * OnlyBugs - Production-ready Vanilla ES6+ Client Application
 * Features:
 * - Firestore Realtime Database for:
 *   1. Posts (/posts/{postId}) -> Active posts 0001 & 0002
 *   2. Likes (/likes/{postId}) -> Atomic increment/decrement toggle with security rules
 *   3. Creators (/creators/{username}) -> Creator profiles with Full name & single Bio (description)
 * - Avatar Initial resolution:
 *   Uses `avatarInitial` if set in DB; otherwise generates initial from first letter of `fullName` (or handle fallback).
 * - Subscriber count removed from creator profile page.
 * - Single bio across all language settings.
 * - Login-exclusive Like System with session retention via cookies
 * - Realtime onSnapshot sync across all clients
 * - Full Localization support (English & Hungarian) with cookie persistence in account menu
 * - Age verification & interactive fullscreen lightbox
 * - Account login/logout state management
 * - Responsive creator gallery grid & creator profile view
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  increment, 
  getDocFromServer 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// =========================================================================
// 1. Firebase Firestore Configuration & Error Handling
// =========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDIbyi6StRqH6t5YUdth27xYfX-N9KiFLs",
  authDomain: "gen-lang-client-0861400224.firebaseapp.com",
  projectId: "gen-lang-client-0861400224",
  storageBucket: "gen-lang-client-0861400224.firebasestorage.app",
  messagingSenderId: "511101439134",
  appId: "1:511101439134:web:a1b54164ac78b20f2ebf8f"
};

const FIRESTORE_DATABASE_ID = "ai-studio-fanfeedgallery-299950ee-06b1-4652-b94f-5bd32ffeec75";

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Initial seed data for Posts (only 0001 and 0002)
const INITIAL_SEED_POSTS = {
  "0001": {
    title: "Golden hour rooftop vibes in Miami 🌇",
    account: "@charlotte_v"
  },
  "0002": {
    title: "Morning fitness routine & HIIT workout 💪✨",
    account: "@marcus_fit"
  }
};

const INITIAL_SEED_LIKES = {
  "0001": 1420,
  "0002": 890
};

// Initial seed data for Creators collection in Firestore (/creators/{username})
// Single bio for all language settings & avatar initial derived from full name if unset
const INITIAL_SEED_CREATORS = {
  "charlotte_v": {
    fullName: "Charlotte Vance",
    bio: "Official lifestyle & travel creator. Daily behind-the-scenes moments, high-resolution photography collections, and VIP travel diaries."
  },
  "marcus_fit": {
    fullName: "Marcus Thorne",
    bio: "Certified fitness trainer & athlete. High-intensity home workouts, personalized meal prep plans, and body transformation guides."
  }
};

function normalizeCreatorId(handleOrUsername) {
  if (!handleOrUsername) return "";
  return handleOrUsername.replace(/^@/, "").trim().toLowerCase();
}

/**
 * Avatar Initial Fallback Resolver:
 * 1. Uses explicit `creator.avatarInitial` if present and non-empty.
 * 2. Otherwise generates the initial based on the first letter of `creator.fullName`.
 * 3. Otherwise falls back to the first letter of the username handle.
 */
function getCreatorAvatarInitial(dbCreator, fallbackHandleOrUsername) {
  if (dbCreator && typeof dbCreator.avatarInitial === "string" && dbCreator.avatarInitial.trim().length > 0) {
    return dbCreator.avatarInitial.trim().charAt(0).toUpperCase();
  }
  if (dbCreator && typeof dbCreator.fullName === "string" && dbCreator.fullName.trim().length > 0) {
    return dbCreator.fullName.trim().charAt(0).toUpperCase();
  }
  if (fallbackHandleOrUsername && typeof fallbackHandleOrUsername === "string" && fallbackHandleOrUsername.trim().length > 0) {
    return fallbackHandleOrUsername.replace(/^@/, "").trim().charAt(0).toUpperCase();
  }
  return "?";
}

// =========================================================================
// 2. Localization (i18n) Dictionary
// =========================================================================

const TRANSLATIONS = {
  en: {
    siteTitle: "OnlyBugs • Exclusive Media Gallery",
    loginBtn: "Log In",
    verifiedSubscriber: "● Verified Subscriber",
    languageLabel: "Language",
    syncLiveDb: "Sync Live DB",
    logOut: "Log Out",
    backToAllPosts: "Back to All Posts",
    verifiedCreator: "Verified Creator",
    recentPosts: "Recent Posts",
    filteredBy: "Filtered by",
    posts: "Posts",
    totalLikes: "Total Likes",
    ageRequiredTitle: "18+ Verification",
    ageModalText: "This site contains 18+ media. Are you of legal age?",
    ageConfirm: "I am 18+ • Enter",
    ageDecline: "Under 18 • Exit",
    authNagTitle: "Join OnlyBugs",
    authNagSubtitle: "Log in to continue",
    authNagDesc: "Sign in to view full posts, like media, and explore creator profiles.",
    authActionBtn: "Log In",
    ageRestrictedNotice: "18+ Age Restricted",
    postedRecently: "Posted recently • Public Feed",
    copied: "Copied!",
    copyLink: "Copy Link",
    loadingPosts: "Loading posts...",
    noPostsFound: "No Posts Found",
    noMediaByAccount: "No media published by {account} yet.",
    noPostsInDb: "Database contains no registered posts.",
    footerCopyright: "© OnlyBugs. All rights reserved. 18+ Mature Content."
  },
  hu: {
    siteTitle: "OnlyBugs • Exkluzív Médiagaléria",
    loginBtn: "Bejelentkezés",
    verifiedSubscriber: "● Ellenőrzött feliratkozó",
    languageLabel: "Nyelv",
    syncLiveDb: "Adatbázis szinkronizálása",
    logOut: "Kijelentkezés",
    backToAllPosts: "Vissza az összes bejegyzéshez",
    verifiedCreator: "Hitelesített alkotó",
    recentPosts: "Legújabb bejegyzések",
    filteredBy: "Szűrés alkotó szerint:",
    posts: "Bejegyzés",
    totalLikes: "Összes kedvelés",
    ageRequiredTitle: "18+ Ellenőrzés",
    ageModalText: "Ez az oldal 18+ tartalmat tartalmaz. Elmúltál 18 éves?",
    ageConfirm: "Elmúltam 18 • Belépés",
    ageDecline: "18 alatt • Kilépés",
    authNagTitle: "Csatlakozz az OnlyBugs-hoz",
    authNagSubtitle: "Jelentkezz be a folytatáshoz",
    authNagDesc: "Jelentkezz be a teljes bejegyzésekért, kedvelésekért és profilokért.",
    authActionBtn: "Bejelentkezés",
    ageRestrictedNotice: "18+ Korhatáros tartalom",
    postedRecently: "Közzétéve nemrég • Nyilvános hírfolyam",
    copied: "Másolva!",
    copyLink: "Hivatkozás másolása",
    loadingPosts: "Bejegyzések betöltése...",
    noPostsFound: "Nincsenek bejegyzések",
    noMediaByAccount: "{account} még nem tett közzé tartalmat.",
    noPostsInDb: "Az adatbázis nem tartalmaz regisztrált bejegyzéseket.",
    footerCopyright: "© OnlyBugs. Minden jog fenntartva. 18+ Felnőtt tartalom."
  }
};

// =========================================================================
// 3. Cookie Management Utilities & Liked Posts Session Persistence
// =========================================================================

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

function getLikedPostIdsFromCookie() {
  const cookieVal = getCookie("user_liked_posts");
  if (!cookieVal) return new Set();
  try {
    const arr = JSON.parse(cookieVal);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function saveLikedPostIdsToCookie(likedSet) {
  const arr = Array.from(likedSet);
  setCookie("user_liked_posts", JSON.stringify(arr), 365);
}

function isPostLiked(postId) {
  return state.userLikedPostIds.has(postId);
}

// =========================================================================
// 4. Initial Language Detection
// =========================================================================

function detectInitialLanguage() {
  const cookieLang = getCookie("app_lang");
  if (cookieLang === "hu" || cookieLang === "en") {
    return cookieLang;
  }

  const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage || "en"];
  for (const lang of browserLangs) {
    if (lang && typeof lang === "string" && lang.toLowerCase().startsWith("hu")) {
      return "hu";
    }
  }

  return "en";
}

// =========================================================================
// 5. Application State Store
// =========================================================================

const state = {
  currentLang: detectInitialLanguage(),
  isAgeVerified: getCookie("age_verified") === "true",
  isLoggedIn: getCookie("logged_in") === "true",
  userLikedPostIds: getLikedPostIdsFromCookie(),
  currentFilterAccount: null,
  posts: {},
  likes: {},
  creators: {},
  isPostsLoaded: false,
  activeLightboxId: null,
  firestoreDb: null,
  isFirestoreConnected: false
};

// =========================================================================
// 6. DOM Element References
// =========================================================================

const DOM = {
  body: document.body,
  htmlPageTitle: document.getElementById("html-page-title"),
  brandHomeLink: document.getElementById("brand-home-link"),
  
  // Language Switcher Controls (in Account Dropdown)
  dropdownChoiceEn: document.getElementById("dropdown-choice-en"),
  dropdownChoiceHu: document.getElementById("dropdown-choice-hu"),

  // Auth & Profile Elements
  headerLoginBtn: document.getElementById("header-login-btn"),
  headerProfileBtn: document.getElementById("header-profile-btn"),
  headerUserAvatar: document.getElementById("header-user-avatar"),
  headerUserName: document.getElementById("header-user-name"),
  profileDropdown: document.getElementById("profile-dropdown"),
  dropdownRefreshDbBtn: document.getElementById("dropdown-refresh-db-btn"),
  dropdownLogoutBtn: document.getElementById("dropdown-logout-btn"),
  
  // Main Sections
  profileViewSection: document.getElementById("profile-view-section"),
  profileBannerAvatar: document.getElementById("profile-banner-avatar"),
  profileBannerName: document.getElementById("profile-banner-name"),
  profileBannerHandle: document.getElementById("profile-banner-handle"),
  profileBannerBio: document.getElementById("profile-banner-bio"),
  profileStatPosts: document.getElementById("profile-stat-posts"),
  profileStatLikes: document.getElementById("profile-stat-likes"),
  profileBackToFeedBtn: document.getElementById("profile-back-to-feed-btn"),

  feedHeaderBar: document.getElementById("feed-header-bar"),
  feedTitleHeading: document.getElementById("feed-title-heading"),
  feedFilterIndicator: document.getElementById("feed-filter-indicator"),
  filterAccountLabel: document.getElementById("filter-account-label"),
  clearFilterBtn: document.getElementById("clear-filter-btn"),
  mediaGrid: document.getElementById("media-grid"),

  // Modals
  ageModal: document.getElementById("age-modal"),
  ageConfirmBtn: document.getElementById("age-confirm-btn"),
  ageDeclineBtn: document.getElementById("age-decline-btn"),

  authNagModal: document.getElementById("auth-nag-modal"),
  authNagCloseBtn: document.getElementById("auth-nag-close-btn"),
  authLoginActionBtn: document.getElementById("auth-login-action-btn"),

  // Lightbox
  lightboxModal: document.getElementById("lightbox-modal"),
  lightboxImg: document.getElementById("lightbox-img"),
  lightboxAvatar: document.getElementById("lightbox-avatar"),
  lightboxAccount: document.getElementById("lightbox-account"),
  lightboxPostTitle: document.getElementById("lightbox-post-title"),
  lightboxPostDate: document.getElementById("lightbox-post-date"),
  lightboxLikeBtn: document.getElementById("lightbox-like-btn"),
  lightboxLikeCount: document.getElementById("lightbox-like-count"),
  lightboxMediaLikeBtn: document.getElementById("lightbox-media-like-btn"),
  lightboxMediaLikeCount: document.getElementById("lightbox-media-like-count"),
  lightboxCloseBtn: document.getElementById("lightbox-close-btn"),
  lightboxPrevBtn: document.getElementById("lightbox-prev-btn"),
  lightboxNextBtn: document.getElementById("lightbox-next-btn"),
  lightboxShareBtn: document.getElementById("lightbox-share-btn")
};

// =========================================================================
// 7. i18n Translation Engine
// =========================================================================

function t(key, replacements = {}) {
  const dict = TRANSLATIONS[state.currentLang] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;
  for (const [placeholder, val] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), val);
  }
  return text;
}

function setLanguage(lang) {
  if (lang !== "en" && lang !== "hu") return;
  state.currentLang = lang;
  setCookie("app_lang", lang, 365);
  applyLanguage();
}

function applyLanguage() {
  const lang = state.currentLang;

  if (DOM.dropdownChoiceEn && DOM.dropdownChoiceHu) {
    DOM.dropdownChoiceEn.classList.toggle("active", lang === "en");
    DOM.dropdownChoiceHu.classList.toggle("active", lang === "hu");
  }

  document.title = t("siteTitle");
  if (DOM.htmlPageTitle) DOM.htmlPageTitle.textContent = t("siteTitle");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.setAttribute("title", t(key));
    }
  });

  document.documentElement.lang = lang;
  renderFeed();
}

// =========================================================================
// 8. Realtime Database Synchronization (Posts, Likes & Creators)
// =========================================================================

async function testConnection(db) {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client operates in offline mode.");
    }
  }
}

function initRealtimeDatabase() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, FIRESTORE_DATABASE_ID);
    state.firestoreDb = db;

    testConnection(db);

    // 1. Realtime listener for Posts collection (/posts/{postId})
    const postsCollectionRef = collection(db, "posts");
    onSnapshot(postsCollectionRef, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedPosts = {};
        snapshot.forEach((docSnap) => {
          fetchedPosts[docSnap.id] = docSnap.data();
        });

        state.posts = fetchedPosts;
        state.isFirestoreConnected = true;
        state.isPostsLoaded = true;
        renderFeed();
        updateLightboxIfOpen();
      } else {
        seedPostsCollection(db);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "posts");
      useLocalDatabaseFallback();
    });

    // 3. Realtime listener for Likes collection (/likes/{postId})
    const likesCollectionRef = collection(db, "likes");
    onSnapshot(likesCollectionRef, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedLikes = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedLikes[docSnap.id] = typeof data.count === "number" ? data.count : 0;
        });

        state.likes = { ...state.likes, ...fetchedLikes };
        syncLocalLikes();
        renderFeed();
        updateLightboxIfOpen();
      } else {
        seedLikesCollection(db);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "likes");
    });

    // 4. Realtime listener for Creators collection (/creators/{username})
    const creatorsCollectionRef = collection(db, "creators");
    onSnapshot(creatorsCollectionRef, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedCreators = {};
        snapshot.forEach((docSnap) => {
          const username = docSnap.id.toLowerCase();
          fetchedCreators[username] = docSnap.data();
        });

        state.creators = { ...state.creators, ...fetchedCreators };
        if (state.currentFilterAccount) {
          updateProfileBanner(state.currentFilterAccount);
        }
      } else {
        seedCreatorsCollection(db);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "creators");
    });

  } catch (err) {
    console.warn("Realtime DB initialization error, using local fallback:", err);
    useLocalDatabaseFallback();
  }
}

async function seedPostsCollection(db) {
  try {
    for (const [id, postData] of Object.entries(INITIAL_SEED_POSTS)) {
      await setDoc(doc(db, "posts", id), postData);
    }
    state.posts = { ...INITIAL_SEED_POSTS };
    state.isPostsLoaded = true;
    renderFeed();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "posts");
    state.isPostsLoaded = true;
    renderFeed();
  }
}

async function seedLikesCollection(db) {
  try {
    for (const [id, count] of Object.entries(INITIAL_SEED_LIKES)) {
      await setDoc(doc(db, "likes", id), { count });
    }
    state.likes = { ...INITIAL_SEED_LIKES };
    syncLocalLikes();
    renderFeed();
    updateLightboxIfOpen();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "likes");
  }
}

async function seedCreatorsCollection(db) {
  try {
    for (const [username, creatorData] of Object.entries(INITIAL_SEED_CREATORS)) {
      await setDoc(doc(db, "creators", username), creatorData);
    }
    state.creators = { ...INITIAL_SEED_CREATORS };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "creators");
  }
}

function useLocalDatabaseFallback() {
  const localLikes = localStorage.getItem("onlybugs_likes");
  if (localLikes) {
    try {
      state.likes = { ...INITIAL_SEED_LIKES, ...JSON.parse(localLikes) };
    } catch (e) {
      state.likes = { ...INITIAL_SEED_LIKES };
    }
  } else {
    state.likes = { ...INITIAL_SEED_LIKES };
  }
  state.posts = { ...INITIAL_SEED_POSTS };
  state.creators = { ...INITIAL_SEED_CREATORS };
  state.isPostsLoaded = true;
  renderFeed();
  updateLightboxIfOpen();
}

function syncLocalLikes() {
  localStorage.setItem("onlybugs_likes", JSON.stringify(state.likes));
}

/**
 * Login-Exclusive Like Toggle System:
 * - Requires active login state
 * - Toggles like on/off per user
 * - Stores state in cookies to retain across sessions & prevents > 1 like per post
 * - Uses atomic Firestore increment(+1) and increment(-1) for multi-user concurrency
 */
async function togglePostLike(postId) {
  if (!postId) return;

  if (!state.isLoggedIn) {
    openModal(DOM.authNagModal);
    return;
  }

  const currentlyLiked = isPostLiked(postId);
  const currentCount = typeof state.likes[postId] === "number" ? state.likes[postId] : (INITIAL_SEED_LIKES[postId] || 0);

  if (currentlyLiked) {
    // === UN-LIKE POST ===
    state.userLikedPostIds.delete(postId);
    saveLikedPostIdsToCookie(state.userLikedPostIds);

    const newCount = Math.max(0, currentCount - 1);
    state.likes[postId] = newCount;
    syncLocalLikes();
    renderFeed();
    updateLightboxIfOpen();

    if (state.isFirestoreConnected && state.firestoreDb) {
      try {
        const likeDocRef = doc(state.firestoreDb, "likes", postId);
        await updateDoc(likeDocRef, {
          count: increment(-1)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `likes/${postId}`);
      }
    }
  } else {
    // === LIKE POST ===
    state.userLikedPostIds.add(postId);
    saveLikedPostIdsToCookie(state.userLikedPostIds);

    const newCount = currentCount + 1;
    state.likes[postId] = newCount;
    syncLocalLikes();
    renderFeed();
    updateLightboxIfOpen();

    if (DOM.lightboxLikeBtn) {
      DOM.lightboxLikeBtn.classList.remove("heart-bump");
      void DOM.lightboxLikeBtn.offsetWidth;
      DOM.lightboxLikeBtn.classList.add("heart-bump");
    }
    if (DOM.lightboxMediaLikeBtn) {
      DOM.lightboxMediaLikeBtn.classList.remove("heart-bump");
      void DOM.lightboxMediaLikeBtn.offsetWidth;
      DOM.lightboxMediaLikeBtn.classList.add("heart-bump");
    }

    if (state.isFirestoreConnected && state.firestoreDb) {
      try {
        const likeDocRef = doc(state.firestoreDb, "likes", postId);
        await updateDoc(likeDocRef, {
          count: increment(1)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `likes/${postId}`);
        try {
          await setDoc(doc(state.firestoreDb, "likes", postId), { count: newCount });
        } catch (createErr) {
          handleFirestoreError(createErr, OperationType.CREATE, `likes/${postId}`);
        }
      }
    }
  }
}

// =========================================================================
// 9. UI Renderers (Feed & Creator Profile)
// =========================================================================

function getVisiblePostList() {
  const postIds = Object.keys(state.posts).sort();
  const validPosts = [];

  for (const id of postIds) {
    const post = state.posts[id];
    if (post && typeof post.title === "string" && typeof post.account === "string") {
      if (!state.currentFilterAccount || normalizeCreatorId(post.account) === normalizeCreatorId(state.currentFilterAccount)) {
        validPosts.push({ id, ...post });
      }
    }
  }

  return validPosts;
}

function renderFeed() {
  DOM.mediaGrid.innerHTML = "";

  if (!state.isPostsLoaded) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading-feed-placeholder";
    loadingDiv.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="loading-text">${t("loadingPosts")}</p>
    `;
    DOM.mediaGrid.appendChild(loadingDiv);
    return;
  }

  const visiblePosts = getVisiblePostList();

  if (visiblePosts.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-feed-placeholder";
    const noMediaMsg = state.currentFilterAccount
      ? t("noMediaByAccount", { account: escapeHTML(state.currentFilterAccount) })
      : t("noPostsInDb");
    emptyDiv.innerHTML = `
      <div class="empty-icon">📷</div>
      <h3>${t("noPostsFound")}</h3>
      <p>${noMediaMsg}</p>
    `;
    DOM.mediaGrid.appendChild(emptyDiv);
    return;
  }

  visiblePosts.forEach((post) => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View post by ${post.account}: ${post.title}`);
    card.dataset.postId = post.id;

    const likesCount = typeof state.likes[post.id] === "number" ? state.likes[post.id] : (INITIAL_SEED_LIKES[post.id] || 0);
    const userLiked = isPostLiked(post.id);

    card.innerHTML = `
      <div class="post-thumbnail-wrapper">
        <img 
          src="${post.image || `./img/${post.id}.png`}" 
          alt="${escapeHTML(post.title)}" 
          class="post-thumbnail-img" 
          loading="lazy"
          onerror="this.onerror=null; this.src='./img/0001.png';"
        />
        <div class="blur-overlay-notice">
          <svg class="blur-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span class="blur-lock-text">${t("ageRestrictedNotice")}</span>
        </div>
      </div>
      <div class="post-info-container">
        <h3 class="post-title">${escapeHTML(post.title)}</h3>
        <div class="post-footer-row">
          <a href="#" class="post-account-link" data-account="${escapeHTML(post.account)}">
            <span>${escapeHTML(post.account)}</span>
          </a>
          <button type="button" class="post-likes-badge ${userLiked ? 'liked' : ''}" data-post-id="${post.id}" title="${userLiked ? 'Unlike' : 'Like'}" aria-label="Like post">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>${formatNumber(likesCount)}</span>
          </button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const accountLink = e.target.closest(".post-account-link");
      if (accountLink) {
        e.preventDefault();
        handleAccountClick(accountLink.dataset.account);
        return;
      }

      const likeBadge = e.target.closest(".post-likes-badge");
      if (likeBadge) {
        e.preventDefault();
        e.stopPropagation();
        togglePostLike(post.id);
        return;
      }

      handleCardClick(post.id);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardClick(post.id);
      }
    });

    DOM.mediaGrid.appendChild(card);
  });

  if (state.currentFilterAccount) {
    updateProfileBanner(state.currentFilterAccount);
  }
}

function updateProfileBanner(accountHandle) {
  const cleanUsername = normalizeCreatorId(accountHandle);
  const dbCreator = state.creators[cleanUsername] || state.creators[`@${cleanUsername}`] || null;

  const fallbackName = cleanUsername.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const fullName = (dbCreator && dbCreator.fullName) ? dbCreator.fullName : fallbackName;
  const bioText = (dbCreator && typeof dbCreator.bio === "string" && dbCreator.bio.trim().length > 0)
    ? dbCreator.bio
    : "Official creator on OnlyBugs.";

  const avatarChar = getCreatorAvatarInitial(dbCreator, cleanUsername);

  DOM.profileBannerAvatar.textContent = avatarChar;
  DOM.profileBannerName.querySelector("span").textContent = fullName;
  DOM.profileBannerHandle.textContent = accountHandle.startsWith("@") ? accountHandle : `@${accountHandle}`;
  DOM.profileBannerBio.textContent = bioText;

  const creatorPosts = Object.entries(state.posts).filter(([id, p]) => p && normalizeCreatorId(p.account) === cleanUsername);
  const totalLikes = creatorPosts.reduce((sum, [id]) => sum + (typeof state.likes[id] === "number" ? state.likes[id] : 0), 0);

  DOM.profileStatPosts.textContent = creatorPosts.length;
  DOM.profileStatLikes.textContent = formatNumber(totalLikes);

  DOM.profileViewSection.classList.add("active");
  DOM.feedFilterIndicator.style.display = "inline-flex";
  DOM.filterAccountLabel.textContent = accountHandle;
  DOM.feedTitleHeading.textContent = `${fullName} • ${t("posts")}`;
}

function clearProfileFilter() {
  state.currentFilterAccount = null;
  DOM.profileViewSection.classList.remove("active");
  DOM.feedFilterIndicator.style.display = "none";
  DOM.feedTitleHeading.textContent = t("recentPosts");
  renderFeed();
}

// =========================================================================
// 10. Interaction Handlers & Auth Flow
// =========================================================================

function handleCardClick(postId) {
  if (!state.isAgeVerified) {
    openModal(DOM.ageModal);
    return;
  }

  if (!state.isLoggedIn) {
    openModal(DOM.authNagModal);
    return;
  }

  openLightbox(postId);
}

function handleAccountClick(accountHandle) {
  if (!state.isLoggedIn) {
    openModal(DOM.authNagModal);
    return;
  }

  state.currentFilterAccount = accountHandle;
  updateProfileBanner(accountHandle);
  renderFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function executeMockLogin() {
  window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank", "noopener,noreferrer");
  setCookie("logged_in", "true", 30);
  state.isLoggedIn = true;
  closeModal(DOM.authNagModal);
  updateAuthStateUI();
  renderFeed();
  updateLightboxIfOpen();
}

function executeLogout() {
  deleteCookie("logged_in");
  state.isLoggedIn = false;
  DOM.profileDropdown.classList.remove("show");
  updateAuthStateUI();
  renderFeed();
  updateLightboxIfOpen();
}

function updateAuthStateUI() {
  if (state.isLoggedIn) {
    DOM.headerLoginBtn.style.display = "none";
    DOM.headerProfileBtn.style.display = "flex";
  } else {
    DOM.headerLoginBtn.style.display = "inline-flex";
    DOM.headerProfileBtn.style.display = "none";
    DOM.profileDropdown.classList.remove("show");
  }
}

function updateAgeVerificationUI() {
  if (state.isAgeVerified) {
    DOM.body.classList.remove("media-blurred");
    closeModal(DOM.ageModal);
  } else {
    DOM.body.classList.add("media-blurred");
    openModal(DOM.ageModal);
  }
}

// =========================================================================
// 11. Lightbox Modal Controller
// =========================================================================

function openLightbox(postId) {
  const post = state.posts[postId];
  if (!post) return;

  state.activeLightboxId = postId;
  DOM.lightboxImg.src = post.image || `./img/${postId}.png`;
  DOM.lightboxImg.onerror = () => {
    DOM.lightboxImg.onerror = null;
    DOM.lightboxImg.src = "./img/0001.png";
  };

  DOM.lightboxPostTitle.textContent = post.title;
  DOM.lightboxAccount.textContent = post.account;
  if (DOM.lightboxPostDate) DOM.lightboxPostDate.textContent = t("postedRecently");
  
  const cleanUsername = normalizeCreatorId(post.account);
  const dbCreator = state.creators[cleanUsername];
  const avatarChar = getCreatorAvatarInitial(dbCreator, cleanUsername);
  DOM.lightboxAvatar.textContent = avatarChar;

  updateLightboxLikeState();
  DOM.lightboxModal.classList.add("show");
  DOM.body.style.overflow = "hidden";
}

function updateLightboxIfOpen() {
  if (!state.activeLightboxId || !DOM.lightboxModal.classList.contains("show")) return;
  const post = state.posts[state.activeLightboxId];
  if (!post) {
    closeLightbox();
    return;
  }
  updateLightboxLikeState();
}

function updateLightboxLikeState() {
  if (!state.activeLightboxId) return;
  const postId = state.activeLightboxId;
  const count = typeof state.likes[postId] === "number" 
    ? state.likes[postId] 
    : (INITIAL_SEED_LIKES[postId] || 0);

  const formattedCount = formatNumber(count);
  if (DOM.lightboxLikeCount) DOM.lightboxLikeCount.textContent = formattedCount;
  if (DOM.lightboxMediaLikeCount) DOM.lightboxMediaLikeCount.textContent = formattedCount;

  const userLiked = isPostLiked(postId);

  if (userLiked) {
    if (DOM.lightboxLikeBtn) DOM.lightboxLikeBtn.classList.add("liked");
    if (DOM.lightboxMediaLikeBtn) DOM.lightboxMediaLikeBtn.classList.add("liked");
  } else {
    if (DOM.lightboxLikeBtn) DOM.lightboxLikeBtn.classList.remove("liked");
    if (DOM.lightboxMediaLikeBtn) DOM.lightboxMediaLikeBtn.classList.remove("liked");
  }
}

function closeLightbox() {
  state.activeLightboxId = null;
  DOM.lightboxModal.classList.remove("show");
  DOM.body.style.overflow = "";
}

function navigateLightbox(direction) {
  if (!state.activeLightboxId) return;
  const visibleList = getVisiblePostList();
  if (visibleList.length <= 1) return;

  const currentIndex = visibleList.findIndex(p => p.id === state.activeLightboxId);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = visibleList.length - 1;
  if (nextIndex >= visibleList.length) nextIndex = 0;

  openLightbox(visibleList[nextIndex].id);
}

// =========================================================================
// 12. Generic Modal Helpers
// =========================================================================

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("show");
  DOM.body.style.overflow = "hidden";
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("show");
  DOM.body.style.overflow = "";
}

function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(num) {
  if (typeof num !== "number") return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

// =========================================================================
// 13. Event Listeners Setup
// =========================================================================

function setupEventListeners() {
  DOM.brandHomeLink.addEventListener("click", (e) => {
    e.preventDefault();
    clearProfileFilter();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  if (DOM.dropdownChoiceEn) {
    DOM.dropdownChoiceEn.addEventListener("click", () => setLanguage("en"));
  }
  if (DOM.dropdownChoiceHu) {
    DOM.dropdownChoiceHu.addEventListener("click", () => setLanguage("hu"));
  }

  DOM.ageConfirmBtn.addEventListener("click", () => {
    setCookie("age_verified", "true", 365);
    state.isAgeVerified = true;
    updateAgeVerificationUI();
  });

  DOM.ageDeclineBtn.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });

  DOM.headerLoginBtn.addEventListener("click", () => {
    openModal(DOM.authNagModal);
  });

  DOM.authLoginActionBtn.addEventListener("click", () => {
    executeMockLogin();
  });

  DOM.authNagCloseBtn.addEventListener("click", () => {
    closeModal(DOM.authNagModal);
  });

  DOM.headerProfileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.profileDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#header-actions")) {
      DOM.profileDropdown.classList.remove("show");
    }
  });

  DOM.dropdownRefreshDbBtn.addEventListener("click", () => {
    DOM.profileDropdown.classList.remove("show");
    initRealtimeDatabase();
  });

  DOM.dropdownLogoutBtn.addEventListener("click", () => {
    executeLogout();
  });

  DOM.profileBackToFeedBtn.addEventListener("click", clearProfileFilter);
  DOM.clearFilterBtn.addEventListener("click", clearProfileFilter);

  DOM.lightboxCloseBtn.addEventListener("click", closeLightbox);
  
  DOM.lightboxPrevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateLightbox(-1);
  });

  DOM.lightboxNextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateLightbox(1);
  });

  DOM.lightboxLikeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.activeLightboxId) return;
    togglePostLike(state.activeLightboxId);
  });

  if (DOM.lightboxMediaLikeBtn) {
    DOM.lightboxMediaLikeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!state.activeLightboxId) return;
      togglePostLike(state.activeLightboxId);
    });
  }

  if (DOM.lightboxImg) {
    DOM.lightboxImg.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (!state.activeLightboxId) return;
      togglePostLike(state.activeLightboxId);
    });
  }

  DOM.lightboxAccount.addEventListener("click", (e) => {
    e.preventDefault();
    const account = DOM.lightboxAccount.textContent;
    closeLightbox();
    handleAccountClick(account);
  });

  DOM.lightboxShareBtn.addEventListener("click", () => {
    if (navigator.clipboard && window.location.href) {
      navigator.clipboard.writeText(window.location.href);
      const originalText = DOM.lightboxShareBtn.innerHTML;
      DOM.lightboxShareBtn.innerHTML = `<span style="font-size: 0.75rem; font-weight: bold; color: var(--color-of-blue);">${t("copied")}</span>`;
      setTimeout(() => {
        DOM.lightboxShareBtn.innerHTML = originalText;
      }, 1500);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (DOM.lightboxModal.classList.contains("show")) {
        closeLightbox();
      } else if (DOM.authNagModal.classList.contains("show")) {
        closeModal(DOM.authNagModal);
      }
    } else if (DOM.lightboxModal.classList.contains("show")) {
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    }
  });

  DOM.authNagModal.addEventListener("click", (e) => {
    if (e.target === DOM.authNagModal) closeModal(DOM.authNagModal);
  });

  DOM.lightboxModal.addEventListener("click", (e) => {
    if (e.target === DOM.lightboxModal) closeLightbox();
  });
}

// =========================================================================
// 14. Initial Application Boot
// =========================================================================

function bootstrap() {
  setupEventListeners();
  applyLanguage();
  updateAuthStateUI();
  updateAgeVerificationUI();
  initRealtimeDatabase();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
