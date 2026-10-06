import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Auth from './pages/Auth';
import { useEffect } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { setUserData } from './redux/userSlice';
import InterviewPage from './pages/InterviewPage';
import InterviewHistory from './pages/InterviewHistory';
import Pricing from './pages/Pricing';
import InterviewReport from './pages/InterviewReport';
import CompanySelection from './pages/coding-interview/CompanySelection';
import CodingInterview from './pages/coding-interview/CodingInterview';
import CodingResult from './pages/coding-interview/CodingResult';
import AssessmentReport from './pages/AssessmentReport';


export const ServerUrl = "http://localhost:8000"

function App() {

  const dispatch = useDispatch()
  useEffect(() => {
    const getUser = async () =>{
      try {
        const result = await axios.get(ServerUrl + "/api/user/current-user",{withCredentials:true})
        dispatch(setUserData(result.data))
      } catch (error) {
        console.log(error)
        dispatch(setUserData(null))
      }
    }
    getUser()
  },[dispatch])
  return (
    <Routes>
      <Route path='/' element={<Home/>} />
      <Route path='/auth' element={<Auth/>} />
      <Route path='/interview' element={<InterviewPage/>} />
      <Route path='/history' element={<InterviewHistory/>} />
      <Route path='/pricing' element={<Pricing/>} />
      <Route path='/report/:id' element={<InterviewReport/>} />
      <Route path='/coding-interview' element={<CompanySelection />} />
      <Route path='/coding-interview/:id' element={<CodingInterview />} />
      <Route path='/coding-interview/report/:id' element={<CodingResult />} />
      <Route path='/assessment-report' element={<AssessmentReport/>} />

    </Routes>
  )
}

export default App;