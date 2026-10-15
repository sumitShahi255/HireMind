import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Mail,
  Briefcase,
  Phone,
  MapPin,
  Sparkles,
  Globe,
  Save,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  Wallet,
  Shield,
  Layers,
  Code2,
  BrainCircuit,
  Calendar,
  AlertCircle,
  Plus,
  X,
  ExternalLink,
  Camera,
  Check,
  Upload,
  Trash2,
  Loader2
} from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import Navbar from "../components/Navbar";
import AuthModel from "../components/AuthModel";
import { ServerUrl } from "../App";
import { setUserData } from "../redux/userSlice";

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Precious&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jocelyn&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/bottts/svg?seed=HireMind1&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Alex&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/personas/svg?seed=Oliver&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/personas/svg?seed=Sophia&backgroundColor=ffdfbf",
];

const POPULAR_SKILLS = [
  "JavaScript",
  "React",
  "Node.js",
  "Python",
  "TypeScript",
  "Data Structures",
  "System Design",
  "SQL",
  "MongoDB",
  "Next.js",
  "Docker",
  "AWS",
];

const TARGET_ROLES = [
  "Full Stack Developer",
  "Frontend Engineer",
  "Backend Engineer",
  "Software Development Engineer (SDE)",
  "Data Scientist / AI Engineer",
  "DevOps / Cloud Engineer",
  "Mobile App Developer (React Native/Flutter)",
  "Product Manager",
];

const EXPERIENCE_LEVELS = [
  "Student / Fresher",
  "Entry Level (0 - 2 years)",
  "Mid Level (2 - 5 years)",
  "Senior Level (5+ years)",
];

export default function Profile() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState({
    mockInterviewsCount: 0,
    codingInterviewsCount: 0,
    credits: 0,
    memberSince: null,
  });

  // Form states
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [skills, setSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Sync state when userData loads
  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setHeadline(userData.headline || "");
      setBio(userData.bio || "");
      setPhone(userData.phone || "");
      setLocation(userData.location || "");
      setTargetRole(userData.targetRole || "");
      setExperienceLevel(userData.experienceLevel || "");
      setSkills(Array.isArray(userData.skills) ? userData.skills : []);
      setGithubUrl(userData.githubUrl || "");
      setLinkedinUrl(userData.linkedinUrl || "");
      setPortfolioUrl(userData.portfolioUrl || "");
      setAvatarUrl(userData.avatarUrl || "");
    }
  }, [userData]);

  // Fetch stats from server
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${ServerUrl}/api/user/stats`, {
          withCredentials: true,
          headers,
        });
        if (res.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.log("Failed to fetch user stats", err);
      }
    };

    if (userData) {
      fetchStats();
    }
  }, [userData]);

  const handleAddSkill = (skillToAdd) => {
    const clean = (skillToAdd || newSkillInput).trim();
    if (!clean) return;
    if (!skills.includes(clean)) {
      setSkills([...skills, clean]);
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleResetForm = () => {
    if (userData) {
      setName(userData.name || "");
      setHeadline(userData.headline || "");
      setBio(userData.bio || "");
      setPhone(userData.phone || "");
      setLocation(userData.location || "");
      setTargetRole(userData.targetRole || "");
      setExperienceLevel(userData.experienceLevel || "");
      setSkills(Array.isArray(userData.skills) ? userData.skills : []);
      setGithubUrl(userData.githubUrl || "");
      setLinkedinUrl(userData.linkedinUrl || "");
      setPortfolioUrl(userData.portfolioUrl || "");
      setAvatarUrl(userData.avatarUrl || "");
    }
    setSuccessMessage("");
    setErrorMessage("");
  };

  // Upload user's real image from device
  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size must be less than 5MB.");
      return;
    }

    // Instant local preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);

    // Upload to server
    setUploadingAvatar(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${ServerUrl}/api/user/upload-avatar`, formData, {
        withCredentials: true,
        headers,
      });

      if (res.data && res.data.avatarUrl) {
        setAvatarUrl(res.data.avatarUrl);
        if (res.data.user) {
          dispatch(setUserData(res.data.user));
        }
        setSuccessMessage("Your real profile photo has been uploaded successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to upload photo to server. You can still save profile."
      );
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl("");
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.put(
        `${ServerUrl}/api/user/update-profile`,
        { name, avatarUrl: "" },
        { withCredentials: true, headers }
      );
      if (res.data && res.data.user) {
        dispatch(setUserData(res.data.user));
        setSuccessMessage("Photo removed. Initials will be used.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.put(
        `${ServerUrl}/api/user/update-profile`,
        {
          name: name.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          phone: phone.trim(),
          location: location.trim(),
          targetRole: targetRole.trim(),
          experienceLevel: experienceLevel.trim(),
          skills,
          githubUrl: githubUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
          portfolioUrl: portfolioUrl.trim(),
          avatarUrl: avatarUrl.trim(),
        },
        { withCredentials: true, headers }
      );

      if (res.data && res.data.user) {
        dispatch(setUserData(res.data.user));
        setSuccessMessage("Your profile has been saved successfully!");
        setTimeout(() => {
          setSuccessMessage("");
        }, 4000);
      }
    } catch (err) {
      console.error("Update profile error:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center"
          >
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <User size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Your Profile</h2>
            <p className="text-gray-500 text-sm mb-6">
              Sign in to manage your name, contact details, career preferences, and track your interview journey.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-xl shadow-lg transition duration-200 cursor-pointer"
            >
              Sign In to Continue
            </button>
          </motion.div>
        </div>
        {showAuthModal && <AuthModel onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  const memberDate = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Active Member";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-emerald-200">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20">
        {/* Top Breadcrumb / Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-xs hover:shadow transition duration-200 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield size={13} />
              AI Candidate Profile
            </span>
          </div>
        </div>

        {/* Feedback alerts */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold">{successMessage}</span>
              </div>
              <button
                onClick={() => setSuccessMessage("")}
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-600 shrink-0" />
                <span className="text-sm font-semibold">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage("")}
                className="text-red-600 hover:text-red-900 cursor-pointer"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden File Input for Real Photo Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
          onChange={handleImageFileSelect}
        />

        {/* Profile Hero Card */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden mb-8">
          {/* Top Banner Gradient */}
          <div className="h-28 sm:h-36 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 relative">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
          </div>

          <div className="px-6 sm:px-8 pb-8 pt-0 relative">
            {/* Avatar Row & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 sm:-mt-16 gap-4 mb-3">
              {/* Avatar Box */}
              <div className="flex items-end gap-4">
                <div className="relative group">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-white flex items-center justify-center overflow-hidden">
                    {uploadingAvatar ? (
                      <div className="w-full h-full bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-1 text-emerald-700">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-[10px] font-semibold">Uploading...</span>
                      </div>
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        className="w-full h-full object-cover rounded-xl bg-gray-50"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold text-4xl flex items-center justify-center rounded-xl shadow-inner">
                        {name ? name[0]?.toUpperCase() : "U"}
                      </div>
                    )}
                  </div>

                  {/* Clickable Camera badge on Avatar */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 bg-black hover:bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg transition duration-200 cursor-pointer disabled:opacity-50"
                    title="Upload your real photo"
                  >
                    <Camera size={16} />
                  </button>
                </div>

                {/* Desktop Real Photo Upload Action Buttons */}
                <div className="pb-1 hidden sm:flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Upload size={14} className="text-emerald-700" />
                    Upload Real Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition cursor-pointer"
                  >
                    {showAvatarPicker ? "Hide Presets" : "Avatar Presets"}
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-medium transition cursor-pointer"
                      title="Remove custom photo and use initials"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons (Reset & Save) */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-black hover:bg-gray-50 text-sm font-medium transition cursor-pointer shadow-2xs"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white font-medium text-sm shadow-md hover:shadow-lg transition duration-200 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>

            {/* Mobile Real Photo Upload Buttons */}
            <div className="flex sm:hidden items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
              >
                <Upload size={13} /> Upload Real Photo
              </button>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium"
              >
                {showAvatarPicker ? "Hide" : "Avatars"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs px-2 py-1.5 text-red-600 font-medium"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Candidate Identity Details - 100% on White Background (Zero Overlap with Dark Banner) */}
            <div className="mb-6 pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {name || "Your Name"}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Shield size={12} />
                  Verified Candidate
                </span>
                {targetRole && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Briefcase size={12} />
                    {targetRole}
                  </span>
                )}
              </div>

              {headline ? (
                <p className="text-sm font-semibold text-emerald-800 mt-1">
                  {headline}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1 italic">
                  Add your professional headline below (e.g. Full Stack Developer | React, Node.js & System Design)
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 font-medium mt-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" />
                  {userData.email}
                </span>
                {phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} className="text-gray-400" />
                    {phone}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-gray-400" />
                    {location}
                  </span>
                )}
              </div>
            </div>

            {/* Avatar Picker Modal / Dropdown */}
            {showAvatarPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 shadow-inner"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Or Select An Illustrated Avatar Preset
                  </span>
                  <button
                    onClick={() => setShowAvatarPicker(false)}
                    className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatarUrl(preset);
                        setShowAvatarPicker(false);
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 p-0.5 transition hover:scale-105 cursor-pointer ${
                        avatarUrl === preset
                          ? "border-emerald-600 ring-2 ring-emerald-200"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <img src={preset} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                      {avatarUrl === preset && (
                        <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center">
                          <Check size={16} className="text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Or paste an image web link (https://...)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  />
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:text-red-600 hover:bg-gray-100 cursor-pointer"
                    >
                      Use Initial
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                  <Wallet size={15} className="text-emerald-600" />
                  Available Credits
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-gray-900">
                    {userData.credits ?? 0}
                  </span>
                  <button
                    onClick={() => navigate("/pricing")}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    Top up
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                  <BrainCircuit size={15} className="text-blue-600" />
                  Mock Interviews
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-gray-900">
                    {stats.mockInterviewsCount}
                  </span>
                  <button
                    onClick={() => navigate("/history")}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                  >
                    View
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                  <Code2 size={15} className="text-purple-600" />
                  Coding Interviews
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-gray-900">
                    {stats.codingInterviewsCount}
                  </span>
                  <button
                    onClick={() => navigate("/history")}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 underline cursor-pointer"
                  >
                    View
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                  <Calendar size={15} className="text-amber-600" />
                  Member Since
                </div>
                <div className="text-sm font-bold text-gray-800 truncate mt-1">
                  {memberDate}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
                <p className="text-xs text-gray-500">Your core identity details shown on reports and interviews</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Email Address (Google Account)
                </label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    disabled
                    value={userData.email || ""}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Email is verified via Google authentication</p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Current Location / City
                </label>
                <div className="relative">
                  <MapPin size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="New Delhi, India"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Career & Target Role */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                <Briefcase size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Career Preferences & Target Role</h2>
                <p className="text-xs text-gray-500">Helps AI tailor questions, feedback, and difficulty</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Professional Headline */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Professional Headline / Tagline
                </label>
                <div className="relative">
                  <Sparkles size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Full Stack Developer | React, Node.js & System Design Enthusiast"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Target Role */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Target Job Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  >
                    <option value="">Select Target Role</option>
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                    {targetRole && !TARGET_ROLES.includes(targetRole) && (
                      <option value={targetRole}>{targetRole}</option>
                    )}
                  </select>
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Experience Level
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  >
                    <option value="">Select Experience Level</option>
                    {EXPERIENCE_LEVELS.map((exp) => (
                      <option key={exp} value={exp}>
                        {exp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio / Summary */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Candidate Bio / Professional Summary
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short summary about your background, career goals, or specific interview focus areas..."
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition resize-none"
                />
              </div>

              {/* Key Skills Tags */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Skills & Technologies ({skills.length})
                </label>
                
                {/* Add Skill Input */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Layers size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="Add a skill (e.g. React, Python, Docker) & press Enter"
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSkill()}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {/* Selected Skills Chips */}
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-2xs"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-red-600 transition cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-2">No skills added yet.</p>
                )}

                {/* Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 font-medium mr-1">Suggested:</span>
                  {POPULAR_SKILLS.filter((s) => !skills.includes(s)).slice(0, 6).map((pop) => (
                    <button
                      key={pop}
                      type="button"
                      onClick={() => handleAddSkill(pop)}
                      className="text-[11px] px-2.5 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition cursor-pointer"
                    >
                      + {pop}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Social & Portfolio Links */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                <Globe size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Online Profiles & Links</h2>
                <p className="text-xs text-gray-500">Showcase your repositories, professional network, and projects</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* GitHub */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  GitHub Profile
                </label>
                <div className="relative">
                  <FaGithub size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* LinkedIn */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  LinkedIn Profile
                </label>
                <div className="relative">
                  <FaLinkedin size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" />
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                  {linkedinUrl && (
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Portfolio */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Portfolio / Website
                </label>
                <div className="relative">
                  <Globe size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://yourportfolio.dev"
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-gray-50/50 hover:bg-white transition"
                  />
                  {portfolioUrl && (
                    <a
                      href={portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Floating/Sticky Save Action Bar */}
          <div className="sticky bottom-6 z-40 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-200 shadow-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Sparkles size={16} className="text-emerald-600" />
              <span>Ensure your profile is complete for optimal AI interview feedback</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-black hover:bg-gray-100 transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-sm font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {loading ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
