import Link from "next/link";

export default function HospitalPage() {
  return (
    <main className="min-h-screen bg-bgSoft p-6 md:p-12">
      {/* HEADER & NAV SWITCHER */}
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-12">
        <Link href="/" className="text-2xl font-extrabold text-primary">Remedy.</Link>
        <Link href="/dispute" className="bg-white text-secondary px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:text-primary">
           Need to dispute a bill instead? →
        </Link>
      </header>

      {/* MAIN CONTENT CARD */}
      <section className="max-w-3xl mx-auto animate-fade-in">
         <div className="text-center mb-10">
             <h1 className="text-4xl font-bold text-secondary mb-4">Find Nearby Care</h1>
             <p className="text-xl text-slate-500">See standard prices before you walk in the door.</p>
         </div>

         {/* SEARCH BAR (Big and friendly) */}
         <div className="bg-white p-4 rounded-2xl shadow-lg flex gap-2 border-2 border-transparent focus-within:border-primary transition-all">
             <span className="flex items-center pl-4 text-slate-400">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
             </span>
             <input
                type="text"
                placeholder="Enter zip code or procedure (e.g., 'MRI')"
                className="flex-1 p-4 text-lg outline-none text-secondary placeholder:text-slate-300"
             />
             <button className="bg-secondary text-white px-8 rounded-xl font-bold hover:bg-slate-800 transition-colors">
                 Search
             </button>
         </div>
      </section>
    </main>
  );
}