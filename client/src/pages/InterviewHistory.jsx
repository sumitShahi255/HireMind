import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerUrl } from '../App';
import { ArrowLeft, Brain, Code } from 'lucide-react';

function InterviewHistory() {
      const [interviews, setInterviews] = useState([]);
      const [codingInterviews, setCodingInterviews] = useState([]);
      const [activeTab, setActiveTab] = useState("mock");
      const navigate = useNavigate();

      useEffect(() => {
            const getMyInterviews = async() => {
                  try {
                       const result = await axios.get(ServerUrl + "/api/dynamic-interview/get-interview",{withCredentials:true});
                       setInterviews(result.data);
                  } catch (error) {
                       console.log(error);  
                  }
            };

            const getMyCodingInterviews = async() => {
                  try {
                       const result = await axios.get(ServerUrl + "/api/coding-interview/history",{withCredentials:true});
                       setCodingInterviews(result.data);
                  } catch (error) {
                       console.log(error);  
                  }
            };

            getMyInterviews();
            getMyCodingInterviews();
      }, []);

  return (
    <div className='min-h-screen bg-linear-to-br from-gray-50 to to-emerald-50 py-10'>
      <div className='w-[90vw] lg:w-[70vw] max-w-[90%] mx-auto'>

            <div className='mb-8 w-full flex items-center gap-4 flex-wrap'>
                  <button
                  onClick={()=> navigate(-1)} 
                  className='mt-1 p-3 rounded-full bg-white shadow 
                  hover:shadow-md transition'><ArrowLeft size={18} className='text-gray-600'/></button>

                  <div>
                        <h1 className='text-3xl font-bold flex-nowrap text-gray-800'>Interview History</h1>
                        <p className='text-gray-500 mt-2'>Track your past interviews and performance reports</p>
                  </div>
            </div>

            <div className="flex gap-4 border-b border-gray-200 mb-8">
                  <button
                        onClick={() => setActiveTab("mock")}
                        className={`flex items-center gap-2 pb-3.5 text-sm font-bold tracking-wider uppercase border-b-2 transition ${
                              activeTab === "mock"
                                    ? "border-emerald-600 text-emerald-700"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                  >
                        <Brain size={16} />
                        Mock Interviews
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              activeTab === "mock" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                        }`}>
                              {interviews.length}
                        </span>
                  </button>
                  <button
                        onClick={() => setActiveTab("coding")}
                        className={`flex items-center gap-2 pb-3.5 text-sm font-bold tracking-wider uppercase border-b-2 transition ${
                              activeTab === "coding"
                                    ? "border-emerald-600 text-emerald-700"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                  >
                        <Code size={16} />
                        Coding Interviews
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              activeTab === "coding" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                        }`}>
                              {codingInterviews.length}
                        </span>
                  </button>
            </div>

            {activeTab === "mock" ? (
                  interviews.length === 0 ? (
                        <div className='bg-white p-10 shadow rounded-2xl text-center'>
                              <p className='text-gray-500'>No interviews found. Start your first mock interview.</p>
                        </div>
                  ) : (
                        <div className='grid gap-3'>
                              {interviews.map((item, index) => (
                                    <div key={index}
                                    onClick={()=> navigate(`/report/${item._id}`)} 
                                    className='bg-white p-6 rounded-2xl shadow-md hover:shadow-xl 
                                    transition-all duration-300 cursor-pointer border border-gray-100'>
                                          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                                                <div>
                                                   <h3 className='text-lg font-semibold text-gray-800'>{item.role}</h3>
                                                   <p className='text-gray-500 text-sm mt-1'>{item.experience} • {item.mode}</p>  
                                                   <p className='text-xs text-gray-400 mt-2'>
                                                      {new Date(item.createdAt).toLocaleDateString()}
                                                    </p> 
                                                </div>

                                                <div className='flex items-center gap-6'>
                                                      <div className='text-right'>
                                                            <p className='text-xl font-bold text-emerald-600'>
                                                                  {item.finalScore || 0}/10
                                                            </p>
                                                            <p className='text-xs text-gray-400'>
                                                                  Overall Score
                                                            </p>
                                                      </div>

                                                      <span
                                                      className={`px-4 py-1 rounded-full text-xs font-medium uppercase tracking-wider
                                                            ${item.status === "completed"
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                            }`}>
                                                            {item.status}
                                                      </span>
                                                </div>
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )
            ) : (
                  codingInterviews.length === 0 ? (
                        <div className='bg-white p-10 shadow rounded-2xl text-center'>
                              <p className='text-gray-500'>No coding assessments found. Start your first coding round.</p>
                        </div>
                  ) : (
                        <div className='grid gap-3'>
                              {codingInterviews.map((item, index) => (
                                    <div key={index}
                                    onClick={()=> navigate(`/coding-interview/report/${item._id}`)} 
                                    className='bg-white p-6 rounded-2xl shadow-md hover:shadow-xl 
                                    transition-all duration-300 cursor-pointer border border-gray-100'>
                                          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                                                <div>
                                                   <h3 className='text-lg font-semibold text-gray-800'>{item.company} Coding Assessment</h3>
                                                   <p className='text-gray-500 text-sm mt-1'>{item.language} • {item.difficulty} Difficulty</p>  
                                                   <p className='text-xs text-gray-400 mt-2'>
                                                      {new Date(item.createdAt).toLocaleDateString()}
                                                    </p> 
                                                </div>

                                                <div className='flex items-center gap-6'>
                                                      <div className='text-right'>
                                                            <p className='text-xl font-bold text-emerald-600 font-mono'>
                                                                  {item.score || 0}%
                                                            </p>
                                                            <p className='text-xs text-gray-400'>
                                                                  AI Score
                                                            </p>
                                                      </div>

                                                      <span
                                                      className={`px-4 py-1 rounded-full text-xs font-medium uppercase tracking-wider
                                                            ${item.status === "completed"
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                            }`}>
                                                            {item.status}
                                                      </span>
                                                </div>
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )
            )}

      </div>
    </div>
  )
}

export default InterviewHistory;