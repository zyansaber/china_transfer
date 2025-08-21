// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBn4IJp4Y58E8hoLr3qJ3RM7f3AJIxD1I4",
  authDomain: "partssr.firebaseapp.com",
  databaseURL: "https://partssr-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "partssr",
  storageBucket: "partssr.firebasestorage.app",
  messagingSenderId: "170192235843",
  appId: "1:170192235843:web:e94eb765a20081e7ae93f6",
  measurementId: "G-E99627W9KP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const storage = getStorage(app);

// Function to get component image URL
export const getComponentImageUrl = async (componentMaterial: string): Promise<string | null> => {
  try {
    const imageRef = storageRef(storage, `${componentMaterial}.png`);
    const url = await getDownloadURL(imageRef);
    return url;
  } catch (error) {
    console.log(`Image not found for component: ${componentMaterial}`);
    return null;
  }
};