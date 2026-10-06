import { Bot } from "lucide-react";


function Footer() {
  return (
    <div className='bg-linear-to-b from-white to-green-50 flex justify-center px-4 py-12'>
      <div className='w-full max-w-6xl bg-white/80 backdrop-blur-md rounded-3xl shadow-sm border 
      border-gray-100 py-10 px-6 text-center hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300'>

            <div className='flex justify-center items-center gap-3 mb-3'>
                  <div className='bg-black text-white p-2.5 rounded-xl shadow-md'>
                        <Bot size={16}/>
                  </div>

                  <h2 className='font-semibold text-lg tracking-tight'>
                        Hire<span className='text-green-600'>Mind</span>
                  </h2>  

            </div>

            <p className='text-gray-600 text-sm md:text-base max-w-2xl mx-auto leading-relaxed'>
                      AI-powered interview preparation platform that helps you improve communication, 
                      strengthen technical skills, and build real interview confidence — all in one place.
            </p>
            
      </div>
      
    </div>
  )
}

export default Footer;