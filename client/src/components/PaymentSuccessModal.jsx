import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Sparkles, Check, ArrowRight, X, ShieldCheck, Zap } from "lucide-react";

// Generate celebratory confetti particles
const CONFETTI_COLORS = [
  "#10b981", // Emerald
  "#059669", // Deep Emerald
  "#34d399", // Light Emerald
  "#f59e0b", // Amber/Gold
  "#fbbf24", // Yellow Gold
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

const CONFETTI_PIECES = Array.from({ length: 48 }).map((_, i) => {
  const angle = (i / 48) * 360 + (Math.random() * 20 - 10);
  const distance = 90 + Math.random() * 160;
  const rad = (angle * Math.PI) / 180;
  return {
    id: i,
    x: Math.cos(rad) * distance,
    y: Math.sin(rad) * distance + (Math.random() * 40 - 20),
    rotation: Math.random() * 720 - 360,
    scale: 0.6 + Math.random() * 0.7,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: i % 4 === 0 ? "circle" : i % 4 === 1 ? "rect" : i % 4 === 2 ? "square" : "line",
    delay: Math.random() * 0.15,
  };
});

function PaymentSuccessModal({
  isOpen,
  creditsAdded = 0,
  planName = "Starter Pack",
  newBalance = null,
  onClose,
}) {
  const [displayCredits, setDisplayCredits] = useState(0);

  // Animated counter for credits added
  useEffect(() => {
    if (!isOpen || !creditsAdded) {
      setDisplayCredits(0);
      return;
    }

    let start = 0;
    const end = Number(creditsAdded) || 0;
    const duration = 1200; // ms
    const stepTime = 25;
    const totalSteps = duration / stepTime;
    const increment = Math.max(1, Math.ceil(end / totalSteps));

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayCredits(end);
        clearInterval(timer);
      } else {
        setDisplayCredits(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isOpen, creditsAdded]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 30 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              type: "spring",
              damping: 24,
              stiffness: 320,
            },
          }}
          exit={{ opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.2 } }}
          className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-100 text-center overflow-hidden z-10"
        >
          {/* Top Decorative Ambient Background Glows */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-b from-emerald-400/25 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal-400/15 rounded-full blur-xl pointer-events-none" />

          {/* Close (X) button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
          >
            <X size={18} />
          </button>

          {/* Confetti Explosion System */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {CONFETTI_PIECES.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  rotate: 0,
                  opacity: 1,
                }}
                animate={{
                  x: p.x,
                  y: [0, p.y - 40, p.y + 70],
                  scale: [0, p.scale, p.scale * 0.8],
                  rotate: p.rotation,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 1.8,
                  delay: p.delay,
                  ease: "easeOut",
                }}
                style={{
                  position: "absolute",
                  backgroundColor: p.color,
                  borderRadius: p.shape === "circle" ? "50%" : p.shape === "line" ? "2px" : "3px",
                  width: p.shape === "line" ? "4px" : p.shape === "rect" ? "10px" : "7px",
                  height: p.shape === "line" ? "14px" : "7px",
                }}
              />
            ))}
          </div>

          {/* Glowing Animated Icon Badge */}
          <div className="relative mx-auto mt-2 mb-5 flex items-center justify-center">
            {/* Outer Pulsing Wave Ring */}
            <motion.div
              animate={{
                scale: [1, 1.35, 1],
                opacity: [0.4, 0, 0.4],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute w-24 h-24 rounded-full bg-emerald-500/20 blur-sm"
            />

            {/* Inner Ring */}
            <motion.div
              animate={{
                scale: [1, 1.18, 1],
                opacity: [0.6, 0.2, 0.6],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
              className="absolute w-20 h-20 rounded-full bg-emerald-400/30"
            />

            {/* Main Emblem Circle */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 20,
                delay: 0.1,
              }}
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/30 flex items-center justify-center border-2 border-white/60"
            >
              <Wallet className="w-10 h-10 text-white drop-shadow-md" />

              {/* Sparkle badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="absolute -top-2 -right-2 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-md border-2 border-white"
              >
                <Sparkles size={14} className="fill-amber-950" />
              </motion.div>

              {/* Mini Check badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -bottom-2 -right-1 bg-white text-emerald-600 p-1 rounded-full shadow-md border border-emerald-100"
              >
                <Check size={14} strokeWidth={3} />
              </motion.div>
            </motion.div>
          </div>

          {/* Celebratory Pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold tracking-wide border border-emerald-200 shadow-xs mb-3"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>PAYMENT VERIFIED</span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight"
          >
            Payment Successful!
          </motion.h2>

          {/* Credit Amount Announcement */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 300 }}
            className="my-3 py-2 px-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 inline-block shadow-inner"
          >
            <div className="flex items-center justify-center gap-2">
              <Zap size={22} className="text-emerald-600 fill-emerald-500" />
              <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
                +{displayCredits} Credits
              </span>
            </div>
            <p className="text-xs font-medium text-emerald-700 mt-0.5">
              Added to your wallet for <span className="font-semibold">{planName}</span>
            </p>
          </motion.div>

          {/* Subtitle description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 text-sm leading-relaxed px-4 mb-5"
          >
            Your interview credits are now active and ready to use. Prepare and ace your next AI interview!
          </motion.p>

          {/* Wallet Balance Card */}
          {newBalance !== null && newBalance !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-gray-50/90 rounded-2xl p-4 border border-gray-200 flex items-center justify-between mb-6 shadow-xs text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-200 flex items-center justify-center text-emerald-600">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Wallet Balance
                  </p>
                  <p className="text-sm font-bold text-gray-800">Available Credits</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-emerald-600">
                  {newBalance}
                </span>
                <span className="text-xs font-medium text-gray-500 ml-1">credits</span>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-2.5"
          >
            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/35 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition cursor-pointer"
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PaymentSuccessModal;
