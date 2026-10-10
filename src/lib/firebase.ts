import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase 客户端懒加载：
 * - 只在浏览器里、并且配置了 NEXT_PUBLIC_FIREBASE_API_KEY 时才初始化；
 * - 构建 / 预渲染（服务端）阶段不会触碰 Firebase，所以没有 Firebase 环境变量也能 `next build`。
 * 生产环境行为不变：浏览器首次调用时用同样的配置初始化。
 */

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function buildConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || window.location.hostname,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined" || !isFirebaseConfigured()) {
    return null;
  }
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(buildConfig());
  }
  return cachedApp;
}

/** 返回 Firebase Auth；在服务端或未配置时返回 null。 */
export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) {
    return cachedAuth;
  }
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  cachedAuth = getAuth(app);
  return cachedAuth;
}
