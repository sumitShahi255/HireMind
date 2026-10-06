import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, ArrowLeft, BarChart2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function AssessmentReport() {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [activeDistTab, setActiveDistTab] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const result = await axios.get(`${ServerUrl}/api/evaluation/assessment-report`, { withCredentials: true });
        setAuditData(result.data.audit);
      } catch (err) {
        console.error("Failed to fetch consistency audit:", err);
        setError("Could not generate consistency audit. Ensure you are authenticated and have admin access.");
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  useEffect(() => {
    if (auditData && !activeTab) {
        const cands = auditData.candidates;
        if (cands.some(c => c.typeLabel === 'Technical')) {
            setActiveTab('Technical');
            setActiveDistTab('Technical');
        }
        else if (cands.some(c => c.typeLabel === 'Coding')) {
            setActiveTab('Coding');
            setActiveDistTab('Coding');
        }
        else if (cands.some(c => c.typeLabel === 'HR')) {
            setActiveTab('HR');
            setActiveDistTab('HR');
        }
        else {
            setActiveTab('Technical');
            setActiveDistTab('Technical');
        }
    }
  }, [auditData, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center animate-pulse">
            <Activity className="text-indigo-400 w-16 h-16 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Analyzing AI evaluation quality...</p>
        </div>
      </div>
    );
  }

  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-slate-50 p-10 flex flex-col items-center pt-20">
        <AlertTriangle className="text-red-400 w-12 h-12 mb-4" />
        <p className="text-red-600 font-bold">{error || "Failed to load audit data."}</p>
        <button onClick={() => navigate(-1)} className="mt-6 text-indigo-600 underline">Go Back</button>
      </div>
    );
  }

  const { candidates, datasetSize, timestamp, analytics } = auditData;

  const hrCandidates = candidates.filter(c => c.typeLabel === 'HR');
  const techCandidates = candidates.filter(c => c.typeLabel === 'Technical');
  const codingCandidates = candidates.filter(c => c.typeLabel === 'Coding');

  return (
    <div className="min-h-screen bg-slate-50 px-4 sm:px-6 lg:px-10 py-8">
      
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2.5 rounded-full bg-white shadow hover:shadow-md transition">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
             <BarChart2 className="text-indigo-600" size={28} /> AI Assessment Quality & Evaluation Report
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base flex items-center gap-4">
            <span>{datasetSize} Assessment Attempts | {analytics.validScoresCount} Completed</span>
            <span>|</span>
            <span>Generated: {new Date(timestamp).toLocaleString()}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Evaluation Overview */}
        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        >
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Evaluation Overview</h3>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <p className="text-3xl font-bold text-slate-800">{datasetSize}</p>
                    <p className="text-sm text-slate-500 font-medium">Total Attempts</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-emerald-600">{analytics.validScoresCount}</p>
                    <p className="text-sm text-slate-500 font-medium">Completed</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-slate-800">{analytics.fullyEvaluatedRatio}%</p>
                    <p className="text-sm text-slate-500 font-medium">Completion Rate</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-indigo-600">{analytics.avgScore}<span className="text-lg text-slate-400">/100</span></p>
                    <p className="text-sm text-slate-500 font-medium">Average Completed Score</p>
                </div>
            </div>
        </motion.div>

        {/* Assessment Quality */}
        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        >
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Assessment Quality</h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-slate-600">Evaluation Completion Rate</span>
                    <span className="font-bold text-slate-800">{analytics.fullyEvaluatedRatio}%</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-slate-600">Completed Assessments</span>
                    <span className="font-bold text-slate-800">{analytics.validScoresCount} / {datasetSize}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-600">Incomplete / Unscored Attempts</span>
                    <span className="font-bold text-amber-600">{datasetSize - analytics.validScoresCount}</span>
                </div>
            </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Assessment Type Breakdown */}
        <motion.div 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        >
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Assessment Type Breakdown</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                        <tr>
                            <th className="px-4 py-2">Assessment Type</th>
                            <th className="px-4 py-2 text-center">Attempts</th>
                            <th className="px-4 py-2 text-center">Completed</th>
                            <th className="px-4 py-2 text-center">Avg Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {analytics.typeStats.map((stat, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-2 font-semibold text-slate-700">{stat.type} {stat.type !== 'Coding' ? 'Interview' : 'Assessment'}</td>
                                <td className="px-4 py-2 text-center">{stat.attempts}</td>
                                <td className="px-4 py-2 text-center">{stat.completedCount}</td>
                                <td className="px-4 py-2 text-center font-bold text-indigo-600">{stat.avg}/100</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>

        {/* Score Distribution */}
        <motion.div 
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[400px]"
        >
            <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Score Distribution — Completed Assessments Only</h3>
            </div>
            
            <div className="flex gap-4 mb-4 border-b border-slate-100">
                {analytics.typeStats.map((stat, idx) => (
                    <button 
                        key={idx}
                        onClick={() => setActiveDistTab(stat.type)} 
                        className={`pb-2 px-1 text-[11px] uppercase tracking-wider transition-colors 
                            ${activeDistTab === stat.type ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-semibold'} 
                            ${stat.completedCount === 0 ? 'opacity-40' : ''}`}
                    >
                        {stat.type} — {stat.completedCount} COMPLETED
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                {analytics.typeStats.filter(stat => stat.type === activeDistTab).map((stat, idx) => (
                    <div key={idx}>
                        {stat.completedCount > 0 ? (
                            <div className="mb-5 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                <p className="text-xs text-indigo-800/80">
                                    <strong className="text-indigo-900">{stat.completedCount}</strong> out of <strong className="text-indigo-900">{stat.attempts}</strong> {stat.type} attempts have been fully evaluated. The graph below shows the score distribution for these completed attempts.
                                </p>
                            </div>
                        ) : (
                            <div className="mb-5 p-3 bg-slate-50 rounded-lg border border-slate-100 text-center py-6">
                                <p className="text-xs text-slate-500 italic">No completed {stat.type} assessments available for distribution.</p>
                            </div>
                        )}
                        <div className="space-y-4 mt-2">
                            {Object.keys(stat.distribution).map((range, j) => {
                                const count = stat.distribution[range];
                                const percentage = stat.completedCount > 0 ? (count / stat.completedCount) * 100 : 0;
                                return (
                                    <div key={j} className="flex items-center gap-4">
                                        <span className="w-12 text-xs font-semibold text-slate-500">{range}</span>
                                        <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
                                                className="h-full bg-indigo-500 rounded-sm"
                                            ></motion.div>
                                        </div>
                                        <span className="w-8 text-xs font-bold text-slate-500 text-right">{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>

      </div>

      <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Assessment Performance Comparison</h2>
          
          <div className="flex gap-4 mb-6 border-b border-slate-200">
             <button onClick={() => setActiveTab('Technical')} className={`pb-3 px-2 text-sm uppercase tracking-wider transition-colors ${activeTab === 'Technical' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-semibold'} ${techCandidates.length === 0 ? 'opacity-40' : ''}`}>
                 Technical ({techCandidates.length})
             </button>
             <button onClick={() => setActiveTab('Coding')} className={`pb-3 px-2 text-sm uppercase tracking-wider transition-colors ${activeTab === 'Coding' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-semibold'} ${codingCandidates.length === 0 ? 'opacity-40' : ''}`}>
                 Coding ({codingCandidates.length})
             </button>
             <button onClick={() => setActiveTab('HR')} className={`pb-3 px-2 text-sm uppercase tracking-wider transition-colors ${activeTab === 'HR' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-semibold'} ${hrCandidates.length === 0 ? 'opacity-40' : ''}`}>
                 HR ({hrCandidates.length})
             </button>
          </div>

          {/* HR Interview Table */}
          {activeTab === 'HR' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">HR INTERVIEW — {hrCandidates.length} Attempts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 bg-slate-50/50 z-10 shadow-[1px_0_0_#f1f5f9]">Candidate / Attempt</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Algorithmic score based on cumulative interview performance.">Overall</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Clarity and professionalism in articulation.">Communication</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Confidence and poise during responses.">Confidence</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Ability to apply experiences to situational questions.">Situational Awareness</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Relevance of the answer to the behavioral question asked.">Relevance</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Number of suspicious activities.">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {hrCandidates.length > 0 ? hrCandidates.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 border-r border-slate-100 sticky left-0 bg-white z-10 shadow-[1px_0_0_#f1f5f9]">
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{new Date(c.date).toLocaleDateString()}</div>
                                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">Attempt ID: ASMT-{c.attemptId}</div>
                              </td>
                              <td className="px-6 py-3 text-center">
                                  {c.overallScore > 0 ? <span className="font-bold text-indigo-700 bg-indigo-50 text-xs px-2 py-1 rounded">{c.overallScore}/100</span> : <span className="text-slate-400 italic text-xs">Not evaluated</span>}
                              </td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.communication}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.confidence}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.practicalApplication}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.correctness}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className={`px-6 py-3 text-center ${c.detections > 10 ? 'text-red-600 font-bold bg-red-50/30' : ''}`}>
                                  {c.detections} <span className="text-[10px] opacity-70">detections</span>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic">No HR Interview records available.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Technical Interview Table */}
          {activeTab === 'Technical' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">TECHNICAL INTERVIEW — {techCandidates.length} Attempts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 bg-slate-50/50 z-10 shadow-[1px_0_0_#f1f5f9]">Candidate / Attempt</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Algorithmic score based on cumulative interview performance.">Overall</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Accuracy of technical answers provided.">Correctness</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Depth of technical knowledge demonstrated.">Technical Depth</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Ability to break down and solve abstract problems.">Problem Solving</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Understanding of real-world use cases.">Practical App.</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Number of suspicious activities.">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {techCandidates.length > 0 ? techCandidates.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 border-r border-slate-100 sticky left-0 bg-white z-10 shadow-[1px_0_0_#f1f5f9]">
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{new Date(c.date).toLocaleDateString()}</div>
                                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">Attempt ID: ASMT-{c.attemptId}</div>
                              </td>
                              <td className="px-6 py-3 text-center">
                                  {c.overallScore > 0 ? <span className="font-bold text-indigo-700 bg-indigo-50 text-xs px-2 py-1 rounded">{c.overallScore}/100</span> : <span className="text-slate-400 italic text-xs">Not evaluated</span>}
                              </td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.correctness}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.technicalDepth}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.problemSolving}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.practicalApplication}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className={`px-6 py-3 text-center ${c.detections > 10 ? 'text-red-600 font-bold bg-red-50/30' : ''}`}>
                                  {c.detections} <span className="text-[10px] opacity-70">detections</span>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic">No Technical Interview records available.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Coding Assessment Table */}
          {activeTab === 'Coding' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">CODING ASSESSMENT — {codingCandidates.length} Attempts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 bg-slate-50/50 z-10 shadow-[1px_0_0_#f1f5f9]">Candidate / Attempt</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Strict execution score based solely on Test Cases Passed.">Overall</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Ratio of passed test cases to total test cases.">Test Cases</th>
                      <th className="px-6 py-4 text-center cursor-help" title="AI qualitative score: Code structure, readability, and clean logic.">Code Quality</th>
                      <th className="px-6 py-4 text-center cursor-help" title="AI qualitative score: Time and space complexity optimization.">Efficiency</th>
                      <th className="px-6 py-4 text-center cursor-help" title="AI qualitative score: Logic and approach, independent of compilation success.">Correctness</th>
                      <th className="px-6 py-4 text-center cursor-help" title="Number of suspicious activities (tab switches, phone detected, etc.)">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {codingCandidates.length > 0 ? codingCandidates.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 border-r border-slate-100 sticky left-0 bg-white z-10 shadow-[1px_0_0_#f1f5f9]">
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{new Date(c.date).toLocaleDateString()}</div>
                                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">Attempt ID: ASMT-{c.attemptId}</div>
                              </td>
                              <td className="px-6 py-3 text-center">
                                  {c.overallScore > 0 ? <span className="font-bold text-indigo-700 bg-indigo-50 text-xs px-2 py-1 rounded">{c.overallScore}/100</span> : <span className="text-slate-400 italic text-xs">Not evaluated</span>}
                              </td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.testCasesPassed}/{c.metrics.testCasesTotal}</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.codeQuality}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.efficiency}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className="px-6 py-3 text-center">{c.overallScore > 0 ? <span className="font-medium">{c.metrics.correctness}/100</span> : <span className="text-slate-400 font-bold">—</span>}</td>
                              <td className={`px-6 py-3 text-center ${c.detections > 10 ? 'text-red-600 font-bold bg-red-50/30' : ''}`}>
                                  {c.detections} <span className="text-[10px] opacity-70">detections</span>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic">No Coding Assessment records available.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Audit Findings</h3>
          <ul className="space-y-3">
              {datasetSize - analytics.validScoresCount > 0 && (
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                      <div>
                          <span className="font-bold">{datasetSize - analytics.validScoresCount} assessment attempts currently have no completed score.</span>
                          <p className="text-slate-500 mt-1 text-xs">These records are excluded from completed-score analysis.</p>
                      </div>
                  </li>
              )}
              <li className="flex items-start gap-2 text-slate-700 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                  <div>
                      <span className="font-bold">{analytics.validScoresCount} assessment attempts have completed evaluation results.</span>
                  </div>
              </li>
          </ul>
      </div>

    </div>
  );
}

export default AssessmentReport;
