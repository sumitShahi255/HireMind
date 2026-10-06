import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import { motion } from 'motion/react';
import { Sparkles, Brain, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';

function ExplainableEvaluation({ interviewId }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExplanation = async () => {
      try {
        const result = await axios.get(`${ServerUrl}/api/evaluation/explainable/${interviewId}?t=${Date.now()}`, { withCredentials: true });
        setExplanation(result.data.explanation);
      } catch (err) {
        console.error("Failed to fetch explanation:", err);
        setError("Could not generate explainable evaluation. The interview might not be completed or the data is missing.");
      } finally {
        setLoading(false);
      }
    };
    if (interviewId) {
        fetchExplanation();
    }
  }, [interviewId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 animate-pulse text-center">
        <div className="flex justify-center mb-4">
            <Brain className="text-gray-300 w-12 h-12 animate-bounce" />
        </div>
        <p className="text-gray-500">Generating Explainable Evaluation factors...</p>
      </div>
    );
  }

  if (error || !explanation) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 text-center border border-red-100">
        <AlertTriangle className="text-red-400 w-10 h-10 mx-auto mb-3" />
        <p className="text-red-500">{error || "Failed to load explanation."}</p>
      </div>
    );
  }

  const { overallScore, baseScore, factors, summary } = explanation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-100"
    >
      <div className="bg-linear-to-r from-emerald-600 to-teal-700 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Brain size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={24} className="text-emerald-200" />
            <h2 className="text-xl sm:text-2xl font-bold">Explainable AI Evaluation</h2>
          </div>
          <p className="text-emerald-100 text-sm sm:text-base max-w-2xl">
            We don't just give you a score. This is exactly <strong>why</strong> you received an overall score of {overallScore}/100.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <div className="text-center md:text-left mb-4 md:mb-0">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-1">Base Benchmark</p>
                <div className="text-3xl font-bold text-gray-700">{baseScore}</div>
                <p className="text-xs text-gray-400 mt-1">Starting point based on profile</p>
            </div>
            
            <div className="flex items-center justify-center text-gray-300">
                <div className="h-0.5 w-12 bg-gray-300 hidden md:block"></div>
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold mx-2">+</div>
                <div className="h-0.5 w-12 bg-gray-300 hidden md:block"></div>
            </div>

            <div className="text-center md:text-left mb-4 md:mb-0">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-1">Factor Adjustments</p>
                <div className="text-3xl font-bold text-emerald-600">
                    {overallScore - baseScore > 0 ? "+" : ""}{overallScore - baseScore}
                </div>
                <p className="text-xs text-gray-400 mt-1">Calculated from interview performance</p>
            </div>

            <div className="flex items-center justify-center text-gray-300">
                <div className="h-0.5 w-12 bg-gray-300 hidden md:block"></div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 mx-2">=</div>
                <div className="h-0.5 w-12 bg-gray-300 hidden md:block"></div>
            </div>

            <div className="text-center md:text-right">
                <p className="text-sm text-emerald-600 font-bold uppercase tracking-wider mb-1">Overall Score</p>
                <div className="text-4xl font-extrabold text-gray-900">{overallScore}<span className="text-lg text-gray-400">/100</span></div>
            </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 mb-6">Factor Contributions (SHAP Values)</h3>
        
        <div className="space-y-4">
          {factors.map((factor, index) => {
            const isPositive = factor.contribution >= 0;
            return (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-stretch bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`w-3 flex-shrink-0 ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                <div className="flex-grow p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-grow">
                    <h4 className="font-bold text-gray-800">{factor.factor}</h4>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{factor.rationale}</p>
                  </div>
                  <div className={`flex items-center font-bold text-lg px-4 py-2 rounded-lg whitespace-nowrap ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {isPositive ? <ArrowUpRight size={20} className="mr-1" /> : <ArrowDownRight size={20} className="mr-1" />}
                    {isPositive ? "+" : ""}{factor.contribution}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">Executive Summary</h4>
            <p className="text-blue-900 leading-relaxed">{summary}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default ExplainableEvaluation;
