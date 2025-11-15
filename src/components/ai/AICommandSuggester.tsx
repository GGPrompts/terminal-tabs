import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useTerminalContext } from '@/hooks/useTerminalContext';

interface Suggestion {
  command: string;
  confidence: number;
  explanation: string;
  source: 'ai' | 'history' | 'template';
  error?: string;
}

interface AICommandSuggesterProps {
  terminalId: string;
  currentInput: string;
  onAccept: (command: string) => void;
  enabled?: boolean;
}

/**
 * AICommandSuggester - Inline command suggestions powered by AI
 *
 * Features:
 * - Real-time suggestions as you type
 * - Context-aware (current directory, git status, recent commands)
 * - Press Tab to accept, Esc to dismiss
 * - Confidence scores
 */
export function AICommandSuggester({
  terminalId,
  currentInput,
  onAccept,
  enabled = true
}: AICommandSuggesterProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const context = useTerminalContext(terminalId);

  // Debounced fetch function
  const debouncedFetch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return (input: string) => {
      clearTimeout(timeoutId);

      if (!enabled || input.length < 3) {
        setSuggestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      timeoutId = setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:8127/api/ai/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input,
              context: {
                cwd: context.cwd,
                recentCommands: context.recentCommands,
                gitStatus: context.gitStatus,
                gitRepo: context.gitRepo,
                files: context.files,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();
          setSuggestion(result);
          setVisible(true);
        } catch (error) {
          console.error('[AICommandSuggester] Failed to fetch suggestion:', error);
          setSuggestion({
            command: input,
            confidence: 0,
            explanation: 'AI service unavailable',
            source: 'ai',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          setLoading(false);
        }
      }, 500); // 500ms debounce
    };
  }, [enabled, context]);

  // Fetch suggestion when input changes
  useEffect(() => {
    debouncedFetch(currentInput);
  }, [currentInput, debouncedFetch]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestion || !visible) return;

      // Tab: Accept suggestion
      if (e.key === 'Tab') {
        e.preventDefault();
        onAccept(suggestion.command);
        setSuggestion(null);
        setVisible(false);
      }

      // Escape: Dismiss suggestion
      if (e.key === 'Escape') {
        e.preventDefault();
        setVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestion, visible, onAccept]);

  // Don't render if disabled or no suggestion
  if (!enabled || (!suggestion && !loading)) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="absolute left-0 top-full mt-1 z-50">
        <div className="flex items-center gap-2 bg-popover/90 backdrop-blur-sm text-popover-foreground rounded-md px-3 py-2 shadow-lg border border-border/50">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Thinking...</span>
        </div>
      </div>
    );
  }

  // Show suggestion
  if (suggestion && visible) {
    const isHighConfidence = suggestion.confidence >= 70;
    const isMediumConfidence = suggestion.confidence >= 40;
    const hasError = !!suggestion.error;

    return (
      <div className="absolute left-0 top-full mt-1 z-50 w-full max-w-xl">
        <TooltipProvider>
          <div className="bg-popover/95 backdrop-blur-sm text-popover-foreground rounded-md p-3 shadow-lg border border-border/50">
            {/* Header with icon and dismiss */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className={`h-3.5 w-3.5 ${hasError ? 'text-destructive' : 'text-primary'}`} />
                <span className="text-xs font-medium text-muted-foreground">
                  {hasError ? 'AI Unavailable' : 'AI Suggestion'}
                </span>
              </div>
              <button
                onClick={() => setVisible(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Command suggestion */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <code className="text-sm font-mono flex-1 break-all bg-muted/50 px-2 py-1 rounded">
                {suggestion.command}
              </code>
              {!hasError && (
                <Badge
                  variant={isHighConfidence ? 'default' : isMediumConfidence ? 'secondary' : 'outline'}
                  className="shrink-0"
                >
                  {suggestion.confidence}%
                </Badge>
              )}
            </div>

            {/* Explanation */}
            <p className="text-xs text-muted-foreground mb-3">
              {suggestion.explanation}
            </p>

            {/* Keyboard hints */}
            {!hasError && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/30 pt-2">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Tab</kbd>
                  <span>Accept</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
                  <span>Dismiss</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {hasError && (
              <div className="text-xs text-destructive border-t border-border/30 pt-2">
                {suggestion.error}
              </div>
            )}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return null;
}
