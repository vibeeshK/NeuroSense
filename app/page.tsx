'use client';

import React, { useMemo, useRef, useState } from 'react';

type Phase = 'idle' | 'uploading' | 'generating' | 'ready' | 'error';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [reportType, setReportType] = useState('cyp_adhd'); // default to ADHD template
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<string>('Waiting for your document…');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>('CYP_ADHD_Report.docx');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const canGenerate = useMemo(
    () => !!file && phase !== 'uploading' && phase !== 'generating',
    [file, phase]
  );

  function resetAll() {
    setFile(null);
    setNotes('');
    setReportType('cyp_adhd');
    setPhase('idle');
    setStatus('Waiting for your document…');
    setErrorMsg(null);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadName('CYP_ADHD_Report.docx');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    try {
      setErrorMsg(null);
      setPhase('uploading');
      setStatus('Uploading document to Gemini…');
      setDownloadUrl(null);

      const form = new FormData();
      form.append('file', file);
      if (notes.trim()) form.append('notes', notes.trim());
      // Future-ready: include chosen template (backend can read later)
      form.append('template', reportType);

      setPhase('generating');
      setStatus('Analysing with Gemini + generating your report…');

      const res = await fetch('/api/generate', { method: 'POST', body: form });

      if (!res.ok) {
        const t = await safeText(res);
        setPhase('error');
        setErrorMsg(parseErrorMsg(t));
        setStatus('Generation failed');
        return;
      }

      const cd = res.headers.get('Content-Disposition') || '';
      const extracted = /filename="?([^"]+)"?/i.exec(cd)?.[1];
      if (extracted) setDownloadName(extracted);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setPhase('ready');
      setStatus('Report ready to download');
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(String(err?.message || err || 'Unknown error'));
      setStatus('Something went wrong');
    }
  }

  // Drag & drop handlers
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setPhase('idle');
      setStatus('File ready. Click Generate.');
      setErrorMsg(null);
      setDownloadUrl(null);
    }
  };
  const onDragOver: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <main className="relative min-h-screen text-slate-900 bg-[linear-gradient(to_bottom,#F6F8FF,#F3F7FF_55%,#ECF3FF)]">
      {/* faint page bloom so the orb reads well */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full
                        bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.10),rgba(56,189,248,0.06),transparent_70%)]" />
      </div>

      {/* rounded container */}
      <div className="max-w-3xl mx-auto p-6 sm:p-8">
        {/* ======= HERO (updated heading area) ======= */}
        <header className="mb-8 text-center">
          {/* orb + halo */}
          <div className="mx-auto mb-5 relative h-12 w-12 select-none">
            {/* soft halo so it doesn't merge into bg */}
            <span
              aria-hidden
              className="absolute -inset-3 rounded-full
                         bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18),rgba(56,189,248,0.10),transparent_70%)]"
            />
            {/* rotating conic ring */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full
                         bg-[conic-gradient(from_0deg,rgba(139,92,246,.25),rgba(56,189,248,.25),transparent_60%,rgba(139,92,246,.25))]
                         animate-spin"
              style={{ animationDuration: '7s' }}
            />
            {/* inner glow + subtle ring */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-sky-400
                         shadow-[0_0_30px_10px_rgba(139,92,246,0.35)] ring-1 ring-white/60"
            />
            {/* glass highlight */}
            <span aria-hidden className="absolute inset-0 rounded-full bg-white/15 backdrop-blur-[2px]" />
            {/* gentle pulse */}
            <span aria-hidden className="absolute inset-0 rounded-full animate-ping bg-violet-400/30" style={{ animationDuration: '1.4s' }} />
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Ready when you are!
          </h1>

          <div className="mt-2 text-lg sm:text-xl">
            <span className="bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-500 bg-clip-text font-semibold text-transparent">
              NeuroSense
            </span>
          </div>


        </header>

        <section className="rounded-3xl bg-white shadow-xl ring-1 ring-sky-100 p-6 sm:p-8">
          {/* Top controls: report type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm text-slate-600" htmlFor="reportType">
                Report type
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="cyp_adhd">ADHD Assessment (CYP)</option>
                <option value="cyp_autism">Autism Assessment (CYP)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-slate-600" htmlFor="notes">
                Clinician notes (optional)
              </label>
              <input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific instructions for Gemini…"
                className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          </div>

          {/* Dropzone */}
          <div className="mt-6">
            <label
              onDrop={onDrop}
              onDragOver={onDragOver}
              className={`block cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center
              ${file ? 'border-sky-400 bg-sky-50' : 'border-sky-300/80 hover:bg-sky-50 transition'}
            `}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFile(f ?? null);
                  setDownloadUrl(null);
                  setPhase('idle');
                  setStatus(f ? 'File ready. Click Generate.' : 'Waiting for your document…');
                  setErrorMsg(null);
                }}
              />
              <CloudUp className="mx-auto mb-3 h-10 w-10 text-sky-400" />
              <div className="text-slate-800 font-medium">
                Drag & drop to upload <span className="text-slate-500">or</span>{' '}
                <span
                  className="text-sky-600 underline decoration-sky-300 underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    inputRef.current?.click();
                  }}
                >
                  browse
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">PDF or Word document (.docx) • Keeps your original formatting</p>

              {file && (
                <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-sky-200">
                  <FileIcon />
                  <span className="max-w-[16rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                      setDownloadUrl(null);
                      setPhase('idle');
                      setStatus('Waiting for your document…');
                      setErrorMsg(null);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                    className="ml-2 text-sky-600 hover:text-sky-700"
                    aria-label="Remove file"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
            </label>
          </div>

          {/* Actions */}
          <form onSubmit={onSubmit} className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canGenerate}
              className={`inline-flex items-center justify-center rounded-xl px-4 h-11 text-sm font-medium transition
                ${canGenerate ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-sky-300/60 text-white/80 cursor-not-allowed'}
              `}
            >
              {phase === 'generating' || phase === 'uploading' ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Generating…
                </span>
              ) : (
                'Generate Report'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!downloadUrl) return;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              disabled={!downloadUrl || phase !== 'ready'}
              className={`inline-flex items-center justify-center rounded-xl px-4 h-11 text-sm font-medium transition
                ${downloadUrl && phase === 'ready'
                  ? 'bg-sky-100 ring-1 ring-sky-300 text-slate-900 hover:bg-sky-200'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'}
              `}
            >
              <DownloadIcon /> Download .docx
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="ml-auto inline-flex items-center justify-center rounded-xl px-4 h-11 text-sm font-medium text-slate-700 hover:bg-sky-50 ring-1 ring-sky-100"
            >
              Reset
            </button>

            <div className="w-full text-right text-sm text-slate-500 mt-1">{status}</div>
          </form>

          {errorMsg && (
            <div className="mt-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 p-3 text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* tiny help */}
          <div className="mt-6 grid gap-1 text-xs text-slate-500">
            <div>• Keep documents under 20MB. Extremely large files may reduce extraction quality.</div>
            <div>• Your notes are passed as guidance; the app never stores your document.</div>
          </div>
        </section>

        <footer className="mt-8 pb-10 text-center text-xs text-slate-500">
          NeuroSense by <b>IntAnts</b> • AI-assisted clinical reporting
        </footer>
      </div>
    </main>
  );
}

/* -------------------------- helpers & icons --------------------------- */

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ''; }
}

function parseErrorMsg(t: string) {
  try {
    const j = JSON.parse(t);
    return j?.error || j?.details || t || 'Unknown error';
  } catch {
    return t || 'Unknown error';
  }
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mr-2 h-4 w-4">
      <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4A1 1 0 1 1 7.707 11.293L10 13.586V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-slate-500">
      <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 9H15z"/>
    </svg>
  );
}

function CloudUp({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="currentColor" d="M7 18a5 5 0 0 1 0-10 6 6 0 0 1 11.6 1.8A4.5 4.5 0 0 1 18.5 18H14v-4h2l-4-4-4 4h2v4H7z"/>
    </svg>
  );
}

function LogoCloud() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 text-sky-500">
      <path fill="currentColor" d="M7 18a5 5 0 0 1 0-10 6 6 0 0 1 11.6 1.8A4.5 4.5 0 0 1 18.5 18H7z"/>
    </svg>
  );
}
