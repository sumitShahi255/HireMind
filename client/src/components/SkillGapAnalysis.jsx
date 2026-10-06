import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import { motion } from 'motion/react';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Radar } from 'lucide-react';

function SkillGapAnalysis({ interviewId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const result = await axios.get(`${ServerUrl}/api/evaluation/skill-gap/${interviewId}?t=${Date.now()}`, { withCredentials: true });
        setAnalysis(result.data.gapAnalysis);
      } catch (err) {
        console.error("Failed to fetch skill gap analysis:", err);
        setError("Could not generate skill gap analysis. The interview might not be completed or the data is missing.");
      } finally {
        setLoading(false);
      }
    };
    if (interviewId) {
        fetchAnalysis();
    }
  }, [interviewId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 animate-pulse text-center">
        <div className="flex justify-center mb-4">
            <Target className="text-gray-300 w-12 h-12 animate-pulse" />
        </div>
        <p className="text-gray-500">Evaluating Skill Gaps...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 text-center border border-red-100">
        <AlertCircle className="text-red-400 w-10 h-10 mx-auto mb-3" />
        <p className="text-red-500">{error || "Failed to load skill gap analysis."}</p>
      </div>
    );
  }

  const { skills, criticalGaps, strengths } = analysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-100 mt-8"
    >
      <div className="bg-linear-to-r from-indigo-600 to-blue-700 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Radar size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Target size={24} className="text-indigo-200" />
            <h2 className="text-xl sm:text-2xl font-bold">Skill Gap Analysis</h2>
          </div>
          <p className="text-indigo-100 text-sm sm:text-base max-w-2xl">
            A comprehensive breakdown of demonstrated competencies versus expected role requirements.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Skill Bars */}
        <div>
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-500" />
                Demonstrated Skills Profile
            </h3>
            <div className="space-y-5">
                {skills.map((s, i) => (
                    <div key={i}>
                        <div className="flex justify-between mb-1.5 text-sm font-medium">
                            <span className="text-gray-700">{s.skill}</span>
                            <span className={s.score >= 80 ? "text-emerald-600" : s.score >= 60 ? "text-orange-500" : "text-red-500"}>
                                {s.score}%
                            </span>
                        </div>
                        <div className="bg-gray-100 h-2.5 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${s.score}%` }}
                                transition={{ duration: 1, delay: i * 0.1 }}
                                className={`h-full rounded-full ${s.score >= 80 ? 'bg-emerald-500' : s.score >= 60 ? 'bg-orange-400' : 'bg-red-400'}`}
                            ></motion.div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Right Column: Gaps and Strengths */}
        <div className="space-y-6">
            
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Critical Gaps to Address
                </h3>
                {criticalGaps && criticalGaps.length > 0 ? (
                    <ul className="space-y-2">
                        {criticalGaps.map((gap, i) => (
                            <li key={i} className="flex items-start gap-2 text-red-700 text-sm leading-relaxed">
                                <span className="text-red-400 mt-0.5">•</span>
                                {gap}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-red-600 italic">No major critical gaps identified.</p>
                )}
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Key Strengths
                </h3>
                {strengths && strengths.length > 0 ? (
                    <ul className="space-y-2">
                        {strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2 text-emerald-700 text-sm leading-relaxed">
                                <span className="text-emerald-500 mt-0.5">✓</span>
                                {strength}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-emerald-600 italic">Strengths list unavailable.</p>
                )}
            </div>

        </div>

      </div>
    </motion.div>
  );
}

export default SkillGapAnalysis;
