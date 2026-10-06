import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { ServerUrl } from "../../App";
import { setUserData } from "../../redux/userSlice";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Terminal, Shield, Cpu, ChevronRight, Sparkles, ArrowLeft } from "lucide-react";
import { companiesData } from "../../data/companiesData";

function CompanySelection() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [company, setCompany] = useState("Google");
  const [selectedCategory, setSelectedCategory] = useState("Product-Based");
  const [language, setLanguage] = useState("Python 3");
  const [difficulty, setDifficulty] = useState("Easy");
  const [loading, setLoading] = useState(false);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    const firstComp = companiesData.find((c) => c.category === cat);
    if (firstComp) {
      setCompany(firstComp.name);
    }
  };

  const languages = [
    { label: "</> Python 3", value: "Python 3" },
    { label: "</> JavaScript (Node)", value: "JavaScript (Node)" },
    { label: "</> Java 15", value: "Java 15" },
    { label: "</> C++ (GCC)", value: "C++ (GCC)" },
    { label: "</> C", value: "C" }
  ];

  const difficulties = ["Easy", "Medium", "Hard"];

  const handleStart = async () => {
    if (!userData) {
      alert("Please login first.");
      navigate("/auth");
      return;
    }
    setLoading(false);
    setLoading(true);

    try {
      const response = await axios.post(
        ServerUrl + "/api/coding-interview/start",
        {
          company,
          language,
          difficulty
        },
        { withCredentials: true }
      );

      dispatch(
        setUserData({
          ...userData,
          credits: response.data.creditsLeft
        })
      );

      navigate(`/coding-interview/${response.data.interviewId}`, { replace: true });
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to start coding round.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans relative">
      <Navbar />

      <button
        onClick={() => navigate(-1)}
        className="absolute top-28 left-6 md:left-12 lg:left-24 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 text-gray-800 transition"
        title="Go back"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        {loading ? (
          <div className="text-center p-8 bg-white shadow-xl rounded-2xl max-w-md w-full flex flex-col items-center">
            <Sparkles className="animate-spin text-green-600 w-12 h-12 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating DSA Questions</h2>
            <p className="text-gray-500 text-sm">
              Our AI is tailoring questions for {company} in {language} with {difficulty} difficulty...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-gray-100">
            <div className="w-full md:w-2/5 bg-[#090d16] text-white p-8 md:p-10 flex flex-col justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-950/80 border border-green-800 text-[#00E676] rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse"></span>
                  Coding Arena
                </span>

                <h1 className="text-3xl font-extrabold tracking-tight mb-4 leading-tight">
                  Real-Time <span className="text-[#00E676]">Coding Rounds</span>
                </h1>

                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  Select your target company and preferred language. The AI will generate dynamic DSA questions
                  formatted to simulate actual hiring evaluations.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#00E676]">
                      <Terminal size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-200">Monaco Editor</h4>
                      <p className="text-xs text-gray-400 leading-normal mt-0.5">
                        Industry-standard syntax highlighting, auto-formatting, and error detection.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#00E676]">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-200">Judge0 Execution Engine</h4>
                      <p className="text-xs text-gray-400 leading-normal mt-0.5">
                        Write, run, and compile code instantly against hidden test cases.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-red-400">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-200">Active Proctoring</h4>
                      <p className="text-xs text-gray-400 leading-normal mt-0.5">
                        Tab tracking, full-screen lock, and webcam face analysis apply.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-800 text-[11px] text-gray-500">
                * Starts coding assessment. Cost: 50 interview credits.
              </div>
            </div>

            <div className="w-full md:w-3/5 p-8 md:p-10 flex flex-col justify-between bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Configure Coding Session</h2>
                <p className="text-gray-500 text-sm mt-1">Set your parameters to generate the DSA challenge.</p>

                <div className="mt-8">
                  <label className="text-[11px] font-extrabold tracking-wider uppercase text-gray-400 block mb-2">
                    Target Company
                  </label>
                  
                  <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
                    {["Product-Based", "Service-Based", "Startups"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 ${
                          selectedCategory === cat
                            ? "bg-[#00d26a] text-black shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[260px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {companiesData
                        .filter((c) => c.category === selectedCategory)
                        .map((c) => {
                          const isSelected = company === c.name;
                          return (
                            <div
                              key={c.name}
                              onClick={() => {
                                setCompany(c.name);
                              }}
                              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition duration-150 flex gap-3 items-center ${
                                isSelected
                                  ? "border-[#00d26a] bg-[#00d26a]/5 shadow-xs"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-base flex-shrink-0 shadow-xs ${c.color}`}
                              >
                                {c.initial}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-bold text-gray-900 text-sm truncate">{c.name}</h3>
                                  <span className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">
                                    ROUND
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                  Focus: {c.focusTopics.slice(0, 3).join(", ")}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className="px-2 py-0.5 bg-gray-100 rounded-md text-[9px] font-extrabold text-gray-600 uppercase">
                                    {difficulty}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 rounded-md text-[9px] font-extrabold text-gray-600">
                                    {difficulty === "Easy" ? 45 : difficulty === "Medium" ? 60 : 90} Mins
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <label className="text-[11px] font-extrabold tracking-wider uppercase text-gray-400 block mb-2.5">
                    Programming Language
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {languages.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLanguage(l.value)}
                        className={`px-4 py-3 rounded-xl text-sm font-semibold border transition duration-200 text-left flex items-center justify-between ${
                          language === l.value
                            ? "bg-green-50/50 border-green-600 text-green-700 shadow-xs"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <label className="text-[11px] font-extrabold tracking-wider uppercase text-gray-400 block mb-2.5">
                    Interview Difficulty
                  </label>
                  <div className="flex gap-3">
                    {difficulties.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition duration-200 ${
                          difficulty === d
                            ? "bg-black text-white border-black shadow-md"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={handleStart}
                  className="w-full bg-[#00C853] hover:bg-[#00B0FF]/0 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition duration-200 flex items-center justify-center gap-2 text-md"
                >
                  Start Coding Interview <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default CompanySelection;
