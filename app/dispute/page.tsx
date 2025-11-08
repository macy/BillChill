"use client";
import React, { useState, useCallback } from "react";
import Link from "next/link";
import BackgroundDecorations from "@/components/BackgroundDecorations";

export default function DisputePage() {
  const [isDragging, setIsDragging] = useState(false);
  // Tell TypeScript this state can hold a File object or null
  const [file, setFile] = useState<File | null>(null);
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<string>("United");
  const [patientName, setPatientName] = useState<string>("John Doe");
  const [householdSize, setHouseholdSize] = useState<string>("1");
  const [annualIncome, setAnnualIncome] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [aiResult, setAiResult] = useState<string>("");
  const [disputeLetter, setDisputeLetter] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [parsedState, setParsedState] = useState<string>("");
  const [parsedDiscount, setParsedDiscount] = useState<string>("");
  const [discountExplanation, setDiscountExplanation] = useState<string>("");
  const [overchargeSection, setOverchargeSection] = useState<string>("");

  // Structured AI response shape from backend
  type OverchargeItem = {
    line_number?: string | number | null;
    service?: string | null;
    amount?: number | null;
    reason?: string | null;
  };
  type AiStructured = {
    state_abbr?: string | null;
    total_eligible_discount_percent?: number | null;
    discount_explanation?: string | null;
    overcharges?: OverchargeItem[] | null;
  };

  // NEW STATE for pretty overcharge rendering
  const [overcharges, setOvercharges] = useState<OverchargeItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Toggle expand/collapse for a pill
  const toggleRow = (i: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Money formatter used in several places
  const formatMoney = (n: number | null | undefined) =>
    typeof n === "number" && !isNaN(n)
      ? `$${n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "(n/a)";

  const PROVIDERS = ["United", "Providence", "Molina", "CMS"] as const;
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000"; // unified Flask backend

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
  };

  const handleRulesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRulesFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setAiResult("");
    setDisputeLetter("");
    setParsedState("");
    setParsedDiscount("");
    if (!file) {
      setError("Please upload your bill as a PDF.");
      return;
    }

    const form = new FormData();
    form.append("provider", provider);
    form.append("patient_name", patientName || "John Doe");
    form.append("bill_pdf", file);
    if (rulesFile) form.append("rules_pdf", rulesFile);
    // New optional patient context for enhanced analysis
    form.append("household_size", householdSize || "1");
    form.append("annual_income", annualIncome || "0");
    form.append("zip_code", zipCode || "");

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dispute/analyze`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }
      // Always keep legacy text for compatibility and for users copying full output
      const full: string = data.ai_result || "";
      setAiResult(full);
      setDisputeLetter(data.dispute_letter || "");

      // Prefer structured JSON when available
      const s: AiStructured | undefined = data.ai_structured;
      if (s) {
        setParsedState((s.state_abbr || "").toString());
        const pct = s.total_eligible_discount_percent;
        setParsedDiscount(
          typeof pct === "number" && !isNaN(pct) ? `${Math.round(pct)}%` : ""
        );
        setDiscountExplanation(s.discount_explanation || "");

        const items = Array.isArray(s.overcharges) ? s.overcharges : [];

        // STORE the structured items for pretty UI; also keep a text fallback for the clipboard / legacy
        if (items.length > 0) {
          setOvercharges(items);

          const lines = items.map((oc) => {
            const ln = oc.line_number ?? "—";
            const svc = oc.service || "Charge";
            const amt = formatMoney(oc.amount ?? null);
            const reason = oc.reason || "";
            return `- Line ${ln}: ${svc} ${amt} | Reason: ${reason}`;
          });
          setOverchargeSection(lines.join("\n"));
        } else {
          setOvercharges([]);
          setOverchargeSection("No overcharges detected");
        }
      } else {
        // Fallback: parse the legacy string
        const parsed = parseAiResult(full || "");
        setParsedState(parsed.stateAbbr || "");
        setParsedDiscount(parsed.totalDiscount || "");
        setDiscountExplanation(parsed.discountExplanation || "");
        setOverchargeSection(parsed.overchargesText || full);

        // Try to extract minimal items from legacy text lines like "- Line 12: Title $123.45 | Reason: ..."
        const legacyItems: OverchargeItem[] = (parsed.overchargesText || full)
          .split(/\n+/)
          .map((line) => {
            const m = line.match(/Line\s+(\d+)\s*:\s*(.+?)\s+(\$[0-9,]+(?:\.[0-9]{2})?)\s*\|\s*Reason:\s*(.*)$/i);
            if (!m) return null;
            const [, lineNo, title, amt, reason] = m;
            const cleanAmt = Number((amt || "").replace(/[^0-9.]/g, ""));
            return {
              line_number: Number(lineNo),
              service: title.trim(),
              amount: isNaN(cleanAmt) ? null : cleanAmt,
              reason: (reason || "").trim(),
            };
          })
          .filter(Boolean) as OverchargeItem[];

        setOvercharges(legacyItems);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLetter = useCallback(() => {
    if (!disputeLetter) return;
    navigator.clipboard.writeText(disputeLetter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [disputeLetter]);

  const handleDownloadLetter = useCallback(() => {
    if (!disputeLetter) return;
    const blob = new Blob([disputeLetter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispute_letter_${patientName.replace(/\s+/g, '_') || 'patient'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [disputeLetter, patientName]);

  // Parse AI result for State and Total Eligible Discount lines.
  function parseAiResult(
    text: string
  ): { stateAbbr?: string; totalDiscount?: string; discountExplanation?: string; overchargesText?: string } {
    if (!text) return {};
    // Try to capture patterns like 'State: CA' and 'Total Eligible Discount: 45%'
    const stateMatch = text.match(/(?:^|\n)\s*-?\s*State:\s*([A-Z]{2})/i);
    const discountMatch = text.match(/(?:^|\n)\s*-?\s*Total Eligible Discount:\s*([0-9]+%)/i);
    // Overcharges block up to the next header (State or Total Eligible Discount)
    const overBlock = text.match(/Overcharges:\s*([\s\S]*?)(?:\n\s*-?\s*State\s*:|\n\s*-?\s*Total Eligible Discount\s*:|$)/i);
    const overchargesText = overBlock ? overBlock[1].trim() : "";
    // Anything after the Total Eligible Discount line is considered explanation
    const explMatch = text.match(/Total Eligible Discount\s*:\s*[^\n\r]*[\r\n]+([\s\S]*)/i);
    const discountExplanation = explMatch ? explMatch[1].trim() : "";
    return {
      stateAbbr: stateMatch ? stateMatch[1] : undefined,
      totalDiscount: discountMatch ? discountMatch[1] : undefined,
      discountExplanation: discountExplanation || undefined,
      overchargesText: overchargesText || undefined,
    };
  }

  // Render the dispute letter as paragraphs, splitting on blank lines
  const renderFormattedLetter = () => {
    if (!disputeLetter) return null;
    return disputeLetter
      .split(/\n{2,}/)
      .map((para, i) => (
        <p key={i} className="mb-3 whitespace-pre-line">
          {para.trim()}
        </p>
      ));
  };
  
  // Pretty pill row for each overcharge item
  function OverchargePill({
    idx,
    item,
    expanded,
    onToggle,
  }: {
    idx: number;
    item: OverchargeItem;
    expanded: boolean;
    onToggle: (i: number) => void;
  }) {
    const ln = item.line_number ?? "—";
    const title = item.service || "Charge";
    const price = formatMoney(item.amount ?? null);

    return (
      <div className="rounded-2xl bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-100 shadow-sm">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onToggle(idx)}
          className="w-full text-left px-4 py-3 md:px-5 md:py-4 flex items-center justify-between gap-3 hover:bg-white/60 transition"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 border border-teal-100 text-teal-700 text-xs font-semibold">
              Line {String(ln)}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 border border-sky-100 text-sky-700 text-xs font-semibold">
              {title}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 border border-emerald-100 text-emerald-700 text-xs font-semibold">
              {price}
            </span>
          </div>

          <svg
            className={`w-5 h-5 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && item.reason && (
          <div className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
            <div className="rounded-xl bg-white/80 border border-slate-100 p-3 text-sm text-slate-700">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Reason</span>
              <p className="whitespace-pre-wrap leading-relaxed">{item.reason}</p>
            </div>
          </div>
        )}
      </div>
    );
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
                  or click to browse (PDF only)
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
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Got it!</h3>
                {/* File name should now work without error */}
                <p className="text-slate-500 font-medium">{file.name}</p>
              </div>
            )}

            {/* Hidden real input */}
            <input 
              type="file" 
              onChange={handleManualUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              accept=".pdf" 
              disabled={file !== null}
            />
          </div>

          {/* Provider, patient, optional rules */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left animate-fade-in [animation-delay:150ms]">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Patient name</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Optional rules PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleRulesUpload}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm"
              />
              {rulesFile && (
                <p className="mt-1 text-xs text-slate-500">{rulesFile.name}</p>
              )}
            </div>
          </div>

          {/* Patient financial context for discount eligibility */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-left animate-fade-in [animation-delay:200ms]">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Household size</label>
              <input
                type="number"
                min={1}
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Annual income (USD)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={annualIncome}
                onChange={(e) => setAnnualIncome(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">ZIP code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}(-[0-9]{4})?"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="94103"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="group inline-flex items-center gap-2 rounded-full bg-teal-600 text-white font-bold px-6 py-3 shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse"></span>
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze with AI
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </>
              )}
            </button>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setRulesFile(null);
                  setAiResult("");
                  setDisputeLetter("");
                  setError("");
                  setParsedDiscount("");
                  setParsedState("");
                  setDiscountExplanation("");
                  setOverchargeSection("");
                  setOvercharges([]);           // NEW
                  setExpandedIds(new Set());    // NEW
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white text-slate-600 border border-slate-200 font-bold px-6 py-3 shadow-sm hover:shadow"
              >
                Reset
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 text-red-600 font-semibold">{error}</div>
          )}

          {/* Results */}
          {(aiResult || disputeLetter) && (
            <div className="mt-10 space-y-8 text-left animate-fade-in [animation-delay:300ms]">
              {/* Summary stats if parsed */}
              {(parsedState || parsedDiscount || discountExplanation) && (
                <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow border border-slate-100/60 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-sm font-bold">%</span>
                    Discount Eligibility
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 uppercase text-sm font-semibold tracking-wide">State</div>
                      <div className="text-slate-800 font-medium">{parsedState || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-sm font-semibold tracking-wide">Total Eligible Discount</div>
                      <div className="text-slate-800 font-medium">{parsedDiscount || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-sm font-semibold tracking-wide">Household / Income</div>
                      <div className="text-slate-800 font-medium">{householdSize} / {annualIncome ? `$${Number(annualIncome).toLocaleString()}` : '—'}</div>
                    </div>
                  </div>
                  {discountExplanation && (
                    <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap border-t border-slate-200 pt-3">
                      {discountExplanation}
                    </div>
                  )}
                </div>
              )}
              {/* Findings Panel */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 md:p-7 shadow-lg border border-slate-100/60">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="text-2xl md:text-xl font-bold text-slate-800 tracking-tight">
                    Overcharge Findings
                  </h3>
                  {(overchargeSection || aiResult) && (
                    <button
                      onClick={() => navigator.clipboard.writeText(overchargeSection || aiResult)}
                      className="group inline-flex items-center gap-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1.5 shadow-sm border border-teal-200 transition"
                      title="Copy findings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15V5a2 2 0 012-2h10" />
                      </svg>
                      <span>Copy</span>
                    </button>
                  )}
                </div>

                {/* NEW pretty pill layout with fallback */}
                {overcharges && overcharges.length > 0 ? (
                  <div className="space-y-3">
                    {overcharges.map((item, i) => (
                      <OverchargePill
                        key={`${item.line_number ?? "x"}-${i}`}
                        idx={i}
                        item={item}
                        expanded={expandedIds.has(i)}
                        onToggle={toggleRow}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {overchargeSection || aiResult || <span className="italic text-slate-400">No findings returned.</span>}
                  </div>
                )}
              </div>
              {/* Dispute Letter Panel */}
              {disputeLetter && (
                <div className="bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-md rounded-[2.25rem] p-6 md:p-8 shadow-xl border border-slate-100/60 relative">
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <h3 className="text-xl font-bold text-slate-800 tracking-tight">Draft Dispute Letter</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleCopyLetter}
                          className="group inline-flex items-center gap-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 text-s font-semibold px-3 py-1.5 shadow-sm border border-teal-200 transition"
                          title="Copy letter"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15V5a2 2 0 012-2h10" />
                          </svg>
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={handleDownloadLetter}
                          className="group inline-flex items-center gap-1.5 rounded-full bg-teal-600 text-white text-xs font-semibold px-4 py-2 shadow hover:bg-teal-500 hover:shadow-md active:scale-[.97] transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5M12 4v11m8 5H4" />
                          </svg>
                          Download
                        </button>
                        {copied && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold px-3 py-1 shadow-sm">
                            Copied!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {renderFormattedLetter()}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500 font-medium flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-teal-600">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9V5h2v4H9zm0 2h2v4H9v-4z" clipRule="evenodd" />
                      </svg>
                      This draft is generated by AI. Review and personalize before sending.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
