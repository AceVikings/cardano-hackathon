import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCzG7ofX3_JrFzABy57Nk41xPPSijdj0I",
  authDomain: "cardano-hackathon-3ef1a.firebaseapp.com",
  projectId: "cardano-hackathon-3ef1a",
  storageBucket: "cardano-hackathon-3ef1a.firebasestorage.app",
  messagingSenderId: "381270839398",
  appId: "1:381270839398:web:0a6adb720d0d3080175da7",
  measurementId: "G-TDKQ1F1Q58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
