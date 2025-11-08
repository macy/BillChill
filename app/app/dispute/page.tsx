"use client";
import Link from "next/link";
import { useState } from "react";

export default function DisputePage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen bg-bgSoft p-6 md:p-12">
      {/* HEADER & NAV SWITCHER */}
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-12">
        <Link href="/" className="text-2xl font-extrabold text-primary">Remedy.</Link>
        <Link href="/hospital" className="bg-white text-secondary px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:text-primary">
           Looking for a hospital instead? →
        </Link>
      </header>

      {/* MAIN CONTENT CARD */}
      <section className="max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center">
           <h1 className="text-3xl font-bold text-secondary mb-2">Dispute Your Bill</h1>
           <p className="text-slate-500 mb-8">Upload a photo or PDF of your itemized hospital bill.</p>

           {/* UPLOAD ZONE (Styled friendly) */}
           <label className="block w-full border-3 border-dashed border-slate-200 rounded-2xl p-12 cursor-pointer hover:border-primary hover:bg-teal-50/50 transition-all group">
                <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                />
                <div className="flex flex-col items-center">
                    <div className="bg-teal-100 p-4 rounded-full text-primary mb-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>
                    <p className="text-lg font-semibold text-secondary group-hover:text-primary">
                        {file ? file.name : "Click to choose file"}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">PDF, JPG, or PNG</p>
                </div>
           </label>

           {file && (
               <button className="w-full mt-6 bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-teal-600/20">
                   Analyze Bill Now
               </button>
           )}
        </div>
      </section>
    </main>
  );
}