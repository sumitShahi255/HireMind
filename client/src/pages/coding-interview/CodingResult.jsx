import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ServerUrl } from "../../App";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,Cell } from "recharts";
import {CheckCircle,XCircle,Cpu,Clock,Sparkles,AlertTriangle,Code,FileSpreadsheet,RotateCcw,ArrowLeft } from "lucide-react";
import ExplainableEvaluation from "../../components/ExplainableEvaluation";
import SkillGapAnalysis from "../../components/SkillGapAnalysis";
import CandidateRoadmap from "../../components/CandidateRoadmap";

function CodingResult() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(["", "", "", "", ""]);
  const [evaluating, setEvaluating] = useState(false);
  const [showProctoringDetail, setShowProctoringDetail] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(ServerUrl + `/api/coding-interview/report/${id}`, {
          withCredentials: true
        });
        setReport(response.data);
        if (response.data?.finalEvaluation?.isEvaluated) {
          const loadedAnswers = response.data.followUpAnswers?.map(a => a.answer) || ["", "", "", "", ""];
          setAnswers(loadedAnswers);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to load report.");
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Generating AI report analytics...</p>
        </div>
      </div>
    );
  }

  const activeQuestion = report?.questions?.[selectedQuestionIndex];

  const chartData = report?.questions?.map((q, idx) => ({
    name: `Q${idx + 1}`,
    questionId: `q${idx + 1}`,
    score: q.aiEvaluation?.qualityScore || 0,
    maxScore: 100,
    attempted: !!q.userCode?.trim()
  })) || [];

  const questionsSolved = report?.questions?.filter(q => q.status === "Passed").length || 0;
  const totalQuestions = report?.questions?.length || 0;

  let passedCasesCount = 0;
  let totalCasesCount = 0;
  report?.questions?.forEach(q => {
    const qCases = q.testCases || [];
    totalCasesCount += qCases.length;
    qCases.forEach((tc, tcIdx) => {
      const isPassed = tc.passed !== undefined 
        ? tc.passed 
        : (q.status === "Passed" ? true : (tcIdx === 0 ? q.runResult?.passed : false));
      if (isPassed) {
        passedCasesCount++;
      }
    });
  });
  const accuracy = totalCasesCount > 0 ? Math.round((passedCasesCount / totalCasesCount) * 100) : 0;

  const startTime = new Date(report?.createdAt || now);
  const endTime = report?.completedAt ? new Date(report.completedAt) : new Date(report?.updatedAt || now);
  const diffMs = Math.abs(endTime - startTime);
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const timeTakenStr = mins > 0 ? `${mins} mins ${secs}s` : `${secs}s`;

  const handleSubmitFinalAnswers = async (e) => {
    e.preventDefault();
    if (answers.some(ans => !ans.trim())) {
      alert("Please answer all 5 follow-up questions before submitting.");
      return;
    }
    
    setEvaluating(true);
    try {
      const response = await axios.post(ServerUrl + "/api/coding-interview/submit-final-evaluation", {
        interviewId: id,
        answers
      }, { withCredentials: true });
      
      setReport(response.data);
      if (response.data?.finalEvaluation?.isEvaluated) {
        const loadedAnswers = response.data.followUpAnswers?.map(a => a.answer) || ["", "", "", "", ""];
        setAnswers(loadedAnswers);
      }
      alert("Final evaluation complete!");
    } catch (error) {
      console.error(error);
      alert("Failed to submit final answers.");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-50 text-gray-800 transition"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="text-[11px] font-bold bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full uppercase tracking-wider">
                {report?.company} Assessment Report
              </span>
              <h1 className="text-3xl font-extrabold text-gray-900 mt-3">Coding Interview Report</h1>
              <p className="text-gray-500 text-sm mt-1">
                Generated on {new Date(report?.completedAt || report?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/coding-interview")}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black hover:bg-gray-800 text-white font-semibold text-sm transition shadow-md"
          >
            <RotateCcw size={16} /> New Assessment
          </button>
        </div>

        {(report?.finalEvaluation?.isEvaluated || report?.followUpQuestions?.length === 0) && (
          <div className="mb-2">
            <ExplainableEvaluation interviewId={id} />
            <SkillGapAnalysis interviewId={id} />
            <CandidateRoadmap interviewId={id} />
          </div>
        )}

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6" id="z4k8pn">
          <h2 className="text-xl font-extrabold text-gray-900 border-b border-gray-100 pb-3">
            Section 1 — Coding Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Questions Solved</span>
              <span className="block text-xl font-black text-gray-800 mt-1">{questionsSolved} / {totalQuestions}</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Passed Test Cases</span>
              <span className="block text-xl font-black text-gray-800 mt-1">{passedCasesCount} / {totalCasesCount}</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Accuracy</span>
              <span className="block text-xl font-black text-green-600 mt-1">{accuracy}%</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Time Taken</span>
              <span className="block text-xl font-black text-gray-800 mt-1">{timeTakenStr}</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Company</span>
              <span className="block text-xl font-black text-gray-800 mt-1 capitalize">{report?.company}</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Difficulty</span>
              <span className="block text-xl font-black text-blue-600 mt-1 capitalize">{report?.difficulty}</span>
            </div>
            {report?.totalDetections !== undefined && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
                <span className="block text-xs font-bold text-red-500 uppercase tracking-wider">Detections</span>
                <span className="block text-xl font-black text-red-700 mt-1">{report.totalDetections}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl flex flex-col items-center justify-center">
            <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider mb-6">Overall Score</h3>
            <div className="w-36 h-36">
              <CircularProgressbar
                value={report?.score || 0}
                text={`${report?.score || 0}/100`}
                styles={buildStyles({
                  pathColor: "#00C853",
                  textColor: "#0c0f12",
                  trailColor: "#e8f5e9",
                  textSize: "20px"
                })}
              />
            </div>
            <p className="text-xs text-gray-500 mt-6 text-center leading-relaxed">
              Based on code correctness, syntax metrics, time/space complexity efficiencies.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl flex flex-col">
            <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider mb-6">Question Metrics</h3>
            <div className="flex-1 min-h-[140px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: "#f1f3f5" }} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#00C853" : "#00B0FF"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl flex flex-col justify-between relative">
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider">Active Proctoring</h3>
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <AlertTriangle className={report?.proctoringLogs?.length > 2 ? "text-red-500" : "text-yellow-500"} size={28} />
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center justify-between">
                    <span>{report?.proctoringLogs?.length || 0} Alert Logs</span>
                    {report?.proctoringLogs?.length > 0 && (
                      <button
                        onClick={() => setShowProctoringDetail(!showProctoringDetail)}
                        className="text-[10px] text-green-600 hover:text-green-700 font-bold uppercase tracking-wider bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm"
                      >
                        {showProctoringDetail ? "Hide Details" : "View Details"}
                      </button>
                    )}
                  </h4>
                  <p className="text-xs text-gray-500 leading-normal mt-0.5">
                    Tab switches, fullscreen exits, or device anomalies tracked.
                  </p>
                </div>
              </div>

              {showProctoringDetail && report?.proctoringLogs?.length > 0 && (
                <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 max-h-[220px] overflow-y-auto space-y-2 mt-3 text-left">
                  <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Alert Detail History</span>
                  {report.proctoringLogs.map((log, logIdx) => {
                    const isAlert = log.event?.startsWith("Alert:");
                    const isViolation = log.event?.startsWith("Violation:");
                    
                    let textColor = "text-gray-700 font-medium";
                    if (isAlert) textColor = "text-orange-600 font-medium";
                    
                    if (isViolation) {
                      const lower = log.event?.toLowerCase() || "";
                      const isCritical = lower.includes("phone") || 
                                         lower.includes("multiple") || 
                                         lower.includes("absence") ||
                                         lower.includes("tab") ||
                                         lower.includes("window") ||
                                         lower.includes("shortcut");
                      
                      textColor = isCritical ? "text-red-600 font-bold" : "text-orange-500 font-medium";
                    }

                    const displayText = log.event?.replace("Alert: ", "").replace("Violation: ", "") || "Suspicious Activity";

                    return (
                      <div key={logIdx} className="flex justify-between items-start text-xs border-b border-gray-100 pb-1.5 last:border-b-0 last:pb-0">
                        <span className={textColor}>{displayText}</span>
                        <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {!showProctoringDetail && (
              <div className="text-[11px] text-gray-400 mt-6 leading-relaxed">
                Assessment session integrity was verified using computer vision face tracking and system tab checks.
              </div>
            )}
          </div>
        </div>

        {/* PROCTORING MEDIA SECTION */}
        {(report?.recordings?.videoChunks?.length > 0 || report?.recordings?.snapshots?.length > 0) && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6">
            <h2 className="text-xl font-extrabold text-gray-900 border-b border-gray-100 pb-3">
              Proctoring Recordings & Snapshots
            </h2>
            
            {report?.recordings?.videoChunks?.length > 0 && (
              <div>
                <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider mb-4">Video Segments</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {[...report.recordings.videoChunks].sort((a,b) => a.sequenceNumber - b.sequenceNumber).map((chunk, idx) => (
                    <div key={idx} className="flex-shrink-0 w-64 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                      <video src={chunk.url.replace('6000', '8000')} controls className="w-full h-36 object-cover bg-black" />
                      <div className="p-3">
                        <span className="text-xs font-bold text-gray-700">Segment {chunk.sequenceNumber}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{new Date(chunk.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report?.recordings?.snapshots?.length > 0 && (
              <div className="mt-2">
                <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider mb-4">Periodic Snapshots</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {[...report.recordings.snapshots].sort((a,b) => a.sequenceNumber - b.sequenceNumber).map((snap, idx) => (
                    <div key={idx} className="flex-shrink-0 w-48 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                      <img src={snap.url.replace('6000', '8000')} alt={`Snapshot ${snap.sequenceNumber}`} className="w-full h-32 object-cover" />
                      <div className="p-3">
                        <span className="text-xs font-bold text-gray-700">Snapshot {snap.sequenceNumber}</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden" id="m9t2wx">
          <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100">
            <h2 className="text-lg font-extrabold text-gray-900">
              Section 2 — AI Analysis
            </h2>
          </div>
          
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            {report?.questions?.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedQuestionIndex(idx)}
                className={`flex-1 py-4 text-center text-xs font-extrabold uppercase border-b-2 transition ${
                  selectedQuestionIndex === idx
                    ? "border-green-600 text-green-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
                }`}
              >
                Q{idx + 1}: {q.title}
              </button>
            ))}
          </div>

          <div className="p-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <h3 className="text-2xl font-bold text-gray-900">{activeQuestion?.title}</h3>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {activeQuestion?.status === "Passed" ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    <CheckCircle size={14} /> Passed All Testcases
                  </span>
                ) : activeQuestion?.status === "Unattempted" ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    <AlertTriangle size={14} /> Not Answered / Not Completed
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    <XCircle size={14} /> Failed Testcases
                  </span>
                )}

                <span className="px-3 py-1 bg-gray-100 border border-gray-200 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0">
                  Score: {activeQuestion?.aiEvaluation?.qualityScore}/100
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-green-50 text-green-600 border border-green-100">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">Time Complexity</h4>
                    <p className="text-xs font-mono text-green-700 mt-1">{activeQuestion?.aiEvaluation?.timeComplexity || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">Space Complexity</h4>
                    <p className="text-xs font-mono text-blue-700 mt-1">{activeQuestion?.aiEvaluation?.spaceComplexity || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">AI Optimization Feedback</h4>
                    <p className="text-xs text-gray-600 leading-relaxed mt-1">
                      {activeQuestion?.aiEvaluation?.optimizations || "No suggestions."}
                    </p>
                  </div>
                </div>

                {activeQuestion?.aiEvaluation?.edgeCases && (
                  <div className="flex items-start gap-4">
                    {activeQuestion.aiEvaluation.edgeCases.toLowerCase().includes("none") || 
                     activeQuestion.aiEvaluation.edgeCases.toLowerCase().includes("all edge") ? (
                      <>
                        <div className="p-3 rounded-2xl bg-green-50 text-green-600 border border-green-100">
                          <CheckCircle size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800">Edge Cases</h4>
                          <p className="text-xs text-gray-600 leading-relaxed mt-1">
                            {activeQuestion.aiEvaluation.edgeCases}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-2xl bg-yellow-50 text-yellow-600 border border-yellow-100">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800">Missed Edge Cases</h4>
                          <p className="text-xs text-gray-600 leading-relaxed mt-1">
                            {activeQuestion.aiEvaluation.edgeCases}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Test Case Execution Section */}
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-green-600" /> Test Case Execution
                  </h4>
                  <div className="grid gap-3">
                    {activeQuestion?.testCases?.map((tc, tcIdx) => {
                      const isPassed = tc.passed !== undefined 
                        ? tc.passed 
                        : (activeQuestion.status === "Passed" ? true : (tcIdx === 0 ? activeQuestion.runResult?.passed : false));
                      return (
                        <div key={tcIdx} className="flex items-center justify-between p-3.5 bg-gray-50/50 border border-gray-200/60 rounded-xl">
                          <div className="flex items-center gap-2.5">
                            {isPassed ? (
                              <span className="p-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                                <CheckCircle size={14} />
                              </span>
                            ) : activeQuestion?.status === "Unattempted" || activeQuestion?.status === "Pending" ? (
                              <span className="p-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                                <AlertTriangle size={14} />
                              </span>
                            ) : (
                              <span className="p-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                                <XCircle size={14} />
                              </span>
                            )}
                            <span className="text-xs font-bold text-gray-700">Test Case {tcIdx + 1}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2">
                            <span>Input:</span>
                            <span className="text-gray-700 bg-white border border-gray-200/80 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={tc.input}>
                              {tc.input}
                            </span>
                            <span>Expected:</span>
                            <span className="text-gray-700 bg-white border border-gray-200/80 px-1.5 py-0.5 rounded">
                              {tc.expectedOutput}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex flex-col h-full min-h-[300px]">
                <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                  <Code size={16} /> Submitted Solution
                </h4>
                <div className="flex-1 bg-[#1e1e1e] border border-gray-800 rounded-2xl p-5 overflow-auto font-mono text-xs text-gray-300 leading-relaxed max-h-[350px]">
                  <pre>{activeQuestion?.userCode || "// No solution submitted."}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-3" id="u3x7ql">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Section 3 & 4 — AI Follow-Up Questions
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                AI Interviewer Discussion Round: Respond to follow-ups generated from your submitted code.
              </p>
              {report?.interviewerPersonality && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  Interviewer Style: {report.interviewerPersonality}
                </div>
              )}
            </div>
            {report?.finalEvaluation?.isEvaluated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider mt-2 md:mt-0">
                <CheckCircle size={12} /> Evaluated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse mt-2 md:mt-0">
                <Sparkles size={12} /> Pending Answer Submission
              </span>
            )}
          </div>

          {report?.followUpQuestions?.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 text-center">
              <p className="text-gray-500 font-bold text-sm">
                {report?.status === "Incompleted" 
                  ? "The interview was incomplete, so follow-up technical discussion questions were not generated."
                  : "Since no code solutions were submitted, follow-up technical discussion questions are not available for this session."}
              </p>
            </div>
          ) : report?.finalEvaluation?.isEvaluated ? (
            <div className="space-y-6">
              {report?.followUpQuestions?.map((q, idx) => {
                const answerObj = report.followUpAnswers?.find(ans => ans.questionId === idx);
                const getCategoryStyle = (cat) => {
                  switch (cat?.toLowerCase()) {
                    case 'correctness':
                      return 'bg-green-50 border-green-200 text-green-700';
                    case 'optimization':
                      return 'bg-purple-50 border-purple-200 text-purple-700';
                    case 'debugging':
                    case 'edge_cases':
                      return 'bg-red-50 border-red-200 text-red-700';
                    case 'scalability':
                      return 'bg-blue-50 border-blue-200 text-blue-700';
                    case 'system_thinking':
                    case 'alternative_approaches':
                      return 'bg-indigo-50 border-indigo-200 text-indigo-700';
                    default:
                      return 'bg-gray-50 border-gray-200 text-gray-700';
                  }
                };
                return (
                  <div key={idx} className="bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                      <h4 className="text-sm font-bold text-gray-800">
                        {idx + 1}. {q.question}
                      </h4>
                      <div className="flex gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider ${getCategoryStyle(q.category)}`}>
                          {q.category || "General"}
                        </span>
                        {q.difficulty && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border border-gray-200 bg-gray-100 text-gray-600 tracking-wider">
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Candidate's Response</span>
                      <p className="text-sm text-gray-600 bg-white border border-gray-200/60 rounded-xl p-4 italic font-medium leading-relaxed">
                        "{answerObj?.answer || "No response provided."}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white border border-gray-200/60 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-gray-500 uppercase tracking-wider text-[9px]">Correctness</span>
                          <span className="font-bold text-gray-800">{q.correctnessScore || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${q.correctnessScore || 0}%` }} />
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200/60 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-gray-500 uppercase tracking-wider text-[9px]">Technical Depth</span>
                          <span className="font-bold text-gray-800">{q.depthScore || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${q.depthScore || 0}%` }} />
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200/60 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-gray-500 uppercase tracking-wider text-[9px]">Communication</span>
                          <span className="font-bold text-gray-800">{q.communicationScore || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${q.communicationScore || 0}%` }} />
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200/60 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-gray-500 uppercase tracking-wider text-[9px]">Optimization</span>
                          <span className="font-bold text-gray-800">{q.optimizationScore || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${q.optimizationScore || 0}%` }} />
                        </div>
                      </div>
                    </div>

                    {(q.confidence || (q.expectedConcepts && q.expectedConcepts.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {q.confidence && (
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border tracking-wider ${
                            q.confidence.toLowerCase() === 'high' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : q.confidence.toLowerCase() === 'medium'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            Confidence: {q.confidence}
                          </span>
                        )}
                        {q.expectedConcepts?.map((concept, cIdx) => (
                          <span key={cIdx} className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border border-gray-200 bg-gray-100 text-gray-500 tracking-wider">
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}

                    {q.feedback && (
                      <div className="bg-green-50/40 border border-green-100 rounded-2xl p-4 space-y-1">
                        <span className="text-[10px] font-extrabold text-green-800 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={12} className="text-green-600" /> AI Feedback & Suggestions
                        </span>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          {q.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmitFinalAnswers} className="space-y-6">
              {report?.followUpQuestions?.map((q, idx) => {
                const getCategoryStyle = (cat) => {
                  switch (cat?.toLowerCase()) {
                    case 'correctness':
                      return 'bg-green-50 border-green-200 text-green-700';
                    case 'optimization':
                      return 'bg-purple-50 border-purple-200 text-purple-700';
                    case 'debugging':
                    case 'edge_cases':
                      return 'bg-red-50 border-red-200 text-red-700';
                    case 'scalability':
                      return 'bg-blue-50 border-blue-200 text-blue-700';
                    case 'system_thinking':
                    case 'alternative_approaches':
                      return 'bg-indigo-50 border-indigo-200 text-indigo-700';
                    default:
                      return 'bg-gray-50 border-gray-200 text-gray-700';
                  }
                };
                return (
                  <div key={idx} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-sm font-bold text-gray-800">
                        {idx + 1}. {q.question}
                      </label>
                      <div className="flex gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider ${getCategoryStyle(q.category)}`}>
                          {q.category || "General"}
                        </span>
                        {q.difficulty && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border border-gray-200 bg-gray-100 text-gray-600 tracking-wider">
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                    <textarea
                      required
                      rows={3}
                      value={answers[idx]}
                      onChange={(e) => {
                        const newAnswers = [...answers];
                        newAnswers[idx] = e.target.value;
                        setAnswers(newAnswers);
                      }}
                      placeholder="Provide your technical explanation..."
                      className="w-full bg-white border border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-xl p-4 text-sm text-gray-700 outline-none transition duration-150 resize-y"
                    />
                  </div>
                );
              })}

              <div className="flex justify-end pt-4" id="f2n8vy">
                <button
                  type="submit"
                  disabled={evaluating}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold text-sm transition shadow-lg hover:shadow-xl"
                >
                  {evaluating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Evaluating Answers...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Submit Final Evaluation
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {report?.finalEvaluation?.isEvaluated && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-8" id="y6m4re">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="p-2.5 bg-green-50 text-green-600 rounded-2xl border border-green-100">
                <Sparkles size={20} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">
                  Section 5 — Final AI Evaluation
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Comprehensive performance ratings generated from your follow-up discussion.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-green-50/40 rounded-2xl p-5 border border-green-100 text-center flex flex-col justify-center items-center">
                <span className="text-xs font-extrabold text-green-800 uppercase tracking-wider">Communication</span>
                <span className="text-4xl font-black text-green-600 mt-2">{report?.finalEvaluation?.communicationScore}%</span>
              </div>
              <div className="bg-blue-50/40 rounded-2xl p-5 border border-blue-100 text-center flex flex-col justify-center items-center">
                <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider">Problem Solving</span>
                <span className="text-4xl font-black text-blue-600 mt-2">{report?.finalEvaluation?.problemSolvingScore}%</span>
              </div>
              <div className="bg-purple-50/40 rounded-2xl p-5 border border-purple-100 text-center flex flex-col justify-center items-center">
                <span className="text-xs font-extrabold text-purple-800 uppercase tracking-wider">Optimization</span>
                <span className="text-4xl font-black text-purple-600 mt-2">{report?.finalEvaluation?.optimizationScore}%</span>
              </div>
              <div className="bg-yellow-50/40 rounded-2xl p-5 border border-yellow-100 text-center flex flex-col justify-center items-center">
                <span className="text-xs font-extrabold text-yellow-800 uppercase tracking-wider">DSA Knowledge</span>
                <span className="text-4xl font-black text-yellow-600 mt-2">{report?.finalEvaluation?.dsaKnowledge}%</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-wider">
                Granular Evaluation Breakdown
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { name: "Clarity", score: report?.finalEvaluation?.clarity, desc: "Clear, precise answers without wordiness or confusion", color: "bg-green-500" },
                  { name: "Confidence", score: report?.finalEvaluation?.confidence, desc: "Assertive and definitive explanations of correctness", color: "bg-blue-500" },
                  { name: "Correctness", score: report?.finalEvaluation?.correctness, desc: "Accuracy of dry-runs, outputs, and edge cases", color: "bg-yellow-500" },
                  { name: "Technical Depth", score: report?.finalEvaluation?.technicalDepth, desc: "Deep knowledge of memory bounds, sorting, stacks/heaps", color: "bg-purple-500" },
                  { name: "Optimization Understanding", score: report?.finalEvaluation?.optimizationUnderstanding, desc: "Knowledge of speed/space compromise and big-O classes", color: "bg-indigo-500" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-100/60 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-sm text-gray-800">{item.name}</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                      <span className="font-black text-sm text-gray-800">{item.score || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{ width: `${item.score || 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={16} className="text-green-600" />
                Overall Recommendation
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed font-medium">
                {report?.finalEvaluation?.overallRecommendation}
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default CodingResult;
