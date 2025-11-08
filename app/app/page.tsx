import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-bgSoft flex flex-col items-center justify-center p-6">
      {/* HERO TEXT */}
      <div className="text-center max-w-2xl mb-12 animate-fade-in">
        <h1 className="text-5xl font-extrabold text-secondary mb-4">
          Welcome to <span className="text-primary">Remedy</span>
        </h1>
        <p className="text-xl text-slate-500">
          Medical costs are confusing. We make them simple. What do you need help with today?
        </p>
      </div>

      {/* THE TWO PATHS */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full animate-fade-in [animation-delay:200ms]">
        {/* Path 1: Find Hospital */}
        <Link href="/hospital" className="group">
          <div className="bg-white p-8 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-primary/20 h-full flex flex-col items-center text-center">
            <div className="bg-blue-100 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
              {/* Simple Search Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#0D9488" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-3">Find a Hospital</h2>
            <p className="text-slate-500">Compare prices before you go. Find the most affordable care near you.</p>
            <div className="mt-8 text-primary font-semibold group-hover:translate-x-2 transition-transform flex items-center gap-2">
              Start Search <span>→</span>
            </div>
          </div>
        </Link>

        {/* Path 2: Dispute Bill */}
        <Link href="/dispute" className="group">
          <div className="bg-white p-8 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-primary/20 h-full flex flex-col items-center text-center">
             <div className="bg-teal-100 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
              {/* Simple Upload Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#0D9488" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-3">Dispute a Bill</h2>
            <p className="text-slate-500">Already went? Upload your confusing bill and let AI find the errors.</p>
            <div className="mt-8 text-primary font-semibold group-hover:translate-x-2 transition-transform flex items-center gap-2">
              Fix My Bill <span>→</span>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}