// app/hospital/page.js
"use client";
import Link from "next/link";
import { useState } from "react";
import BackgroundDecorations from "@/components/BackgroundDecorations"; // Adjust path as needed

export default function HospitalPage() {
  const [isSearching, setIsSearching] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50/80 relative">
      <BackgroundDecorations />
      
      <div className="p-6 md:p-12 relative z-10">
        {/* HEADER */}
        <header className="max-w-5xl mx-auto flex justify-between items-center mb-12 md:mb-20 animate-fade-in">
          <Link href="/" className="text-3xl font-black text-teal-600 hover:scale-105 transition-transform tracking-tighter">
            BillChill<span className="text-teal-400">.</span>
          </Link>
           {/* Desktop Switcher */}
          <Link href="/dispute" className="hidden md:flex group bg-white/80 backdrop-blur-sm text-slate-600 px-5 py-2.5 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all items-center gap-2 border border-white/50 hover:text-teal-600">
            Need to dispute a bill instead? 
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          {/* Mobile Switcher Icon */}
          <Link href="/dispute" className="md:hidden bg-white/80 backdrop-blur-sm text-teal-600 p-3 rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </Link>
        </header>

        {/* MAIN CONTENT */}
        <section className="max-w-3xl mx-auto">
          <div className="text-center mb-10 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-6 tracking-tight">
              Find Nearby Care
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
              Stop guessing. See standard prices <span className="text-teal-600 font-bold relative inline-block">before<svg className="absolute -bottom-1 left-0 w-full text-teal-200/50 -z-10" viewBox="0 0 100 15" xmlns="http://www.w3.org/2000/svg"><path d="M0 10 Q 25 0, 50 10 T 100 10" stroke="currentColor" strokeWidth="8" fill="none"/></svg></span> you walk in the door.
            </p>
          </div>

          {/* DYNAMIC SEARCH BAR */}
          <div 
            className={`
              bg-white p-2 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center 
              border-2 transition-all duration-300 mb-16 animate-fade-in [animation-delay:100ms]
              ${isSearching ? 'border-teal-400 shadow-[0_8px_30px_rgb(20,184,166,0.2)] scale-[1.02]' : 'border-transparent'}
            `}
          >
            <span className={`pl-6 transition-colors duration-300 ${isSearching ? 'text-teal-500' : 'text-slate-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Try 'MRI', 'X-Ray' or 'Checkup'..."
              onFocus={() => setIsSearching(true)}
              onBlur={() => setIsSearching(false)}
              className="w-full p-4 bg-transparent text-xl outline-none text-slate-800 placeholder:text-slate-300 font-bold"
            />
            <button className="hidden sm:block bg-teal-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-teal-500 transition-all hover:scale-105 active:scale-95">
              Search
            </button>
             <button className="sm:hidden bg-teal-600 text-white p-4 rounded-full font-bold transition-all active:scale-90 mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          {/* FLOATING POPULAR SEARCHES */}
          <div className="animate-fade-in [animation-delay:200ms]">
            <p className="text-center text-sm uppercase tracking-widest text-slate-400 mb-6 font-bold">
              Popular right now
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {['🦴 X-Ray', '🧠 MRI Scan', '🩸 Blood Test', '🚑 Emergency', '🦷 Dental Cleaning'].map((tag, i) => (
                <button 
                  key={tag}
                  // Inline style for staggered floating animation
                  style={{ animationDelay: `${i * 0.1}s` }} 
                  className="animate-float px-6 py-3 bg-white rounded-2xl text-slate-700 font-bold border-2 border-slate-100/50 shadow-sm 
                             hover:border-teal-400 hover:text-teal-600 hover:shadow-md hover:-translate-y-1 hover:rotate-1
                             active:scale-95 transition-all duration-200"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}