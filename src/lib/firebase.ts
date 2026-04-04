import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDSmENbb8bUFsoOn-KfQsbK6VMj2wulkB8",
  authDomain: "xiaoheishu-3e8e2.firebaseapp.com",
  projectId: "xiaoheishu-3e8e2",
  storageBucket: "xiaoheishu-3e8e2.firebasestorage.app",
  messagingSenderId: "204048757472",
  appId: "1:204048757472:web:812be86e75334e7b6d1685"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
