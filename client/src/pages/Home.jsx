import { useState } from "react";
import Navbar from "../components/Navbar";
import { useSelector } from "react-redux";
import { motion } from "motion/react";
import { Bot, Sparkles, Mic, Clock, BarChart3, FileText } from "lucide-react";
import AuthModel from "../components/AuthModel";
import { useNavigate } from "react-router-dom";
import evalImg from "../assets/ai-ans.png";
import hrImg from "../assets/HR.png";
import techImg from "../assets/tech.png";
import confidenceImg from "../assets/confi.png";
import creditImg from "../assets/credit.png";
import resumeImg from "../assets/resume.png";
import pdfImg from "../assets/Pdf.png";
import analyticsImg from "../assets/history.png";
import Footer from "../components/Footer";


function Home() {
  const { userData } = useSelector((state) => state.user);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex flex-col">
      <Navbar />

      <div className="flex-1 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-6">
            <div
              className="bg-gray-100 text-gray-600 text-sm px-4 py-2 rounded-full
          flex items-center gap-2"
            >
              <Sparkles size={16} className="bg-green-50 text-green-600" />
              AI-Powered Smart Interview Assistant
            </div>
          </div>

          <div className="text-center mb-28">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-6xl font-semibold leading-tight max-w-4xl mx-auto"
            >
              Master Your Interviews with
              <span className="relative inline-block">
                <span className="bg-green-100 text-green-600 px-5 py-1 rounded-full">
                  AI Assistance
                </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-gray-500 mt-6 max-w-2xl mx-auto text-lg"
            >
              Role-based mock interviews with smart follow-ups, adaptive difficulty, and real-time performance insights.
            </motion.p>

            <div className="flex flex-wrap justify-center gap-4 mt-10">
              <motion.button
                onClick={() => {
                  if (!userData) {
                    setShowAuth(true);
                    return;
                  }
                  navigate("/interview");
                }}
                whileHover={{ opacity: 0.9, scale: 1.03 }}
                whileTap={{ opacity: 1, scale: 0.98 }}
                className="bg-black text-white px-10 py-3 rounded-full hover:opacity-90 transition shadow-md"
              >
               Start Mock Interview
              </motion.button>

              <motion.button
                onClick={() => {
                  if (!userData) {
                    setShowAuth(true);
                    return;
                  }
                  navigate("/coding-interview");
                }}
                whileHover={{ opacity: 0.9, scale: 1.03 }}
                whileTap={{ opacity: 1, scale: 0.98 }}
                className="bg-green-600 text-white px-10 py-3 rounded-full hover:bg-green-700 transition shadow-md"
              >
                Start Coding Interview
              </motion.button>

              <motion.button
                onClick={() => {
                  if (!userData) {
                    setShowAuth(true);
                    return;
                  }
                  navigate("/history");
                }}
                whileHover={{ opacity: 0.9, scale: 1.03 }}
                whileTap={{ opacity: 1, scale: 0.98 }}
                className="border border-gray-300 px-10 py-3 rounded-full hover:bg-gray-100 transition"
              >
                View History
              </motion.button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-10 mb-28">
            {[
              {
                icon: <Bot size={24} />,
                step: "STEP 1",
                title: "Select Role & Experience",
                desc: "AI adjusts questions based on your selected role and experience.",
              },
              {
                icon: <Mic size={24} />,
                step: "STEP 2",
                title: "AI Voice Interview",
                desc: "AI asks dynamic follow-up questions based on your responses.",
              },
              {
                icon: <Clock size={24} />,
                step: "STEP 3",
                title: "Real-Time Simulation",
                desc: "Experience real interview pressure with time tracking.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 + index * 0.2 }}
                whileHover={{ rotate: 0, scale: 1.06 }}
                className={`
                relative bg-white rounded-3xl border-2 border-green-100 hover:border-green-500 p-10 
                w-80 max-w-[90%] shadow-md hover:shadow-2xl transition-all duration-300 
                ${index == 0 ? "-rotate-4" : ""}
                ${index == 1 ? "-rotate-3 md:-mt-6 shadow-xl" : ""}
                ${index == 2 ? "-rotate-3" : ""}
                `}
              >
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white border-2 border-green-500 
                  text-green-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                >
                  {item.icon}
                </div>

                <div className="pt-10 text-center">
                  <div className="text-xs text-green-600 font-semibold mb-2 tracking-wider">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-3 text-lg">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mb-32">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-semibold text-center mb-16"
            >
              Powerful AI<span className="text-green-600">Features</span>
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-10">
              {[
                {
                  image: evalImg,
                  icon: <BarChart3 size={20} />,
                  title: "Smart Answer Analysis",
                  desc: "Evaluates communication and technical skills based on your resume.",
                },
                {
                  image: resumeImg,
                  icon: <FileText size={20} />,
                  title: "Resume-Based Interview",
                  desc: "Generates project-specific questions from your resume.",
                },
                {
                  image: pdfImg,
                  icon: <FileText size={20} />,
                  title: "Downloadable Report",
                  desc: "Detailed strengths, weaknesses, and improvement insights.",
                },
                {
                  image: analyticsImg,
                  icon: <BarChart3 size={20} />,
                  title: "History & Analytics",
                  desc: "Track your progress with detailed performance analytics and insights.",
                },
              ].map((items, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-full md:w-1/2 flex justify-center">
                      <img
                        src={items.image}
                        alt={items.title}
                        className="w-full h-auto object-contain max-h-64"
                      />
                    </div>

                    <div className="w-full md:w-1/2">
                      <div className="bg-green-50 text-green-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                        {items.icon}
                      </div>

                      <h3 className="font-semibold mb-3 text-xl">
                        {items.title}
                      </h3>

                      <p className="text-gray-500 text-sm leading-relaxed">
                        {items.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mb-32">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-semibold text-center mb-16"
            >
              Interview <span className="text-green-600">Modes</span>
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-10">
              {[
                {
                  image: hrImg,
                  title: "HR Interview",
                  desc: "Evaluate communication, personality, and behavioral skills.",
                },
                {
                  image: techImg,
                  title: "Technical Interview",
                  desc: "In-depth technical questions based on your selected role.",
                },
                {
                  image: confidenceImg,
                  title: "Confidence Analysis",
                  desc: "Deep technical questioning based on selected role.",
                },
                {
                  image: creditImg,
                  title: "Credits & Unlocks",
                  desc: "Unlock advanced interview features using credits.",
                },
                {
                  image: techImg,
                  title: "Code Interview",
                  desc: "Practice real coding interviews with compiler, test cases, timer, and AI evaluation.",
                  onClick: () => {
                    if (!userData) {
                      setShowAuth(true);
                      return;
                    }
                    navigate("/coding-interview");
                  }
                },
              ].map((mode, index) => (
                <motion.div
                  key={index}
                  onClick={() => {
                    if (mode.onClick) {
                      mode.onClick();
                    }
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all ${
                    mode.onClick ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="w-1/2">

                    <h3 className="font-semibold text-xl mb-3">{mode.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{mode.desc}</p>

                    </div>

                    <div className="w-1/2 flex justify-end">
                    <img src = {mode.image} alt = {mode.title} className="w-28 h-28 object-contain"/>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}

        <Footer/>
    </div>
  );
}

export default Home;
