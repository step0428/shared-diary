// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyCbDgnBVjERkb7c8qbSawCjNxouTYGaGfU",
  authDomain: "shared-diary-fe8b9.firebaseapp.com",
  projectId: "shared-diary-fe8b9",
  storageBucket: "shared-diary-fe8b9.firebasestorage.app",
  messagingSenderId: "198286432259",
  appId: "1:198286432259:web:08d12184a3bdc52c861636"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();