'use client';

import { useState, useRef, useEffect } from 'react';

interface AnalysisResult {
  problem: string;
  target_users: string;
  why_it_matters: string;
  existing_bad_solutions: string;
  mvp_idea: string;
  why_it_can_work_in_location: string;
}

interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
}

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('Azerbaijan');
  const [budget, setBudget] = useState('<$100');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = (jobId: string) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll immediately, then every 1 second
    const pollJob = async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to check job status');
        }

        const status: JobStatusResponse = await response.json();

        setProgress(status.progress);

        if (status.status === 'completed') {
          setResult(status.result);
          setLoading(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        } else if (status.status === 'failed') {
          setError('Job failed to process');
          setLoading(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling even on error
      }
    };

    // Poll immediately
    pollJob();

    // Then set up interval
    pollIntervalRef.current = setInterval(pollJob, 1000);
  };

  const handleAnalyze = async () => {
    setError('');
    setResult(null);
    setProgress(0);

    if (!keyword.trim()) {
      setError('Please enter a keyword to analyze');
      return;
    }

    setLoading(true);

    try {
      // Start the job
      const startResponse = await fetch('/api/start-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location,
          budget,
        }),
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json() as any;
        throw new Error(errorData.error || 'Failed to start analysis job');
      }

      const { jobId } = await startResponse.json() as any;
      setCurrentJobId(jobId);

      // Start polling for status
      startPolling(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-3">Idea Finder</h1>
          <p className="text-xl text-slate-300">Find business ideas based on market research</p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg p-8 shadow-xl mb-8">
          {/* Dropdowns */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option>Azerbaijan</option>
                <option>Turkey</option>
                <option>Georgia</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">Budget</label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option>&lt;$100</option>
                <option>&lt;$500</option>
                <option>&lt;$1000</option>
              </select>
            </div>
          </div>

          {/* Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-200 mb-2">Keyword or Market</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
              disabled={loading}
              placeholder="e.g., sustainable packaging, pet care services, AI tools for small business..."
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Progress Bar */}
          {loading && (
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">Progress</span>
                <span className="text-sm font-semibold text-slate-300">{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing Market ({progress}%)...
              </span>
            ) : (
              'Analyze'
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-8 text-red-200">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white mb-6">Your Business Idea</h2>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-blue-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">PROBLEM</h3>
              <p className="text-white text-lg">{result.problem}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-green-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">TARGET USERS</h3>
              <p className="text-white text-lg">{result.target_users}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-purple-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">WHY IT MATTERS</h3>
              <p className="text-white text-lg">{result.why_it_matters}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-yellow-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">EXISTING BAD SOLUTIONS</h3>
              <p className="text-white text-lg">{result.existing_bad_solutions}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-orange-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">MVP IDEA</h3>
              <p className="text-white text-lg">{result.mvp_idea}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-lg border-l-4 border-red-500">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">WHY IT CAN WORK IN {location.toUpperCase()}</h3>
              <p className="text-white text-lg">{result.why_it_can_work_in_location}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
