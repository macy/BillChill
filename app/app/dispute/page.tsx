"use client";
import React, { useState, useCallback } from "react";
import Link from "next/link";
import BackgroundDecorations from "@/components/BackgroundDecorations";

export default function DisputePage() {
  const [isDragging, setIsDragging] = useState(false);
  // Tell TypeScript this state can hold a File object or null
  const [file, setFile] = useState<File | null>(null);

  // Drag Handler with explicit Type
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  // Drop Handler with explicit Type
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  // Manual Upload Handler with explicit Type
  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50/80 relative">
      <BackgroundDecorations />
      
      <div className="p-6 md:p-12 relative z-10">
         {/* HEADER */}
        <header className="max-w-5xl mx-auto flex justify-between items-center mb-12 md:mb-20 animate-fade-in">
          <Link href="/" className="text-3xl font-black text-teal-600 hover:scale-105 transition-transform tracking-tighter">
            BillChill<span className="text-teal-400">.</span>
          </Link>
          <Link href="/hospital" className="hidden md:flex group bg-white/80 backdrop-blur-sm text-slate-600 px-5 py-2.5 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all items-center gap-2 border border-white/50 hover:text-teal-600">
             Looking for hospital prices?
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
           <Link href="/hospital" className="md:hidden bg-white/80 backdrop-blur-sm text-teal-600 p-3 rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </Link>
        </header>

        {/* MAIN CONTENT */}
        <section className="max-w-3xl mx-auto text-center">
          <div className="mb-10 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-6 tracking-tight">
              Dispute Your Bill
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
              Don't overpay. Upload your bill and let AI find the <span className="text-red-400/80 line-through">errors</span> savings.
            </p>
          </div>

          {/* INTERACTIVE UPLOAD ZONE */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative group bg-white/80 backdrop-blur-md p-10 md:p-16 rounded-[2.5rem] 
              border-4 border-dashed transition-all duration-300 ease-out cursor-pointer
              ${isDragging ? 'border-teal-500 bg-teal-50/50 scale-105 shadow-2xl' : 'border-slate-200 shadow-xl hover:border-teal-300 hover:shadow-2xl'}
              ${file ? 'border-solid border-teal-500' : ''}
            `}
          >
            {!file ? (
               // DEFAULT STATE
              <div className="pointer-events-none">
                <div className={`w-24 h-24 mx-auto mb-8 rounded-3xl flex items-center justify-center transition-all duration-300 
                    ${isDragging ? 'bg-teal-500 text-white scale-110 rotate-12' : 'bg-teal-100 text-teal-600 group-hover:scale-110 group-hover:rotate-6'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-slate-700 mb-3">
                  {isDragging ? "Drop it like it's hot! 🔥" : "Drop your bill here"}
                </h3>
                <p className="text-slate-500 mb-8 text-lg font-medium">
                  or click to browse (PDF, JPG, PNG)
                </p>
              </div>
            ) : (
              // SUCCESS STATE
              <div className="animate-fade-in">
                <div className="w-24 h-24 mx-auto mb-8 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-200 animate-bounce-short">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Got it! Analyzing...</h3>
                {/* File name should now work without error */}
                <p className="text-slate-500 font-medium">{file.name}</p>
              </div>
            )}

            {/* Hidden real input */}
            <input 
              type="file" 
              onChange={handleManualUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              accept=".pdf,.jpg,.png" 
              disabled={file !== null}
            />
          </div>

          {/* Security Reassurance */}
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-sm font-medium animate-fade-in [animation-delay:300ms]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-teal-500">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <span>Bank-level encryption. Your data is safe with us.</span>
          </div>
        </section>
      </div>
    </main>
  );
}