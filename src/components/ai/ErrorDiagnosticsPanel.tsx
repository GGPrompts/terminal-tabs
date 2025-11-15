import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { detectErrors, extractStackTrace, SAMPLE_ERRORS } from '@/lib/error-patterns';
import { explainError } from '@/lib/ai-client';
import { useTerminalContext } from '@/hooks/useTerminalContext';

interface DetectedError {
  type: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  explanation: string;
  suggestedFix: string;
  docsUrl?: string;
  pattern: string;
  raw: string;
  stackTrace?: string;
  aiAnalysis?: {
    explanation: string;
    suggestedFix: string;
    docsUrl?: string;
  };
}

interface ErrorDiagnosticsPanelProps {
  terminalId: string;
  terminalOutput: string;
  onApplyFix: (fix: string) => void;
  enabled?: boolean;
  demoMode?: boolean;
  className?: string;
}

/**
 * ErrorDiagnosticsPanel - Real-time error detection and AI-powered fixes
 *
 * Features:
 * - Pattern matching for common errors
 * - AI-powered error analysis
 * - One-click Apply Fix button
 * - Stack trace parsing
 * - Documentation links
 * - Demo mode with sample errors
 */
export function ErrorDiagnosticsPanel({
  terminalId,
  terminalOutput,
  onApplyFix,
  enabled = true,
  demoMode = false,
  className = '',
}: ErrorDiagnosticsPanelProps) {
  const [errors, setErrors] = useState<DetectedError[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [loadingAI, setLoadingAI] = useState<Set<number>>(new Set());
  const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set());
  const context = useTerminalContext(terminalId);

  // Detect errors in terminal output
  useEffect(() => {
    if (!enabled) {
      setErrors([]);
      return;
    }

    if (demoMode) {
      // Demo mode: show sample errors
      const demoErrors = SAMPLE_ERRORS.map((sample) => {
        const detected = detectErrors(sample.output);
        return detected.map((err) => ({
          ...err,
          stackTrace: extractStackTrace(sample.output) || undefined,
        }));
      }).flat();

      setErrors(demoErrors);
      return;
    }

    // Real mode: detect errors from terminal output
    const detected = detectErrors(terminalOutput);
    const withStackTraces = detected.map((err) => ({
      ...err,
      stackTrace: extractStackTrace(terminalOutput) || undefined,
    }));

    setErrors(withStackTraces);
  }, [terminalOutput, enabled, demoMode]);

  // Get AI analysis for an error
  const getAIAnalysis = async (index: number, error: DetectedError) => {
    setLoadingAI((prev) => new Set(prev).add(index));

    try {
      const analysis = await explainError(error.raw, {
        cwd: context.cwd,
        lastCommand: context.lastCommand,
      });

      setErrors((prev) =>
        prev.map((err, i) =>
          i === index
            ? {
                ...err,
                aiAnalysis: {
                  explanation: analysis.explanation,
                  suggestedFix: analysis.suggestedFix,
                  docsUrl: analysis.docsUrl,
                },
              }
            : err
        )
      );
    } catch (error) {
      console.error('[ErrorDiagnosticsPanel] AI analysis failed:', error);
    } finally {
      setLoadingAI((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // Toggle error expansion
  const toggleExpanded = (index: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Apply fix
  const handleApplyFix = (index: number, fix: string) => {
    onApplyFix(fix);
    setAppliedFixes((prev) => new Set(prev).add(index));

    // Auto-collapse after applying
    setTimeout(() => {
      setExpandedErrors((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 1000);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Get severity icon and color
  const getSeverityDisplay = (severity: 'warning' | 'error' | 'critical') => {
    switch (severity) {
      case 'critical':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
        };
    }
  };

  if (!enabled || errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Zap className="h-4 w-4 text-primary" />
        <span>Error Diagnostics</span>
        {demoMode && (
          <Badge variant="secondary" className="ml-auto">
            Demo Mode
          </Badge>
        )}
        <Badge variant="outline">{errors.length}</Badge>
      </div>

      {/* Error list */}
      {errors.map((error, index) => {
        const severityDisplay = getSeverityDisplay(error.severity);
        const SeverityIcon = severityDisplay.icon;
        const isExpanded = expandedErrors.has(index);
        const isLoadingAI = loadingAI.has(index);
        const isApplied = appliedFixes.has(index);
        const hasAIAnalysis = !!error.aiAnalysis;

        return (
          <Alert
            key={index}
            variant={error.severity === 'critical' ? 'destructive' : 'default'}
            className={`${severityDisplay.bgColor} ${severityDisplay.borderColor} transition-all`}
          >
            {/* Icon */}
            <SeverityIcon className={`h-4 w-4 ${severityDisplay.color}`} />

            {/* Title */}
            <AlertTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{error.message}</span>
                <Badge variant="outline" className="text-xs">
                  {error.pattern}
                </Badge>
              </div>

              {/* Status indicators */}
              <div className="flex items-center gap-2">
                {isApplied && (
                  <Badge variant="default" className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Applied
                  </Badge>
                )}
              </div>
            </AlertTitle>

            <AlertDescription>
              {/* Explanation */}
              <p className="mb-3 text-sm">{error.explanation}</p>

              {/* Suggested fix (collapsed view) */}
              {!isExpanded && (
                <div className="mb-3">
                  <code className="text-xs bg-muted/50 px-2 py-1 rounded block overflow-x-auto">
                    {error.suggestedFix.split('\n')[0]}
                    {error.suggestedFix.includes('\n') && '...'}
                  </code>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  size="sm"
                  onClick={() => handleApplyFix(index, error.suggestedFix)}
                  disabled={isApplied}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isApplied ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Applied
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Apply Fix
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(error.suggestedFix)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>

                {!hasAIAnalysis && !isLoadingAI && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => getAIAnalysis(index, error)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Analysis
                  </Button>
                )}

                {isLoadingAI && (
                  <Button size="sm" variant="ghost" disabled>
                    <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                    Analyzing...
                  </Button>
                )}

                {error.docsUrl && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={error.docsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Docs
                    </a>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleExpanded(index)}
                  className="ml-auto"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      More
                    </>
                  )}
                </Button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="space-y-3 border-t border-border/30 pt-3">
                  {/* Full suggested fix */}
                  <div>
                    <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                      Suggested Fix:
                    </h4>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {error.suggestedFix}
                    </pre>
                  </div>

                  {/* AI Analysis */}
                  {hasAIAnalysis && error.aiAnalysis && (
                    <div className="bg-primary/5 border border-primary/20 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <h4 className="text-xs font-semibold text-primary">
                          AI Analysis
                        </h4>
                      </div>
                      <p className="text-xs mb-2 text-muted-foreground">
                        {error.aiAnalysis.explanation}
                      </p>
                      <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {error.aiAnalysis.suggestedFix}
                      </pre>
                      {error.aiAnalysis.docsUrl && (
                        <Button
                          size="sm"
                          variant="link"
                          className="mt-2 h-auto p-0 text-xs"
                          asChild
                        >
                          <a
                            href={error.aiAnalysis.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Documentation
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Stack trace */}
                  {error.stackTrace && (
                    <div>
                      <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                        Stack Trace:
                      </h4>
                      <pre className="text-xs bg-destructive/10 p-2 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                        {error.stackTrace}
                      </pre>
                    </div>
                  )}

                  {/* Raw error */}
                  <div>
                    <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                      Raw Error:
                    </h4>
                    <code className="text-xs bg-muted/50 px-2 py-1 rounded block overflow-x-auto">
                      {error.raw}
                    </code>
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
