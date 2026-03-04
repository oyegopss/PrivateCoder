import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { getModel, onProgress, type LoadPhase } from '../modelManager';

type StaticMetrics = {
  loops: number;
  conditionals: number;
  maxNestingDepth: number;
  lineCount: number;
  maxFunctionLength: number;
  functions: number;
};

function detectLanguage(snippet: string): string | null {
  const lower = snippet.toLowerCase();

  if (snippet.includes('#include')) return 'C++';
  if (lower.includes('package main')) return 'Go';
  if (snippet.includes('public class')) return 'Java';
  if (snippet.includes('def ') && snippet.includes(':')) return 'Python';
  if (snippet.includes('function') || snippet.includes('=>')) return 'JavaScript';

  return null;
}

type ParsedFile = {
  filename: string;
  content: string;
};

function parseProjectFiles(snippet: string): ParsedFile[] {
  const separator = /^\/\/ --- file:\s*(.+?)\s*---\s*$/gm;
  const files: ParsedFile[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let currentName = 'main';

  while ((match = separator.exec(snippet)) !== null) {
    const section = snippet.slice(lastIndex, match.index).trim();
    if (section) {
      files.push({ filename: currentName, content: section });
    }
    currentName = match[1].trim();
    lastIndex = separator.lastIndex;
  }

  const tail = snippet.slice(lastIndex).trim();
  if (tail) {
    files.push({ filename: currentName, content: tail });
  }

  return files;
}

type ModelStatus = 'loading' | 'ready' | 'error';

export function Tool() {
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [lastOutputMode, setLastOutputMode] = useState<string | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullTextRef = useRef('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [tokenUsage, setTokenUsage] = useState<number | null>(null);

  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');
  const [activeModelName, setActiveModelName] = useState<string | null>(null);
  const [webGPUAvailable, setWebGPUAvailable] = useState<boolean | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('sdk-init');
  const [downloadPct, setDownloadPct] = useState(0);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [deepAnalysisMode, setDeepAnalysisMode] = useState(false);
  const [staticMetrics, setStaticMetrics] = useState<StaticMetrics | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [originalCodeForDiff, setOriginalCodeForDiff] = useState<string | null>(null);
  const [refactoredCodeForDiff, setRefactoredCodeForDiff] = useState<string | null>(null);
  const [evolutionSourceMode, setEvolutionSourceMode] = useState<'refactor' | 'optimize' | 'improve' | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    let mounted = true;

    setModelStatus('loading');

    const unsub = onProgress((p) => {
      if (!mounted) return;
      setLoadPhase(p.phase);
      setDownloadPct(p.downloadProgress);
    });

    getModel()
      .then((model) => {
        if (mounted) {
          setActiveModelName(model?.name ?? model?.id ?? null);
          setModelStatus('ready');
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Model init failed:', err);
          setSdkError(err instanceof Error ? err.message : String(err));
          setModelStatus('error');
        }
      });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // On first mount, clear output and diff state. Preserve code input so user
  // prompt is not lost on remount (e.g. React Strict Mode or re-render).
  useEffect(() => {
    setOutput('');
    setDisplayedText('');
    setOriginalCodeForDiff(null);
    setRefactoredCodeForDiff(null);
    setEvolutionSourceMode(null);
    setShowDiff(false);
    setReportText(null);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setWebGPUAvailable(true);
    } else {
      setWebGPUAvailable(false);
    }
  }, []);

  const loading = isGenerating;
  const ready = modelStatus === 'ready';

  // Typing animation: only for normal text output; skip for report, diff view, and long responses
  useEffect(() => {
    if (!output) {
      setDisplayedText('');
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      return;
    }

    if (lastOutputMode === null) return;

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    const skipAnimation =
      lastOutputMode === 'report' ||
      lastOutputMode === 'refactor' ||
      lastOutputMode === 'optimize' ||
      lastOutputMode === 'improve' ||
      output.length > 2000;

    if (skipAnimation) {
      setDisplayedText(output);
      setLastOutputMode(null);
      return;
    }

    fullTextRef.current = output;
    setDisplayedText('');

    const minChunk = 2;
    const maxChunk = 4;
    const minMs = 10;
    const maxMs = 20;

    const id = setInterval(() => {
      const full = fullTextRef.current;
      if (!full) {
        if (typingIntervalRef.current === id) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        return;
      }

      setDisplayedText((prev) => {
        const chunk = Math.min(
          minChunk + Math.floor(Math.random() * (maxChunk - minChunk + 1)),
          full.length - prev.length,
        );
        const nextLen = Math.min(prev.length + chunk, full.length);
        const next = full.slice(0, nextLen);

        if (nextLen >= full.length && typingIntervalRef.current === id) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }

        return next;
      });
    }, minMs + Math.floor(Math.random() * (maxMs - minMs + 1)));

    typingIntervalRef.current = id;
    setLastOutputMode(null);

    return () => {
      if (typingIntervalRef.current === id) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [output, lastOutputMode]);

  const displayedOutput = useMemo(() => {
    if (reportText) {
      const lines = reportText.split('\n');
      return lines.length <= 12 ? reportText : lines.slice(0, 12).join('\n');
    }
    if (!displayedText) return '';
    const lines = displayedText.split('\n');
    return lines.length <= 12 ? displayedText : lines.slice(0, 12).join('\n');
  }, [reportText, displayedText]);

  const diffLines = useMemo(() => {
    if (!originalCodeForDiff || !refactoredCodeForDiff) return null;
    const leftSrc = originalCodeForDiff.split('\n');
    const rightSrc = refactoredCodeForDiff.split('\n');
    const maxLen = Math.max(leftSrc.length, rightSrc.length);

    const left: { line: string; type: 'same' | 'removed' | 'modified' | 'empty' }[] = [];
    const right: { line: string; type: 'same' | 'added' | 'modified' | 'empty' }[] = [];

    for (let i = 0; i < maxLen; i += 1) {
      const l = leftSrc[i];
      const r = rightSrc[i];

      if (l === undefined && r !== undefined) {
        left.push({ line: '', type: 'empty' });
        right.push({ line: r, type: 'added' });
      } else if (l !== undefined && r === undefined) {
        left.push({ line: l, type: 'removed' });
        right.push({ line: '', type: 'empty' });
      } else if (l === r) {
        left.push({ line: l ?? '', type: 'same' });
        right.push({ line: r ?? '', type: 'same' });
      } else {
        // Modified line on both sides
        left.push({ line: l ?? '', type: 'modified' });
        right.push({ line: r ?? '', type: 'modified' });
      }
    }

    return { left, right };
  }, [originalCodeForDiff, refactoredCodeForDiff]);

  const computeStaticMetrics = useCallback((snippet: string): StaticMetrics => {
    const lines = snippet.split('\n');
    let loops = 0;
    let conditionals = 0;
    let maxNestingDepth = 0;
    let currentDepth = 0;
    let maxFunctionLength = 0;
    let currentFunctionLength = 0;
    let inFunction = false;
    let functions = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inFunction) {
          if (currentFunctionLength > maxFunctionLength) {
            maxFunctionLength = currentFunctionLength;
          }
          currentFunctionLength = 0;
          inFunction = false;
        }
        continue;
      }

      if (/\bfor\b|\bwhile\b/.test(line)) loops += 1;
      if (/\bif\b/.test(line)) conditionals += 1;

      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      currentDepth += opens - closes;
      if (currentDepth < 0) currentDepth = 0;
      if (currentDepth > maxNestingDepth) maxNestingDepth = currentDepth;

      if (
        /\bfunction\b/.test(line) ||
        /=>\s*\{?/.test(line) ||
        /^def\s+\w+/.test(line) ||
        /^class\s+\w+/.test(line) ||
        /^func\s+\w+/.test(line)
      ) {
        functions += 1;
        if (inFunction && currentFunctionLength > maxFunctionLength) {
          maxFunctionLength = currentFunctionLength;
        }
        inFunction = true;
        currentFunctionLength = 0;
      }

      if (inFunction) {
        currentFunctionLength += 1;
      }
    }

    if (inFunction && currentFunctionLength > maxFunctionLength) {
      maxFunctionLength = currentFunctionLength;
    }

    return {
      loops,
      conditionals,
      maxNestingDepth,
      lineCount: lines.length,
      maxFunctionLength,
      functions,
    };
  }, []);

  const handleDownloadReport = useCallback(() => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privatecoder-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [reportText]);

  const runGeneration = useCallback(
    async (
      mode:
        | 'explain'
        | 'refactor'
        | 'complexity'
        | 'security'
        | 'quality'
        | 'improve'
        | 'optimize'
        | 'tests'
        | 'deepBug'
        | 'edgeCases'
        | 'maintainability'
        | 'projectArch'
        | 'report',
    ) => {
      const snippet = code.trim();
      if (!snippet || !ready || isGenerating) return;

      setIsGenerating(true);
      setError(null);
      setOutput('');
      setDisplayedText('');
      setLastOutputMode(null);
      setResponseTime(null);
      setTokenUsage(null);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }

      if (mode === 'refactor' || mode === 'optimize' || mode === 'improve') {
        setOriginalCodeForDiff(snippet);
        setEvolutionSourceMode(mode);
        setShowDiff(true);
      } else {
        setOriginalCodeForDiff(null);
        setRefactoredCodeForDiff(null);
        setEvolutionSourceMode(null);
        setShowDiff(false);
      }

      const metrics = computeStaticMetrics(snippet);
      setStaticMetrics(metrics);

      const language = detectLanguage(snippet);
      const languagePrefix = language ? `You are analyzing ${language} code.\n\n` : '';
      const deepFormatPrefix =
        deepAnalysisMode && mode !== 'maintainability'
          ? 'Return your answer in this structured format:\nObservations:\n...\nIssues:\n...\nImprovements:\n...\nSummary:\n...\n\n'
          : '';

      const metricsPrefixSecurityQuality =
        metrics && (mode === 'security' || mode === 'quality' || mode === 'deepBug')
          ? `Given these static metrics:\nLoops: ${metrics.loops}\nConditionals: ${metrics.conditionals}\nMax Nesting Depth: ${metrics.maxNestingDepth}\nLines: ${metrics.lineCount}\nMax Function Length: ${metrics.maxFunctionLength}\n\nAssess code quality and risks based on these metrics as part of your answer.\n\n`
          : '';

      const metricsPrefixReport =
        metrics && mode === 'report'
          ? `Given these static metrics:\nLoops: ${metrics.loops}\nConditionals: ${metrics.conditionals}\nMax Nesting Depth: ${metrics.maxNestingDepth}\nLines: ${metrics.lineCount}\nMax Function Length: ${metrics.maxFunctionLength}\n\nUse them when assessing complexity, maintainability, and risk.\n\n`
          : '';

      let prompt: string;
      if (mode === 'explain') {
        prompt = `${languagePrefix}${deepFormatPrefix}Explain what this code does and list any potential issues, concisely:\n\n${snippet}`;
      } else if (mode === 'refactor') {
        prompt = `${languagePrefix}${deepFormatPrefix}Refactor this code for clarity while preserving behavior; return only the refactored code:\n\n${snippet}`;
      } else if (mode === 'optimize') {
        prompt = `${languagePrefix}${deepFormatPrefix}Optimize this code for performance without changing behavior; return only the optimized code:\n\n${snippet}`;
      } else if (mode === 'complexity') {
        prompt = `${languagePrefix}${deepFormatPrefix}Give Big-O time and space complexity and a short explanation in this format:\nTime Complexity: ...\nSpace Complexity: ...\nExplanation: ...\n\n${snippet}`;
      } else if (mode === 'security') {
        prompt = `${languagePrefix}${deepFormatPrefix}${metricsPrefixSecurityQuality}Analyze this code for security issues (vulns, unsafe patterns, injection, secrets). If none, respond exactly: "No obvious vulnerabilities found.":\n\n${snippet}`;
      } else if (mode === 'quality') {
        prompt = `${languagePrefix}${deepFormatPrefix}${metricsPrefixSecurityQuality}Give a code quality score X/10 and three short bullet reasons in this format:\nScore: X/10\nReason:\n- ...\n- ...\n- ...\n\n${snippet}`;
      } else if (mode === 'improve') {
        prompt = `${languagePrefix}${deepFormatPrefix}Suggest up to 5 concise bullet improvements (naming, structure, performance) only:\n\n${snippet}`;
      } else if (mode === 'deepBug') {
        prompt = `${languagePrefix}${deepFormatPrefix}${metricsPrefixSecurityQuality}Analyze this code and identify:\n- Logical bugs\n- Potential runtime errors\n- Unreachable code\n- Async misuse\n- Risky patterns\n\nReturn concise bullet points only.\n\n${snippet}`;
      } else if (mode === 'edgeCases') {
        prompt = `${languagePrefix}${deepFormatPrefix}Identify possible edge cases and boundary conditions for this code, including invalid input, empty input, large input, and null/undefined handling.\nReturn concise bullet points.\n\n${snippet}`;
      } else if (mode === 'maintainability') {
        const { lineCount, loops, conditionals, maxNestingDepth, functions } = metrics;

        let baseScore = 10;
        if (lineCount > 40) baseScore -= 1;
        if (loops > 2) baseScore -= 1;
        if (conditionals > 4) baseScore -= 1;
        if (maxNestingDepth > 3) baseScore -= 1;
        if (functions > 5) baseScore -= 1;
        if (baseScore < 1) baseScore = 1;

        prompt = `${languagePrefix}You are analyzing maintainability of this code.\n\nStatic metrics:\nLines: ${lineCount}\nLoops: ${loops}\nConditionals: ${conditionals}\nFunctions: ${functions}\nMax Nesting Depth: ${maxNestingDepth}\nBase Score (heuristic): ${baseScore}/10\n\nInterpret this score and provide:\n- Final Score (1-10)\n- Risk Level (Low/Medium/High)\n- 3 concise improvement suggestions.\n\nReturn structured output exactly in this format:\n📊 Maintainability Report\n\nScore: X/10\nRisk Level: <Low|Medium|High>\n\nImprovements:\n• ...\n• ...\n• ...\n\nCode:\n\n${snippet}`;
      } else if (mode === 'projectArch') {
        const files = parseProjectFiles(snippet);
        const fileSummary =
          files.length > 0
            ? files
                .map((f, idx) => `- [${idx + 1}] ${f.filename} (${f.content.split('\n').length} lines)`)
                .join('\n')
            : '- [1] main (single block)';

        const archIntro =
          'You are analyzing a multi-file software project.\n\nFiles provided below, separated by markers like "// --- file: filename ---".\n\n';

        const archInstructions =
          'Identify:\n- Architectural weaknesses\n- Tight coupling\n- Poor separation of concerns\n- Circular dependency risks\n- Suggested folder/module restructuring\n\nReturn concise structured output exactly in this format:\n🏗 Architecture Report\n\nIssues:\n- ...\n- ...\n\nImprovements:\n- ...\n- ...\n\nRisk Level: Low / Medium / High\n\n';

        prompt = `${languagePrefix}${deepFormatPrefix}${archIntro}File summary:\n${fileSummary}\n\nFull project source:\n\n${snippet}\n\n${archInstructions}`;
      } else if (mode === 'report') {
        const { lineCount, loops, conditionals, maxNestingDepth, functions } = metrics;

        let baseScore = 10;
        if (lineCount > 40) baseScore -= 1;
        if (loops > 2) baseScore -= 1;
        if (conditionals > 4) baseScore -= 1;
        if (maxNestingDepth > 3) baseScore -= 1;
        if (functions > 5) baseScore -= 1;
        if (baseScore < 1) baseScore = 1;

        const files = parseProjectFiles(snippet);
        const hasMultipleFiles = files.length > 1;

        const metricsBlock =
          `Static Metrics:\n` +
          `Lines: ${lineCount}\n` +
          `Loops: ${loops}\n` +
          `Conditionals: ${conditionals}\n` +
          `Functions: ${functions}\n` +
          `Max Nesting Depth: ${maxNestingDepth}\n` +
          `Heuristic Maintainability Score: ${baseScore}/10\n\n`;

        const multiFileNote = hasMultipleFiles
          ? 'The code contains multiple files separated by markers like "// --- file: filename ---". Treat this as a multi-file project and include architecture risks in your assessment.\n\n'
          : '';

        const formatBlock =
          'Generate structured report:\n\n' +
          '=== PrivateCoder Engineering Risk Report ===\n\n' +
          'Overall Risk Level: (Low / Medium / High)\n\n' +
          'Breakdown:\n' +
          '- Complexity: ...\n' +
          '- Maintainability: ...\n' +
          '- Security: ...\n' +
          '- Architecture: ...\n\n' +
          'Top 3 Critical Issues:\n' +
          '- ...\n' +
          '- ...\n' +
          '- ...\n\n' +
          'Executive Summary:\n' +
          '(2–3 concise lines)\n\n' +
          'Keep output concise, structured, and professional.\n\n';

        const header =
          'You are generating a full engineering risk report for this code.\n\n' +
          'Previously detected issues may include:\n' +
          '- Security risks\n' +
          '- Architectural weaknesses\n' +
          '- Deep nesting\n' +
          '- Tight coupling\n\n';

        prompt = `${languagePrefix}${header}${metricsBlock}${multiFileNote}${formatBlock}Code:\n\n${snippet}`;
      } else {
        // mode === 'tests'
        prompt = `${languagePrefix}${deepFormatPrefix}Generate 5 concise test cases, including edge cases, for this code; return tests only:\n\n${snippet}`;
      }

      const startTime = performance.now();

      try {
        let maxTokens: number;
        switch (mode) {
          case 'explain':
          case 'refactor':
          case 'optimize':
          case 'improve':
            maxTokens = 60;
            break;
          case 'complexity':
          case 'quality':
            maxTokens = 50;
            break;
          case 'security':
            maxTokens = 60;
            break;
          case 'tests':
            maxTokens = 70;
            break;
          case 'deepBug':
          case 'edgeCases':
            maxTokens = 80;
            break;
          case 'maintainability':
            maxTokens = 80;
            break;
          case 'projectArch':
            maxTokens = 120;
            break;
          case 'report':
            maxTokens = 120;
            break;
          default:
            maxTokens = 60;
        }

        if (deepAnalysisMode) {
          maxTokens += 40;
        }

        const { stream, result: resultPromise } = await TextGeneration.generateStream(prompt, {
          maxTokens,
          temperature: 0.2,
          topP: 0.9,
        });

        // Allow UI to render "Thinking…" before inference blocks
        await new Promise((r) => setTimeout(r, 0));

        let accumulated = '';
        let tokenCount = 0;
        for await (const token of stream) {
          accumulated += token;
          tokenCount += 1;
          if (tokenCount % 5 === 0) {
            setOutput(accumulated);
            // Yield to main thread so UI stays responsive during inference
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        const result = await resultPromise;
        const finalText = result.text ?? accumulated;
        setOutput(finalText);
        setLastOutputMode(mode);
        if (mode === 'report') {
          setReportText(finalText);
        } else {
          setReportText(null);
        }
        if (mode === 'refactor' || mode === 'optimize' || mode === 'improve') {
          setRefactoredCodeForDiff(finalText);
        }

        const endTime = performance.now();
        setResponseTime(Math.round(endTime - startTime));

        const estimatedTokens = Math.ceil(finalText.length / 4);
        setTokenUsage(estimatedTokens);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActiveAction(null);
        setIsGenerating(false);
      }
    },
    [code, isGenerating, ready, deepAnalysisMode],
  );

  const buttonsDisabled = !ready || loading;

  if (modelStatus === 'loading') {
    const phaseLabel: Record<LoadPhase, string> = {
      'sdk-init': 'Initializing AI engine...',
      'downloading': `Downloading model... ${Math.round(downloadPct * 100)}%`,
      'loading-model': 'Loading model into memory...',
      'ready': 'Almost there...',
      'error': '',
    };

    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Initializing PrivateCoder Engine</h2>
        <p className="app-subtitle">{phaseLabel[loadPhase]}</p>
        {loadPhase === 'downloading' && (
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.round(downloadPct * 100)}%` }}
            />
          </div>
        )}
        <p className="app-tagline">
          {loadPhase === 'downloading'
            ? 'First download is cached — future loads will be much faster.'
            : loadPhase === 'sdk-init'
              ? 'Starting AI engine...'
              : 'Almost there — loading into memory.'}
        </p>
      </div>
    );
  }

  if (modelStatus === 'error') {
    return (
      <div className="app-loading">
        <h2>Model failed to load</h2>
        {sdkError && <p className="error-text">{sdkError}</p>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setModelStatus('loading');
            void getModel()
              .then((model) => {
                setActiveModelName(model?.name ?? model?.id ?? null);
                setModelStatus('ready');
              })
              .catch((err) => {
                console.error('Model init retry failed:', err);
                setSdkError(err instanceof Error ? err.message : String(err));
                setModelStatus('error');
              });
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div id="tool-section" className="app">
      <header className="app-header">
        <div>
          <h1>PRIVATECODER</h1>
          <p className="app-subtitle">On-Device Code Assistant</p>
          <p className="app-tagline">🔒 100% Private | ⚡ Instant | ✈ Works Offline</p>
          <span className="offline-badge">🛡 Running Fully Offline</span>
        </div>
      </header>

      <main className="coder-main">
        <section className="coder-status">
          {modelStatus === 'ready' && (
            <>
              <span className="coder-status-label status-ready">Model ready</span>
              {activeModelName && (
                <span className="coder-status-model">
                  Using model: <strong>{activeModelName}</strong>
                  {webGPUAvailable !== null && (
                    <span className={webGPUAvailable ? 'accel-badge accel-badge-webgpu' : 'accel-badge'}>
                      🔋 {webGPUAvailable ? 'WebGPU Enabled' : 'CPU Mode'}
                    </span>
                  )}
                </span>
              )}
            </>
          )}
        </section>

        <section className="coder-toggles">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={deepAnalysisMode}
              onChange={(e) => setDeepAnalysisMode(e.target.checked)}
            />
            <span>Deep Analysis Mode</span>
          </label>
        </section>

        <section className="coder-input-section">
          <label className="coder-label" htmlFor="code-input">
            Code
          </label>
          <textarea
            id="code-input"
            className="coder-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste or type your code here..."
          />
        </section>

        <section className="static-metrics">
          <div className="static-metrics-header">
            <span className="static-metrics-title">Static Analysis Metrics</span>
          </div>
          {staticMetrics ? (
            <div className="static-metrics-grid">
              <div className="static-metrics-item">
                <span className="static-metrics-label">Loops</span>
                <span className="static-metrics-value">{staticMetrics.loops}</span>
              </div>
              <div className="static-metrics-item">
                <span className="static-metrics-label">Conditionals</span>
                <span className="static-metrics-value">{staticMetrics.conditionals}</span>
              </div>
              <div className="static-metrics-item">
                <span className="static-metrics-label">Max Nesting</span>
                <span className="static-metrics-value">{staticMetrics.maxNestingDepth}</span>
              </div>
              <div className="static-metrics-item">
                <span className="static-metrics-label">Lines</span>
                <span className="static-metrics-value">{staticMetrics.lineCount}</span>
              </div>
              <div className="static-metrics-item">
                <span className="static-metrics-label">Max Function Length</span>
                <span className="static-metrics-value">
                  {staticMetrics.maxFunctionLength > 0 ? staticMetrics.maxFunctionLength : '—'}
                </span>
              </div>
              <div className="static-metrics-item">
                <span className="static-metrics-label">Functions</span>
                <span className="static-metrics-value">{staticMetrics.functions}</span>
              </div>
            </div>
          ) : (
            <p className="static-metrics-empty text-muted">Run any analysis to see static metrics.</p>
          )}
        </section>

        <section className="coder-actions">
          <button
            className={activeAction === 'explain' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('explain');
              void runGeneration('explain');
            }}
          >
            {isGenerating && activeAction === 'explain' ? 'Explaining…' : 'Explain Code'}
          </button>
          <button
            className={activeAction === 'refactor' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('refactor');
              void runGeneration('refactor');
            }}
          >
            {isGenerating && activeAction === 'refactor' ? 'Refactoring…' : 'Refactor Code'}
          </button>
          <button
            className={activeAction === 'optimize' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('optimize');
              void runGeneration('optimize');
            }}
          >
            {isGenerating && activeAction === 'optimize' ? 'Optimizing…' : 'Optimize Code'}
          </button>
          <button
            className={activeAction === 'complexity' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('complexity');
              void runGeneration('complexity');
            }}
          >
            {isGenerating && activeAction === 'complexity' ? 'Analyzing…' : 'Analyze Complexity'}
          </button>
          <button
            className={activeAction === 'security' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('security');
              void runGeneration('security');
            }}
          >
            {isGenerating && activeAction === 'security' ? 'Scanning…' : 'Security Scan'}
          </button>
          <button
            className={activeAction === 'quality' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('quality');
              void runGeneration('quality');
            }}
          >
            {isGenerating && activeAction === 'quality' ? 'Scoring…' : 'Code Quality Score'}
          </button>
          <button
            className={activeAction === 'improve' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('improve');
              void runGeneration('improve');
            }}
          >
            {isGenerating && activeAction === 'improve' ? 'Suggesting…' : 'Suggest Improvements'}
          </button>
          <button
            className={activeAction === 'tests' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('tests');
              void runGeneration('tests');
            }}
          >
            {isGenerating && activeAction === 'tests' ? 'Generating…' : 'Generate Test Cases'}
          </button>
          <button
            className={activeAction === 'deepBug' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('deepBug');
              void runGeneration('deepBug');
            }}
          >
            {isGenerating && activeAction === 'deepBug' ? 'Analyzing…' : 'Deep Bug Analysis'}
          </button>
          <button
            className={activeAction === 'edgeCases' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('edgeCases');
              void runGeneration('edgeCases');
            }}
          >
            {isGenerating && activeAction === 'edgeCases' ? 'Finding…' : 'Find Edge Cases'}
          </button>
          <button
            className={activeAction === 'maintainability' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('maintainability');
              void runGeneration('maintainability');
            }}
          >
            {isGenerating && activeAction === 'maintainability' ? 'Scoring…' : 'Maintainability Score'}
          </button>
          <button
            className={activeAction === 'projectArch' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('projectArch');
              void runGeneration('projectArch');
            }}
          >
            {isGenerating && activeAction === 'projectArch' ? 'Analyzing…' : 'Analyze Project Architecture'}
          </button>
          <button
            className={activeAction === 'report' && isGenerating ? 'btn btn-primary' : 'btn'}
            type="button"
            disabled={buttonsDisabled}
            onClick={() => {
              setActiveAction('report');
              void runGeneration('report');
            }}
          >
            {isGenerating && activeAction === 'report' ? 'Generating…' : '🔥 Generate Engineering Risk Report'}
          </button>
        </section>

        <section className="coder-output-section">
          <div className="coder-output-header">
            <span>Output</span>
            {originalCodeForDiff != null && refactoredCodeForDiff != null && (
              <button
                type="button"
                className="output-toggle"
                onClick={() => setShowDiff((v) => !v)}
              >
                {showDiff ? 'View Clean Output' : 'View Changes'}
              </button>
            )}
            {isGenerating && <span className="coder-output-loading">Thinking…</span>}
          </div>
          {showDiff && originalCodeForDiff != null && refactoredCodeForDiff != null ? (
            <div className="evolution-container">
              <div className="evolution-header">Code Evolution View</div>
              <div className="evolution-panels">
                <div className="evolution-panel evolution-panel-left">
                  <div className="evolution-panel-header">Original</div>
                  {evolutionSourceMode === 'improve' ? (
                    <pre className="evolution-plain">{originalCodeForDiff}</pre>
                  ) : diffLines ? (
                    <div className="evolution-lines">
                      {diffLines.left.map((row, idx) => (
                        <div
                          key={`left-${idx}`}
                          className={`evolution-line evolution-line-${row.type}`}
                        >
                          {row.line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="evolution-panel evolution-panel-right evolution-slide-in">
                  <div className="evolution-panel-header">
                    {evolutionSourceMode === 'improve' ? 'Suggestions' : 'Improved'}
                  </div>
                  {evolutionSourceMode === 'improve' ? (
                    <pre className="evolution-plain">{refactoredCodeForDiff}</pre>
                  ) : diffLines ? (
                    <div className="evolution-lines">
                      {diffLines.right.map((row, idx) => (
                        <div
                          key={`right-${idx}`}
                          className={`evolution-line evolution-line-${row.type}`}
                        >
                          {row.line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="coder-output coder-output-transition">
              {output ? (
                reportText ? (
                  <div className="risk-report-card">
                    <div className="risk-report-header">📋 Engineering Risk Report</div>
                    <pre className="risk-report-body">{displayedOutput}</pre>
                  </div>
                ) : (
                  <pre>{displayedOutput}</pre>
                )
              ) : (
                <span className="text-muted">Results will appear here.</span>
              )}
            </div>
          )}
          <div className="report-actions">
            <button
              type="button"
              className="btn"
              disabled={!reportText}
              onClick={handleDownloadReport}
            >
              Download Report (.txt)
            </button>
          </div>
          {responseTime && <div className="metrics">⚡ Response Time: {responseTime} ms</div>}
          {tokenUsage && <div className="metrics">📊 Estimated Tokens: {tokenUsage}</div>}
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    </div>
  );
}

