import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autoTable";
import ExplainableEvaluation from "./ExplainableEvaluation";
import SkillGapAnalysis from "./SkillGapAnalysis";
import CandidateRoadmap from "./CandidateRoadmap";

function Step3Report({ report }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.speechSynthesis.cancel();
  }, []);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Generating Interview Report...</p>
      </div>
    );
  }

  const {
    finalScore = 0,
    totalDetections = 0,
    questions = [],
  } = report;

  let totalConf = 0, totalComm = 0, totalCorr = 0;
  questions.forEach(q => {
    totalConf += q.evaluation?.confidence || 0;
    totalComm += q.evaluation?.communication || 0;
    totalCorr += q.evaluation?.correctness || 0;
  });
  
  const qCount = questions.length || 1;
  const confidence = Math.round((totalConf / qCount) * 10) / 10;
  const communication = Math.round((totalComm / qCount) * 10) / 10;
  const correctness = Math.round((totalCorr / qCount) * 10) / 10;

  const questionScoreData = questions.map((q, index) => ({
    name: `Q${index + 1}`,
    score: ((q.evaluation?.confidence || 0) + (q.evaluation?.communication || 0) + (q.evaluation?.correctness || 0)) / 3 || 0,
  }));

  const skills = [
    { label: "Confidence", value: confidence },
    { label: "Communication", value: communication },
    { label: "Correctness", value: correctness },
  ];

  let performanceText;
  let shortTagline;

  if (finalScore >= 8) {
    performanceText = "Excellent interview performance with strong communication and technical clarity.";
    shortTagline = "Industry-ready responses with confident delivery.";
  } else if (finalScore >= 5) {
    performanceText = "Good performance with scope for improvement in clarity and confidence.";
    shortTagline = "Solid foundation with growing interview potential.";
  } else {
    performanceText = "Additional practice is recommended to improve communication and response structure.";
    shortTagline = "Focus on confidence, clarity, and technical explanation.";
  }

  const score = finalScore;
  const percentage = (score / 10)*100;

  const downloadPDF = () => {
    const doc  = new jsPDF("p","mm","a4");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let currentY = 25;

    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.setTextColor(34,197,94);
    doc.text("HireMind Interview Performance Report", pageWidth/2, currentY,  {align:"center"})

    currentY += 5;

    doc.setDrawColor(34,197,94);
    doc.line(margin, currentY+2, pageWidth - margin, currentY+2);

    currentY += 15;

    doc.setFillColor(240,253,244);
    doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, "F");

    doc.setFontSize(14);
    doc.setTextColor(0,0,0);
    doc.text(
      `Overall Interview Score: : ${finalScore}/10`,
      pageWidth / 2,
      currentY + 12,
      {align : "center"}
    );

    currentY += 30;

    doc.setFillColor(249 ,250, 251);
    doc.roundedRect(margin, currentY, contentWidth, 30, 4, 4, "F");

    doc.setFontSize(12);

    doc.text(`Confidence: ${confidence}`,margin + 10 ,currentY + 10);
    doc.text(`Communication: ${communication}`,margin + 10 ,currentY + 18);
    doc.text(`Correctness: ${correctness}`,margin + 10 ,currentY + 26);

    currentY += 45;

    let advice;
    if (finalScore >= 8) {
      doc.text("Excellent! You showed great communication and technical skills.", margin + 10, currentY + 10);
      advice = "You demonstrated strong communication skills, confidence, and structured problem-solving abilities. Continue refining technical depth and real-world examples to further strengthen interview performance.";
    } else if (finalScore >= 5) {
      doc.text("Good! Keep practicing to boost your confidence and clarity.", margin + 10, currentY + 10);
      advice = "You have a good foundation and understanding of core concepts. Focus on improving answer structure, communication clarity, and confidence during technical discussions.";
    } else {
      doc.text("Keep working hard! Focus on structuring your answers better.", margin + 10, currentY + 10);
      advice = "Consistent practice is recommended to improve confidence, technical communication, and structured problem-solving. Focus on mock interviews and explaining concepts clearly.";
    }

    doc.setFillColor(255,255,255);
    doc.setDrawColor(220);
    doc.roundedRect(margin, currentY, contentWidth, 35,4,4);

    doc.setFont("helvetica","normal");
    doc.setFontSize(11);

    const splitAdvice = doc.splitTextToSize(advice, contentWidth - 20);
    doc.text(splitAdvice, margin+10,currentY + 20);

    currentY += 50;

    autoTable(doc,{
      startY: currentY,
      margin:{left:margin, right:margin},
      head: [["#","Question","Score","Feedback"]],
      body: questions.map((q,i) => {
        const avg = ((q.evaluation?.confidence || 0) + (q.evaluation?.communication || 0) + (q.evaluation?.correctness || 0)) / 3;
        return [
        `${i + 1}`,
        q.questionText,
        `${avg.toFixed(1)}/10`,
        q.evaluation?.summary || "No feedback",
      ]}),
      styles: {
        fontSize: 9,
        cellPadding : 5,
        valign:"top",
      },
      headStyles: {
        fillColor: [34,197,94],
        textColor:255,
        halign:"center",
      },
      columnStyles: {
        0 : {cellWidth: 10,halign:"center"},
        1 : {cellWidth: 55},
        2 : {cellWidth: 20,halign:"center"},
        3 : {cellWidth: "auto"},
      },
      alternateRowStyles: {
        fillColor:[249,250,251],
      }
    });

    doc.save("HireMind_Interview_Report.pdf");
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-green-50 px-4 sm:px-6 lg:px-10 py-8 overflow-x-hidden">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => {
              if (location.pathname.startsWith("/report")) {
                navigate(-1);
              } else {
                window.location.reload();
              }
            }}
            className="p-2.5 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Interview Analytics Dashboard
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              Detailed AI-generated interview performance analysis
            </p>
          </div>
        </div>

        <button
        onClick={downloadPDF} 
        className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-6 rounded-lg
        shadow-md transition-all duration-300 font-semibold text-sm sm:text-base text-nowrap">
          Download Report
        </button>
      </div>

      <div className="mb-8">
        <ExplainableEvaluation interviewId={report._id} />
        <SkillGapAnalysis interviewId={report._id} />
        <CandidateRoadmap interviewId={report._id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        <div className="space-y-6">
          <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 text-center">
            <h3 className="text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base">Overall Interview Performance</h3>
            <div className='relative w-20 h-20 sm:w-25 sm:h-25 mx-auto'>
                  <CircularProgressbar
                  value={percentage} 
                  text={`${score}/10`}
                  styles={buildStyles({
                        textSize: "18px",
                        pathColor: "#10b981",
                        textColor: "#ef4444",
                        trailColor: "#e5e7eb"
                  })}
                  />
                </div>

                <p className="text-gray-400 mt-3 text-xs sm:text-sm">Out of 10</p>

                <div className="mt-4">
                  <p className="font-semibold text-gray-800 text-sm sm:text-base">{performanceText}</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1">{shortTagline}</p>
                </div>
          </motion.div>

          <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}} 
          className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-6">Core Skill Assessment</h3>

            <div className="space-y-5">
              {
                skills.map((s,i)=> (
                  <div key={i}>
                    
                    <div className="flex justify-between mb-2 text-sm sm:text-base">
                      <span>{s.label}</span>
                      <span className="font-semibold text-green-600">{s.value}</span>
                    </div>

                    <div className="bg-gray-200 h-2 sm:h-3 rounded-full">
                      <div className="bg-green-500 h-full rounded-full" style={{width: `${s.value *10}%`}}></div>
                    </div>
                  </div>
                ))
              }
            </div>

          </motion.div>

          {totalDetections !== undefined && (
          <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}} 
          className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Proctoring Summary</h3>
            <div className="flex justify-between items-center text-sm sm:text-base bg-red-50 p-4 rounded-xl border border-red-100">
              <span className="text-red-700 font-medium">Total Detections</span>
              <span className="font-bold text-red-600 text-lg">{totalDetections}</span>
            </div>
            
            {report?.proctoringLogs?.length > 0 && (
              <div className="mt-4 max-h-[220px] overflow-y-auto space-y-2 text-left bg-gray-50 p-4 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2 tracking-wider">Alert Detail History</span>
                {report.proctoringLogs.map((log, idx) => {
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
                    <div key={idx} className="flex justify-between items-start text-xs border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                      <span className={textColor}>{displayText}</span>
                      <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6 min-w-0">

          <motion.div
            initial={{opacity:0}}
            animate={{opacity:1}} 
            className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-5 sm:p-8 overflow-hidden">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4 sm:mb-6">
              Proctoring Recordings & Snapshots
            </h3>
            
            {report?.recordings?.videoChunks?.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4">Video Segments</h4>
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
              <div className="mt-4">
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4">Periodic Snapshots</h4>
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
            
            {!report?.recordings?.videoChunks?.length && !report?.recordings?.snapshots?.length && (
              <p className="text-gray-500 italic text-sm">No proctoring media recorded for this session.</p>
            )}
          </motion.div>
          <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}} 
          className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-5 sm:p-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4 sm:mb-6">
              Question-wise Performance Trend
            </h3>

            <div className="h-64 sm:h-72"> 

              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={questionScoreData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="name"/>
                <YAxis domain={[0,10]}/>
                <Tooltip/>
                <Area type="monotone"
                dataKey="score"
                stroke="#22c55e"
                fill="#bbf7d0"
                strokeWidth={3}/>
                </AreaChart>
              </ResponsiveContainer>

            </div>
          </motion.div>

          <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}} 
          className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-5 sm:p-8">

            <h3 className="text-base sm:text-lg font-semibold text-gray-600 mb-6">Detailed Question Analysis</h3>

            <div className="space-y-6">
              {questions.map((q,i) => {
                const avgScore = ((q.evaluation?.confidence || 0) + (q.evaluation?.communication || 0) + (q.evaluation?.correctness || 0)) / 3 || 0;
                return (
                <div key={i} className="bg-gray-50 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-200">

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Question {i+1} </p>
                      <p className="font-semibold text-gray-800 sm:text-base text-sm leading-relaxed">
                        {q.questionText || "Question not available"}
                      </p>
                    </div>

                    <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full font-bold text-xs sm:text-sm w-fit">
                      {avgScore.toFixed(1)}/10
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <p className="text-xs text-green-600 font-semibold mb-1">AI Interview Feedback</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {q.evaluation?.summary && q.evaluation.summary.trim() !== "" 
                      ? q.evaluation.summary
                    : "No feedback available for this question."}
                    </p>
                  </div>

                </div>
              )})}
            </div>
          </motion.div>
        </div>

      </div>

    </div>
  );
}

export default Step3Report;
