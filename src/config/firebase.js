import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, setDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import { Await } from "react-router-dom";
import { toast } from "react-toastify";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "chat-app-57bc1.firebasestorage.app",
  messagingSenderId: "212375693848",
  appId: "1:212375693848:web:f564405b3d1a0d1b12b16d",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const signup = async (username,email,password) => {
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password)
        const user = res.user;
        await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            username: username.toLowerCase(),
            email,
            name: "",
            avatar:'',
            bio: "using this chat-app",
            lastSeen:Date.now(),
        })
        await setDoc(doc(db, "chats", user.uid), {
            chatData:[]
        })
    } catch(error) {
        console.error(error)
       toast.error(error.code.split("/")[1].split("-").join(" "));
    }
}

const login = async (email,password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error(error)
        toast.error(error.code.split('/')[1].split('-').join(" "));
    }
}

const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error(error);
        toast.error(error.code.split("/")[1].split("-").join(" "));
    }
    
}

const resetPass = async (email) =>
{
    if (!email) {
        toast.error("enter your email");
        return null;
    }
    try {
        const userRef = collection(db, 'users');
        const q = query(userRef, where("email", "==", email))
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            await sendPasswordResetEmail(auth, email);
            toast.success("reset email sent")
        } else {
            toast.error("email does not exists")
        }
    } catch (error) {
        console.error(error);
        toast.error(error.message)
    }
 }
export{login,signup,logout,auth,db,resetPass}
