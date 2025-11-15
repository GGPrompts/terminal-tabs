/**
 * Error Pattern Matchers
 *
 * Detects common terminal errors and provides suggested fixes
 */

export interface ErrorPattern {
  name: string;
  regex: RegExp;
  type: 'command_not_found' | 'npm_error' | 'git_error' | 'python_error' | 'build_error' | 'permission_error' | 'network_error' | 'syntax_error' | 'unknown_error';
  severity: 'warning' | 'error' | 'critical';
  getSuggestion: (match: RegExpMatchArray, fullOutput: string) => {
    message: string;
    explanation: string;
    suggestedFix: string;
    docsUrl?: string;
  };
}

/**
 * Common error patterns with regex matching and fix suggestions
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  // ============================================================================
  // Command Not Found Errors
  // ============================================================================
  {
    name: 'Command Not Found (bash/zsh)',
    regex: /(?:command not found|zsh: command not found|bash: command not found):\s*(.+)/i,
    type: 'command_not_found',
    severity: 'error',
    getSuggestion: (match) => {
      const command = match[1]?.trim() || 'unknown';

      // Common typos and their corrections
      const commonFixes: Record<string, string> = {
        'pytohn': 'python',
        'pyhton': 'python',
        'ndoe': 'node',
        'nmp': 'npm',
        'gti': 'git',
        'cd..': 'cd ..',
        'celar': 'clear',
        'claer': 'clear',
      };

      const suggestion = commonFixes[command.toLowerCase()];

      if (suggestion) {
        return {
          message: `Command "${command}" not found`,
          explanation: `Did you mean "${suggestion}"? This looks like a typo.`,
          suggestedFix: suggestion,
        };
      }

      // Common packages that need installation
      const installCommands: Record<string, string> = {
        'npx': 'npm install -g npx',
        'yarn': 'npm install -g yarn',
        'pnpm': 'npm install -g pnpm',
        'tsc': 'npm install -g typescript',
        'ts-node': 'npm install -g ts-node',
        'nodemon': 'npm install -g nodemon',
        'pm2': 'npm install -g pm2',
        'serve': 'npm install -g serve',
      };

      const installCmd = installCommands[command.toLowerCase()];

      if (installCmd) {
        return {
          message: `Command "${command}" not found`,
          explanation: `The "${command}" command is not installed. You can install it globally with npm.`,
          suggestedFix: installCmd,
          docsUrl: `https://www.npmjs.com/package/${command}`,
        };
      }

      return {
        message: `Command "${command}" not found`,
        explanation: `The command "${command}" is not installed or not in your PATH.`,
        suggestedFix: `# Search for similar commands:\nwhich ${command}\napropos ${command}`,
      };
    },
  },

  // ============================================================================
  // NPM Errors
  // ============================================================================
  {
    name: 'npm ERR! code ENOENT',
    regex: /npm ERR! code ENOENT/i,
    type: 'npm_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'npm ENOENT error',
      explanation: 'package.json not found in current directory. You need to initialize a Node.js project first.',
      suggestedFix: 'npm init -y',
      docsUrl: 'https://docs.npmjs.com/cli/v10/commands/npm-init',
    }),
  },
  {
    name: 'npm ERR! code EACCES',
    regex: /npm ERR! code EACCES/i,
    type: 'npm_error',
    severity: 'critical',
    getSuggestion: () => ({
      message: 'npm permission denied',
      explanation: 'Permission error when installing packages. Never use sudo with npm! Fix npm permissions instead.',
      suggestedFix: `# Fix npm permissions (recommended):\nmkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc`,
      docsUrl: 'https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally',
    }),
  },
  {
    name: 'npm ERR! 404 Not Found',
    regex: /npm ERR! 404.*'(.+?)'/i,
    type: 'npm_error',
    severity: 'error',
    getSuggestion: (match) => {
      const packageName = match[1] || 'unknown';
      return {
        message: 'npm package not found',
        explanation: `The package "${packageName}" does not exist on npm registry. Check the package name for typos.`,
        suggestedFix: `# Search for similar packages:\nnpm search ${packageName}`,
        docsUrl: `https://www.npmjs.com/search?q=${packageName}`,
      };
    },
  },
  {
    name: 'npm ERR! ERESOLVE',
    regex: /npm ERR! ERESOLVE/i,
    type: 'npm_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'npm dependency conflict',
      explanation: 'Conflicting dependency versions. Try using --legacy-peer-deps to bypass strict peer dependency checking.',
      suggestedFix: 'npm install --legacy-peer-deps',
      docsUrl: 'https://docs.npmjs.com/cli/v10/commands/npm-install#strict-peer-deps',
    }),
  },

  // ============================================================================
  // Git Errors
  // ============================================================================
  {
    name: 'fatal: not a git repository',
    regex: /fatal: not a git repository/i,
    type: 'git_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Not a git repository',
      explanation: 'You are not in a git repository. Initialize one or navigate to an existing repository.',
      suggestedFix: 'git init',
      docsUrl: 'https://git-scm.com/docs/git-init',
    }),
  },
  {
    name: 'fatal: remote origin already exists',
    regex: /fatal: remote origin already exists/i,
    type: 'git_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'Remote origin already exists',
      explanation: 'A remote named "origin" already exists. Remove it first or use a different name.',
      suggestedFix: `# Remove existing origin:\ngit remote remove origin\n# Then add new origin:\ngit remote add origin <url>`,
      docsUrl: 'https://git-scm.com/docs/git-remote',
    }),
  },
  {
    name: 'fatal: refusing to merge unrelated histories',
    regex: /fatal: refusing to merge unrelated histories/i,
    type: 'git_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'Refusing to merge unrelated histories',
      explanation: 'Git prevents merging unrelated commit histories. Use --allow-unrelated-histories if you are sure.',
      suggestedFix: 'git pull origin main --allow-unrelated-histories',
      docsUrl: 'https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---allow-unrelated-histories',
    }),
  },
  {
    name: 'error: failed to push some refs',
    regex: /error: failed to push some refs/i,
    type: 'git_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Failed to push',
      explanation: 'Remote repository has changes you do not have locally. Pull first, then push.',
      suggestedFix: 'git pull --rebase origin main && git push',
      docsUrl: 'https://git-scm.com/docs/git-pull',
    }),
  },

  // ============================================================================
  // Python Errors
  // ============================================================================
  {
    name: 'ModuleNotFoundError',
    regex: /ModuleNotFoundError: No module named '(.+?)'/i,
    type: 'python_error',
    severity: 'error',
    getSuggestion: (match) => {
      const moduleName = match[1] || 'unknown';
      return {
        message: `Python module "${moduleName}" not found`,
        explanation: `The Python module "${moduleName}" is not installed. Install it using pip.`,
        suggestedFix: `pip install ${moduleName}`,
        docsUrl: `https://pypi.org/search/?q=${moduleName}`,
      };
    },
  },
  {
    name: 'SyntaxError',
    regex: /SyntaxError: (.+)/i,
    type: 'python_error',
    severity: 'error',
    getSuggestion: (match) => {
      const errorMsg = match[1] || 'syntax error';
      return {
        message: 'Python syntax error',
        explanation: `Syntax error in your Python code: ${errorMsg}`,
        suggestedFix: '# Check the file and line number mentioned above for syntax errors',
      };
    },
  },
  {
    name: 'IndentationError',
    regex: /IndentationError: (.+)/i,
    type: 'python_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Python indentation error',
      explanation: 'Incorrect indentation in your Python code. Python requires consistent indentation (use 4 spaces).',
      suggestedFix: '# Fix indentation: use 4 spaces (not tabs) consistently',
      docsUrl: 'https://peps.python.org/pep-0008/#indentation',
    }),
  },

  // ============================================================================
  // Build Errors
  // ============================================================================
  {
    name: 'TypeScript Compilation Error',
    regex: /error TS\d+:/i,
    type: 'build_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'TypeScript compilation error',
      explanation: 'TypeScript found type errors in your code. Fix the errors shown above.',
      suggestedFix: '# Run type checking:\nnpx tsc --noEmit',
      docsUrl: 'https://www.typescriptlang.org/docs/handbook/compiler-options.html',
    }),
  },
  {
    name: 'ESLint Error',
    regex: /error\s+(.+?)\s+eslint/i,
    type: 'build_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'ESLint error',
      explanation: 'Code does not pass ESLint rules. Fix linting errors or update .eslintrc config.',
      suggestedFix: 'npm run lint -- --fix',
      docsUrl: 'https://eslint.org/docs/latest/use/command-line-interface',
    }),
  },

  // ============================================================================
  // Permission Errors
  // ============================================================================
  {
    name: 'Permission denied',
    regex: /permission denied|EACCES/i,
    type: 'permission_error',
    severity: 'critical',
    getSuggestion: (match, fullOutput) => {
      // Check if it's npm-related
      if (fullOutput.includes('npm')) {
        return {
          message: 'Permission denied (npm)',
          explanation: 'Permission error. Never use sudo with npm! Fix npm permissions instead.',
          suggestedFix: `# Fix npm permissions:\nmkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'`,
          docsUrl: 'https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally',
        };
      }

      return {
        message: 'Permission denied',
        explanation: 'You do not have permission to access this file or directory.',
        suggestedFix: '# Check file permissions:\nls -la\n# Or fix ownership:\nsudo chown -R $USER:$USER .',
      };
    },
  },

  // ============================================================================
  // Network Errors
  // ============================================================================
  {
    name: 'Network error',
    regex: /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network error/i,
    type: 'network_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Network error',
      explanation: 'Cannot connect to the server. Check your internet connection or the server URL.',
      suggestedFix: '# Check internet connection:\nping 8.8.8.8\n# Check DNS:\nnslookup google.com',
    }),
  },

  // ============================================================================
  // Browser/JavaScript Errors (from forwarded console logs)
  // ============================================================================
  {
    name: 'TypeError: Cannot read property',
    regex: /TypeError: Cannot read propert(?:y|ies) '?(.+?)'? of (undefined|null)/i,
    type: 'syntax_error',
    severity: 'error',
    getSuggestion: (match) => {
      const property = match[1] || 'property';
      const target = match[2] || 'undefined';
      return {
        message: `Cannot read property '${property}' of ${target}`,
        explanation: `Attempting to access property '${property}' on ${target}. Add a null/undefined check before accessing the property.`,
        suggestedFix: `// Add optional chaining:\nobject?.${property}\n\n// Or null check:\nif (object) {\n  object.${property}\n}`,
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining',
      };
    },
  },
  {
    name: 'ReferenceError: not defined',
    regex: /ReferenceError: (.+?) is not defined/i,
    type: 'syntax_error',
    severity: 'error',
    getSuggestion: (match) => {
      const variable = match[1] || 'variable';
      return {
        message: `'${variable}' is not defined`,
        explanation: `The variable '${variable}' is being used before it's declared. Make sure to import or declare it first.`,
        suggestedFix: `// If it's from a library:\nimport { ${variable} } from 'library-name';\n\n// Or declare it:\nconst ${variable} = ...;`,
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Not_defined',
      };
    },
  },
  {
    name: 'Uncaught Error',
    regex: /Uncaught Error: (.+)/i,
    type: 'syntax_error',
    severity: 'error',
    getSuggestion: (match) => {
      const errorMsg = match[1] || 'Unknown error';
      return {
        message: `Uncaught error: ${errorMsg}`,
        explanation: 'An error was thrown but not caught. Wrap the code in a try-catch block or add error boundaries.',
        suggestedFix: `try {\n  // Your code here\n} catch (error) {\n  console.error('Error:', error);\n}`,
        docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch',
      };
    },
  },

  // ============================================================================
  // React Errors
  // ============================================================================
  {
    name: 'React: Rendered more hooks',
    regex: /Rendered (?:fewer|more) hooks than during the previous render/i,
    type: 'syntax_error',
    severity: 'critical',
    getSuggestion: () => ({
      message: 'React hooks order violation',
      explanation: 'React hooks must be called in the same order on every render. Never call hooks inside conditions, loops, or nested functions.',
      suggestedFix: `// ❌ Wrong - conditional hook:\nif (condition) {\n  useState(0); // DON'T DO THIS\n}\n\n// ✅ Correct - unconditional hooks:\nconst [state, setState] = useState(0);\nif (condition) {\n  // Use the state here\n}`,
      docsUrl: 'https://react.dev/warnings/invalid-hook-call-warning',
    }),
  },
  {
    name: 'React: State update on unmounted component',
    regex: /Can't perform a React state update on an unmounted component/i,
    type: 'syntax_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'State update on unmounted component',
      explanation: 'Attempting to update state after component unmounted. This usually happens with async operations. Clean up subscriptions and cancel async operations in useEffect cleanup.',
      suggestedFix: `useEffect(() => {\n  let isMounted = true;\n\n  fetchData().then(data => {\n    if (isMounted) {\n      setState(data);\n    }\n  });\n\n  return () => {\n    isMounted = false; // Cleanup\n  };\n}, []);`,
      docsUrl: 'https://react.dev/learn/synchronizing-with-effects#fetching-data',
    }),
  },
  {
    name: 'React: Objects are not valid as React child',
    regex: /Objects are not valid as a React child/i,
    type: 'syntax_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Cannot render object as React child',
      explanation: 'You cannot directly render JavaScript objects in JSX. Convert objects to strings or render their properties.',
      suggestedFix: `// ❌ Wrong - rendering object:\n<div>{myObject}</div>\n\n// ✅ Correct - render property or JSON:\n<div>{myObject.property}</div>\n// Or:\n<pre>{JSON.stringify(myObject, null, 2)}</pre>`,
      docsUrl: 'https://react.dev/reference/react/Children',
    }),
  },
  {
    name: 'React: Invalid hook call',
    regex: /Invalid hook call|Hooks can only be called inside/i,
    type: 'syntax_error',
    severity: 'critical',
    getSuggestion: () => ({
      message: 'Invalid hook call',
      explanation: 'Hooks can only be called inside React function components or custom hooks. Make sure you are calling hooks at the top level of a function component.',
      suggestedFix: `// ❌ Wrong - calling hook outside component:\nconst value = useState(0);\n\nfunction MyComponent() {\n  return <div>...</div>;\n}\n\n// ✅ Correct - hooks inside component:\nfunction MyComponent() {\n  const [value, setValue] = useState(0);\n  return <div>...</div>;\n}`,
      docsUrl: 'https://react.dev/warnings/invalid-hook-call-warning',
    }),
  },

  // ============================================================================
  // Build Errors (Vite/Webpack)
  // ============================================================================
  {
    name: 'Vite: Failed to resolve import',
    regex: /Failed to resolve import "?(.+?)"? from/i,
    type: 'build_error',
    severity: 'error',
    getSuggestion: (match) => {
      const moduleName = match[1] || 'module';
      return {
        message: `Failed to resolve import '${moduleName}'`,
        explanation: `Cannot find module '${moduleName}'. Make sure it's installed and the path is correct.`,
        suggestedFix: `# Install the package:\nnpm install ${moduleName}\n\n# Or check the import path:\nimport ... from '${moduleName}' // Is this path correct?`,
        docsUrl: 'https://vitejs.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility',
      };
    },
  },
  {
    name: 'Module not found',
    regex: /Module not found: (?:Error: )?Can't resolve '(.+?)'/i,
    type: 'build_error',
    severity: 'error',
    getSuggestion: (match) => {
      const moduleName = match[1] || 'module';
      return {
        message: `Module not found: '${moduleName}'`,
        explanation: `Webpack/bundler cannot find the module '${moduleName}'. Check if it's installed or if the import path is correct.`,
        suggestedFix: `# Install the package:\nnpm install ${moduleName}\n\n# Or fix the import path:\n// Check for typos in the path`,
      };
    },
  },
  {
    name: 'Transform failed',
    regex: /Transform failed with \d+ errors?:/i,
    type: 'build_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Build transform failed',
      explanation: 'The build tool failed to transform your code. Check the error details above for syntax errors or unsupported syntax.',
      suggestedFix: '# Check the syntax errors above\n# Make sure all dependencies are installed:\nnpm install',
    }),
  },

  // ============================================================================
  // Network/Fetch Errors (Browser)
  // ============================================================================
  {
    name: 'Failed to fetch',
    regex: /Failed to fetch|fetch failed/i,
    type: 'network_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'Fetch request failed',
      explanation: 'Network request failed. This could be due to CORS issues, network connectivity, or server being down.',
      suggestedFix: `// Check network in browser DevTools\n// Verify the API endpoint is correct\n// Check for CORS errors in console\n\n// Add error handling:\nfetch(url)\n  .then(res => res.json())\n  .catch(error => {\n    console.error('Fetch error:', error);\n  });`,
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful',
    }),
  },
  {
    name: 'CORS Error',
    regex: /CORS|Cross-Origin Request Blocked|No 'Access-Control-Allow-Origin'/i,
    type: 'network_error',
    severity: 'error',
    getSuggestion: () => ({
      message: 'CORS policy error',
      explanation: 'Cross-Origin Resource Sharing (CORS) policy is blocking the request. The server needs to include proper CORS headers.',
      suggestedFix: `// Backend solution (Express example):\nconst cors = require('cors');\napp.use(cors());\n\n// Or specific origin:\napp.use(cors({\n  origin: 'http://localhost:5173'\n}));`,
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
    }),
  },

  // ============================================================================
  // Console Warnings
  // ============================================================================
  {
    name: 'React: Missing key prop',
    regex: /Warning: Each child in (?:a list|an array) should have a unique "key" prop/i,
    type: 'syntax_error',
    severity: 'warning',
    getSuggestion: () => ({
      message: 'Missing key prop in list',
      explanation: 'When rendering lists in React, each element needs a unique "key" prop for efficient updates.',
      suggestedFix: `// Add unique key to each item:\n{items.map((item) => (\n  <div key={item.id}>\n    {item.name}\n  </div>\n))}\n\n// Use index only as last resort:\n{items.map((item, index) => (\n  <div key={index}>...</div>\n))}`,
      docsUrl: 'https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key',
    }),
  },
  {
    name: 'Deprecated API',
    regex: /Warning: (.+) is deprecated/i,
    type: 'syntax_error',
    severity: 'warning',
    getSuggestion: (match) => {
      const api = match[1] || 'This API';
      return {
        message: `Deprecated API: ${api}`,
        explanation: `${api} is deprecated and may be removed in future versions. Update your code to use the recommended alternative.`,
        suggestedFix: '// Check the warning message for the recommended alternative\n// Update your code to use the new API',
      };
    },
  },
];

/**
 * Detect errors in terminal output
 */
export function detectErrors(output: string): Array<{
  type: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  explanation: string;
  suggestedFix: string;
  docsUrl?: string;
  pattern: string;
  raw: string;
}> {
  const errors: Array<{
    type: string;
    severity: 'warning' | 'error' | 'critical';
    message: string;
    explanation: string;
    suggestedFix: string;
    docsUrl?: string;
    pattern: string;
    raw: string;
  }> = [];

  for (const pattern of ERROR_PATTERNS) {
    const match = output.match(pattern.regex);

    if (match) {
      try {
        const suggestion = pattern.getSuggestion(match, output);

        errors.push({
          type: pattern.type,
          severity: pattern.severity,
          ...suggestion,
          pattern: pattern.name,
          raw: match[0],
        });
      } catch (error) {
        console.error(`[Error Patterns] Failed to generate suggestion for ${pattern.name}:`, error);
      }
    }
  }

  return errors;
}

/**
 * Extract stack trace from error output
 */
export function extractStackTrace(output: string): string | null {
  // Look for common stack trace patterns
  const stackTracePatterns = [
    // Node.js/JavaScript stack trace
    /at\s+.+\s+\(.+:\d+:\d+\)/gm,
    // Python stack trace
    /File\s+".+",\s+line\s+\d+/gm,
    // Java stack trace
    /at\s+[\w.$]+\(.+\.java:\d+\)/gm,
  ];

  for (const pattern of stackTracePatterns) {
    const matches = output.match(pattern);
    if (matches && matches.length > 0) {
      return matches.join('\n');
    }
  }

  return null;
}

/**
 * Sample errors for demo mode
 */
export const SAMPLE_ERRORS = [
  {
    output: 'bash: gti: command not found',
    description: 'Typo in git command',
  },
  {
    output: 'npm ERR! code ENOENT\nnpm ERR! syscall open\nnpm ERR! enoent ENOENT: no such file or directory, open \'/home/user/package.json\'',
    description: 'npm missing package.json',
  },
  {
    output: 'fatal: not a git repository (or any of the parent directories): .git',
    description: 'Not in a git repository',
  },
  {
    output: 'ModuleNotFoundError: No module named \'requests\'',
    description: 'Python module not installed',
  },
  {
    output: 'error TS2304: Cannot find name \'useState\'.',
    description: 'TypeScript error',
  },
  {
    output: 'npm ERR! code EACCES\nnpm ERR! syscall access\nnpm ERR! path /usr/local/lib/node_modules',
    description: 'npm permission error',
  },
  {
    output: 'fatal: refusing to merge unrelated histories',
    description: 'Git merge conflict',
  },
  // Browser/JavaScript errors
  {
    output: '[Browser:Terminal.tsx:123] TypeError: Cannot read property \'focus\' of undefined',
    description: 'Browser: Cannot read property of undefined',
  },
  {
    output: '[Browser:App.tsx:45] ReferenceError: useState is not defined',
    description: 'Browser: Variable not defined',
  },
  {
    output: '[Browser] Warning: Each child in a list should have a unique "key" prop.',
    description: 'React: Missing key prop in list',
  },
  {
    output: '[Browser:Terminal.tsx:67] Error: Can\'t perform a React state update on an unmounted component',
    description: 'React: State update on unmounted component',
  },
  {
    output: '[Browser] Failed to resolve import "@/components/missing-component" from "src/App.tsx"',
    description: 'Vite: Failed to resolve import',
  },
  {
    output: '[Browser:fetch] Failed to fetch http://localhost:8127/api/data',
    description: 'Browser: Fetch failed',
  },
  {
    output: '[Browser] CORS policy: No \'Access-Control-Allow-Origin\' header is present on the requested resource.',
    description: 'Browser: CORS error',
  },
  {
    output: '[Browser:hooks.tsx:12] Error: Rendered more hooks than during the previous render.',
    description: 'React: Hooks order violation',
  },
];
