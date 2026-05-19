import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1VdYoiQ7tyDLxakVRdMwBVfVIZX_lJQc",
  authDomain: "interclasse-2k26.firebaseapp.com",
  projectId: "interclasse-2k26",
  storageBucket: "interclasse-2k26.firebasestorage.app",
  messagingSenderId: "691944070218",
  appId: "1:691944070218:web:df1f3ab45e782652b44493"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);