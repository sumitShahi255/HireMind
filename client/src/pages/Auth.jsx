import React, { useState } from "react";
import { HiSparkles, HiOutlineLightningBolt } from "react-icons/hi";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook, FaTwitter } from "react-icons/fa";
import { motion } from "motion/react";
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "firebase/auth";
import { auth, provider, facebookProvider, twitterProvider } from "../utils/firebase";
import axios from "axios";
import { ServerUrl } from "../App";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";

function Auth({isModel = false}) {
      const dispatch = useDispatch();
      
      const [isLogin, setIsLogin] = useState(true);
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [name, setName] = useState("");
      const [error, setError] = useState("");
      const [message, setMessage] = useState("");
      const [loading, setLoading] = useState(false);

      const handleGoogleAuth = async () => {
            try {
                  setError("");
                  setMessage("");
                  const response = await signInWithPopup(auth,provider);
                  const googleUser = response.user;
                  const displayName = googleUser.displayName || (googleUser.providerData && googleUser.providerData[0] ? googleUser.providerData[0].displayName : null) || "Google User";
                  const googleEmail = googleUser.email || 
                                      (googleUser.providerData && googleUser.providerData[0] ? googleUser.providerData[0].email : null) ||
                                      (googleUser.reloadUserInfo && googleUser.reloadUserInfo.email) ||
                                      (response._tokenResponse && response._tokenResponse.email);
                  
                  if (!googleEmail) {
                        const keys = Object.keys(googleUser).join(", ");
                        throw new Error(`Could not retrieve email. User keys: ${keys}. ProviderData: ${JSON.stringify(googleUser.providerData)}. Please try logging in with Email and Password instead.`);
                  }

                  const result = await axios.post(ServerUrl + "/api/auth/google",
                  {name: displayName, email: googleEmail},{withCredentials:true});
                  dispatch(setUserData(result.data));
            } catch (err) {
                  console.log(err);
                  if (err.response && err.response.data && err.response.data.message) {
                        setError(`Server Error: ${err.response.data.message}`);
                  } else if (err.code === 'auth/popup-closed-by-user') {
                        setError("Google sign-in was cancelled.");
                  } else if (err.code === 'auth/account-exists-with-different-credential') {
                        setError("An account already exists with the same email address but different sign-in credentials.");
                  } else {
                        setError("Authentication failed with Google. Please try again.");
                  }
                  dispatch(setUserData(null));
            }
      }

      const handleEmailAuth = async (e) => {
            e.preventDefault();
            setError("");
            setMessage("");
            setLoading(true);

            // Add strong password validation for Sign Up
            if (!isLogin) {
                  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
                  if (!passwordRegex.test(password)) {
                        setError("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.");
                        setLoading(false);
                        return;
                  }
            }

            try {
                  let User;
                  let displayName = name;
                  if (isLogin) {
                        const response = await signInWithEmailAndPassword(auth, email, password);
                        User = response.user;
                        
                        // Check if email is verified before allowing login
                        if (!User.emailVerified) {
                              await sendEmailVerification(User);
                              await signOut(auth);
                              setError("Please verify your email first. A verification link has been sent to your email.");
                              setLoading(false);
                              return;
                        }

                        displayName = User.displayName || email.split('@')[0];
                  } else {
                        const response = await createUserWithEmailAndPassword(auth, email, password);
                        User = response.user;
                        await updateProfile(User, { displayName: name });
                        
                        // Send verification email and sign out immediately
                        await sendEmailVerification(User);
                        await signOut(auth);
                        
                        setMessage("Account created successfully! Please check your email to verify your account before logging in.");
                        setLoading(false);
                        setIsLogin(true); // Switch to login screen
                        return; // Stop here so it doesn't log them in yet
                  }
                  
                  const result = await axios.post(ServerUrl + "/api/auth/google",
                        { name: displayName, email: User.email }, { withCredentials: true });
                  dispatch(setUserData(result.data));
            } catch (err) {
                  console.log(err);
                  if (err.code === "auth/email-already-in-use") {
                        setError("This email is already registered. Please sign in instead.");
                  } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                        setError("Invalid email or password.");
                  } else if (err.code === "auth/invalid-email") {
                        setError("Please enter a valid email address.");
                  } else if (err.code === "auth/too-many-requests") {
                        setError("Too many attempts. Please check your email inbox for the verification link, or wait a minute before trying again.");
                  } else {
                        setError("Authentication failed. Please try again.");
                  }
                  dispatch(setUserData(null));
            } finally {
                  setLoading(false);
            }
      }

      const handleFacebookAuth = async () => {
            try {
                  setError("");
                  setMessage("");
                  const response = await signInWithPopup(auth, facebookProvider);
                  const fbUser = response.user;
                  const displayName = fbUser.displayName || "Facebook User";
                  // Fallback to a synthetic email if Facebook doesn't provide one (e.g., phone number accounts)
                  const email = fbUser.email || (fbUser.providerData && fbUser.providerData[0] ? fbUser.providerData[0].email : null) || (fbUser.reloadUserInfo && fbUser.reloadUserInfo.email) || (response._tokenResponse && response._tokenResponse.email) || `${fbUser.uid}@facebook.com`;

                  const result = await axios.post(ServerUrl + "/api/auth/google",
                        {name: displayName, email: email}, {withCredentials:true});
                  dispatch(setUserData(result.data));
            } catch (err) {
                  console.log(err);
                  if (err.response?.data?.message) {
                        setError(`Server Error: ${err.response.data.message}`);
                  } else if (err.code === 'auth/popup-closed-by-user') {
                        setError("Facebook sign-in was cancelled.");
                  } else if (err.code === 'auth/account-exists-with-different-credential') {
                        setError("An account already exists with the same email address but different sign-in credentials.");
                  } else {
                        setError("Authentication failed with Facebook. Please try again.");
                  }
                  dispatch(setUserData(null));
            }
      }

      const handleTwitterAuth = async () => {
            try {
                  setError("");
                  setMessage("");
                  const response = await signInWithPopup(auth, twitterProvider);
                  const twUser = response.user;
                  const displayName = twUser.displayName || "Twitter User";
                  // Fallback to a synthetic email if Twitter doesn't provide one
                  const email = twUser.email || (twUser.providerData && twUser.providerData[0] ? twUser.providerData[0].email : null) || (twUser.reloadUserInfo && twUser.reloadUserInfo.email) || (response._tokenResponse && response._tokenResponse.email) || `${twUser.uid}@twitter.com`;

                  const result = await axios.post(ServerUrl + "/api/auth/google",
                        {name: displayName, email: email}, {withCredentials:true});
                  dispatch(setUserData(result.data));
            } catch (err) {
                  console.log(err);
                  if (err.response?.data?.message) {
                        setError(`Server Error: ${err.response.data.message}`);
                  } else if (err.code === 'auth/popup-closed-by-user') {
                        setError("Twitter sign-in was cancelled.");
                  } else if (err.code === 'auth/account-exists-with-different-credential') {
                        setError("An account already exists with the same email address but different sign-in credentials.");
                  } else {
                        setError("Authentication failed with Twitter. Please try again.");
                  }
                  dispatch(setUserData(null));
            }
      }

  return (
    <div className={`
      w-full
      ${isModel ? "py-4" :"min-h-screen bg-[#f3f3f3] flex items-center justify-center px-6 py-12"}
      `}>

      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className={` 
          w-full 
          ${isModel ? "max-w-md p-8 rounded-3xl" : "max-w-md p-10 rounded-4xl"} bg-white shadow-2xl border border-gray-200
          `}>

        <div className="flex items-center justify-center gap-3 mb-6">

          <motion.div
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="bg-linear-to-r from-purple-500 to-indigo-600 text-white p-3 rounded-xl shadow-md">
            <HiSparkles size={20} />
          </motion.div>

          <h2 className="text-xl font-semibold text-gray-800">HireMind</h2>

        </div>

        <h3 className="text-2xl font-semibold text-center mb-2">
            {isLogin ? "Welcome Back" : "Create an Account"}
        </h3>
        
        <p className="text-gray-500 text-center text-sm mb-6">
            {isLogin 
                ? "Sign in to continue your AI interview practice." 
                : "Sign up to start practicing with AI interviews."}
        </p>

        {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-600 text-sm rounded-lg text-center">
                {error}
            </div>
        )}

        {message && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 text-sm rounded-lg text-center border border-green-200 shadow-sm">
                {message}
            </div>
        )}

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-4 mb-6">
            {!isLogin && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="John Doe"
                    />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="you@example.com"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                />
            </div>
            
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
            </motion.button>
        </form>

        <div className="flex items-center justify-between mb-6">
            <div className="w-full h-px bg-gray-200"></div>
            <span className="px-3 text-sm text-gray-400 font-medium">OR</span>
            <div className="w-full h-px bg-gray-200"></div>
        </div>

        <div className="flex flex-col gap-3 mb-6">
            <motion.button
                type="button"
                onClick={handleGoogleAuth}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-all duration-200">
                <FcGoogle size={20} />
                <span className="text-sm font-medium">Continue with Google</span>
            </motion.button>

            <motion.button
                type="button"
                onClick={handleFacebookAuth}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl shadow-sm transition-all duration-200">
                <FaFacebook size={20} />
                <span className="text-sm font-medium">Continue with Facebook</span>
            </motion.button>

            <motion.button
                type="button"
                onClick={handleTwitterAuth}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 bg-black hover:bg-gray-900 text-white rounded-xl shadow-sm transition-all duration-200">
                <FaTwitter size={20} />
                <span className="text-sm font-medium">Continue with X (Twitter)</span>
            </motion.button>
        </div>

        <p className="text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(""); setMessage(""); }} 
                className="text-indigo-600 font-semibold hover:underline">
                {isLogin ? "Sign Up" : "Sign In"}
            </button>
        </p>

      </motion.div>

    </div>
  );
}

export default Auth;
