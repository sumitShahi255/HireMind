import { useDispatch, useSelector } from 'react-redux'
import { motion } from "motion/react";
import { Sparkles, Wallet, User, History, LogOut, ShieldCheck } from "lucide-react";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios  from 'axios';
import { ServerUrl } from '../App';
import { setUserData } from '../redux/userSlice';
import AuthModel from './AuthModel';


function Navbar() {
      const {userData} = useSelector((state) => state.user)
      const [showCreditPopup,setShowCreditPopup] = useState(false)
      const [showUserPopup,setShowUserPopup] = useState(false)
      const navigate = useNavigate()
      const dispatch = useDispatch()
      const [showAuth,setShowAuth] = useState(false)

      const handleLogout = async () => {
            try {
                  await axios.get(ServerUrl + "/api/auth/logout",{withCredentials:true})
                  dispatch(setUserData(null))
                  setShowCreditPopup(false)
                  setShowUserPopup(false)
                  navigate("/", { replace: true })
            } catch (error) {
                 console.log(error) 
            }
      }
  return (
    <div className='sticky top-0 z-50 flex justify-center px-4 pt-6 pb-4'>
      <motion.div
      initial={{opacity:0,y:-40}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.3}}
      className='w-full max-w-6xl bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200 px-6 
      py-4 flex justify-between items-center relative'>
            
            <div className='flex items-center gap-3 cursor-pointer' onClick={() => navigate("/", { replace: true })}>
                  <div className='bg-linear-to-r from-black to-gray-700 text-white p-2 rounded-xl shadow-md'>
                       <Sparkles size={20} />
                  </div>
                  <h1 className='font-bold hidden md:block text-xl tracking-wide'>
                  Hire<span className='text-gray-500'>Mind</span>
                  </h1>
            </div>

            <div className='flex items-center gap-6 relative'>
                  <div className='relative'>
                        <button onClick={() => {
                               if(!userData){
                              setShowAuth(true)
                              return;
                          }
                              setShowCreditPopup(!showCreditPopup);
                              setShowUserPopup(false);
                        }}
                        className='flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-sm 
                        font-medium hover:bg-gray-200 transition shadow-sm'>
                              <Wallet size={18} />
                              {userData?.credits || 0}
                        </button>

                        {showCreditPopup && (
                              <div className='absolute -right-12.5 mt-3 w-64 bg-white shadow-xl border border-gray-200 rounded-xl p-5 z-50'>
                                    <p className='text-sm text-gray-600 mb-4'> Upgrade your credits to unlock more AI interviews</p>
                                    <button onClick={() => navigate("/pricing")}
                                          className='w-full bg-black hover:bg-gray-800 text-white py-2 rounded-lg text-sm transition'>
                                          Upgrade Plan
                                    </button>
                              </div>
                        )}

                  </div>

                  <div className='relative'>
                        <button
                        onClick={() => {
                              if(!userData){
                              setShowAuth(true)
                              return;
                              }
                              setShowUserPopup(!showUserPopup);
                              setShowCreditPopup(false);
                        }}
                         className='w-10 h-10 bg-linear-to-r from-black to-gray-700 text-white rounded-full flex items-center 
                         justify-center font-semibold shadow-md hover:scale-105 transition'>
                              {userData?.name?.[0]?.toUpperCase() || <User size={18}/>}
                        </button>

                        {showUserPopup && (
                              <div className='absolute right-0 mt-3 w-48 bg-white shadow-xl border 
                              border-gray-200 rounded-xl p-4 z-50'>
                                    <p className='text-md text-gray-800 font-semibold mb-3'>{userData?.name || "Guest"}</p>

                                    <button  onClick={() => navigate("/history")} 
                                    className='w-full text-left text-sm py-2 flex items-center gap-2 hover:text-blue-500 transition'>
                                          <History size={18} />
                                          Interview History
                                    </button>

                                    <button  onClick={() => navigate("/assessment-report")} 
                                    className='w-full text-left text-sm py-2 flex items-center gap-2 hover:text-indigo-500 transition'>
                                          <ShieldCheck size={18} />
                                          Assessment Report
                                    </button>

                                    <button onClick={handleLogout} 
                                    className='w-full text-left text-sm py-2 flex items-center gap-2 text-red-500'>
                                          <LogOut size={18} />
                                    Sign Out</button>
                              </div>
                        )}
                  </div>

            </div>

      </motion.div>

      {showAuth && <AuthModel onClose = {() => setShowAuth(false)}/>}
    </div>
  )
}

export default Navbar


