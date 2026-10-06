import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "hiremind-b40a7.firebaseapp.com",
  projectId: "hiremind-b40a7",
  storageBucket: "hiremind-b40a7.firebasestorage.app",
  messagingSenderId: "112285916490",
  appId: "1:112285916490:web:8cc01c211493b5836ab5b3"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');
provider.setCustomParameters({
  prompt: 'select_account'
});

const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();

export {auth, provider, facebookProvider, twitterProvider};