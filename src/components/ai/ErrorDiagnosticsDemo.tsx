import React, { useState } from 'react';
import { ErrorDiagnosticsPanel } from './ErrorDiagnosticsPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SAMPLE_ERRORS } from '@/lib/error-patterns';
import { Sparkles, Terminal as TerminalIcon, Copy, CheckCircle } from 'lucide-react';

/**
 * ErrorDiagnosticsDemo - Interactive demo of ErrorDiagnosticsPanel
 *
 * Shows how the error detection and AI-powered fixes work
 */
export function ErrorDiagnosticsDemo() {
  const [selectedError, setSelectedError] = useState(0);
  const [terminalOutput, setTerminalOutput] = useState(SAMPLE_ERRORS[0].output);
  const [appliedFixes, setAppliedFixes] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSelectError = (index: number) => {
    setSelectedError(index);
    setTerminalOutput(SAMPLE_ERRORS[index].output);
  };

  const handleApplyFix = (fix: string) => {
    setAppliedFixes((prev) => [...prev, fix]);
    console.log('[Demo] Applied fix:', fix);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Error Diagnostics Panel</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered error detection and fixes for terminal errors
        </p>
      </div>

      <Tabs defaultValue="demo" className="space-y-6">
        <TabsList>
          <TabsTrigger value="demo">
            <TerminalIcon className="h-4 w-4 mr-2" />
            Live Demo
          </TabsTrigger>
          <TabsTrigger value="samples">Sample Errors</TabsTrigger>
          <TabsTrigger value="applied">Applied Fixes</TabsTrigger>
        </TabsList>

        {/* Live Demo Tab */}
        <TabsContent value="demo" className="space-y-6">
          {/* Error selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select an Error Type</CardTitle>
              <CardDescription>
                Choose a sample error to see how ErrorDiagnosticsPanel detects and suggests fixes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SAMPLE_ERRORS.map((sample, index) => (
                  <Button
                    key={index}
                    variant={selectedError === index ? 'default' : 'outline'}
                    className="justify-start h-auto p-4"
                    onClick={() => handleSelectError(index)}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{sample.description}</div>
                      <code className="text-xs text-muted-foreground mt-1 block truncate">
                        {sample.output.split('\n')[0]}
                      </code>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Terminal output */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TerminalIcon className="h-5 w-5" />
                Terminal Output
              </CardTitle>
              <CardDescription>
                Raw error output from terminal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                {terminalOutput}
              </pre>
            </CardContent>
          </Card>

          {/* Error Diagnostics Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Error Diagnostics
              </CardTitle>
              <CardDescription>
                Automatic error detection with AI-powered fixes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorDiagnosticsPanel
                terminalId="demo-terminal"
                terminalOutput={terminalOutput}
                onApplyFix={handleApplyFix}
                enabled={true}
                demoMode={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sample Errors Tab */}
        <TabsContent value="samples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sample Error Patterns</CardTitle>
              <CardDescription>
                Common errors that ErrorDiagnosticsPanel can detect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SAMPLE_ERRORS.map((sample, index) => (
                <div key={index} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{sample.description}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(sample.output, index)}
                    >
                      {copiedIndex === index ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                    {sample.output}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applied Fixes Tab */}
        <TabsContent value="applied" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Applied Fixes</CardTitle>
              <CardDescription>
                Fixes you've applied during this demo session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appliedFixes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No fixes applied yet. Click "Apply Fix" on an error to see it here!
                </p>
              ) : (
                <div className="space-y-3">
                  {appliedFixes.map((fix, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <Badge variant="outline">Fix #{index + 1}</Badge>
                      </div>
                      <pre className="bg-muted/50 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                        {fix}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Features */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Pattern Matching</h4>
                <p className="text-sm text-muted-foreground">
                  Detects 15+ common error patterns including npm, git, Python, TypeScript, and more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Get deeper insights with optional AI-powered error analysis
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">One-Click Fixes</h4>
                <p className="text-sm text-muted-foreground">
                  Apply suggested fixes directly to your terminal with a single click
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Stack Traces</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically extracts and displays stack traces from error output
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Documentation Links</h4>
                <p className="text-sm text-muted-foreground">
                  Direct links to official documentation for deeper understanding
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Severity Levels</h4>
                <p className="text-sm text-muted-foreground">
                  Color-coded warnings, errors, and critical issues for quick triage
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
