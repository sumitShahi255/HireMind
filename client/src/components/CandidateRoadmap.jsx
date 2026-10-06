import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import { motion } from 'motion/react';
import { Map, AlertCircle, CalendarDays, CheckCircle2, Route } from 'lucide-react';

function CandidateRoadmap({ interviewId }) {
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoadmap = async () => {
      try {
        const result = await axios.get(`${ServerUrl}/api/evaluation/roadmap/${interviewId}?t=${Date.now()}`, { withCredentials: true });
        setRoadmapData(result.data.roadmap);
      } catch (err) {
        console.error("Failed to fetch candidate roadmap:", err);
        setError("Could not generate the personalized roadmap. The interview might not be completed or the data is missing.");
      } finally {
        setLoading(false);
      }
    };
    if (interviewId) {
        fetchRoadmap();
    }
  }, [interviewId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 animate-pulse text-center">
        <div className="flex justify-center mb-4">
            <Map className="text-gray-300 w-12 h-12 animate-pulse" />
        </div>
        <p className="text-gray-500">Generating Personalized 30-Day Roadmap...</p>
      </div>
    );
  }

  if (error || !roadmapData) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 text-center border border-red-100">
        <AlertCircle className="text-red-400 w-10 h-10 mx-auto mb-3" />
        <p className="text-red-500">{error || "Failed to load candidate roadmap."}</p>
      </div>
    );
  }

  const { roadmapTitle, weeks, encouragementMessage } = roadmapData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-100 mt-8"
    >
      <div className="bg-linear-to-r from-amber-500 to-orange-600 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Route size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Map size={24} className="text-amber-200" />
            <h2 className="text-xl sm:text-2xl font-bold">Personalized Improvement Roadmap</h2>
          </div>
          <p className="text-amber-100 text-sm sm:text-base max-w-2xl font-medium">
            {roadmapTitle}
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 mb-8">
            <p className="text-orange-900 leading-relaxed font-medium italic">"{encouragementMessage}"</p>
        </div>

        <div className="relative border-l-2 border-orange-200 ml-3 md:ml-6 space-y-8 pb-4">
            {weeks && weeks.map((weekData, index) => (
                <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className="relative pl-8 md:pl-10"
                >
                    {/* Timeline Node */}
                    <div className="absolute -left-[17px] top-1 bg-white border-4 border-orange-400 w-8 h-8 rounded-full flex items-center justify-center">
                        <CalendarDays size={14} className="text-orange-500" />
                    </div>

                    <div className="bg-white border border-gray-100 shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 md:p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Week {weekData.week}: {weekData.focus}</h3>
                        <div className="w-12 h-1 bg-orange-400 rounded-full mb-4"></div>
                        
                        <ul className="space-y-3">
                            {weekData.tasks && weekData.tasks.map((task, i) => (
                                <li key={i} className="flex items-start gap-3 text-gray-600">
                                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span className="leading-relaxed">{task}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </motion.div>
            ))}
        </div>

      </div>
    </motion.div>
  );
}

export default CandidateRoadmap;
