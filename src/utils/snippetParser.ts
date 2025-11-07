/**
 * VS Code Snippet Parser for Prompt Templates
 * Supports:
 * - Basic placeholders: ${1:default}
 * - Choice placeholders: ${1|option1,option2|}
 * - Variables: ${TM_FILENAME}, ${CURRENT_DATE}
 * - Linked placeholders: ${1:name} repeated as ${1}
 * - Nested placeholders: ${1:${2:nested}}
 */

export interface SnippetField {
  index: number;
  name: string;
  defaultValue?: string;
  choices?: string[];
  isVariable?: boolean;
  variableName?: string;
  positions: number[]; // Track all positions where this field appears
}

export interface ParsedSnippet {
  fields: Map<number, SnippetField>;
  variables: Set<string>;
  template: string;
  maxTabStop: number;
}

// VS Code variables we support
export const SNIPPET_VARIABLES: Record<string, () => string> = {
  TM_FILENAME: () => {
    // Get current active file name from canvas or return placeholder
    const activeFile = (window as any).activeFileName || 'current_file.ts';
    return activeFile.split('/').pop() || activeFile;
  },
  TM_FILENAME_BASE: () => {
    const filename = SNIPPET_VARIABLES.TM_FILENAME();
    return filename.replace(/\.[^/.]+$/, '');
  },
  TM_DIRECTORY: () => {
    const activeFile = (window as any).activeFileName || '/home/matt/workspace';
    return activeFile.substring(0, activeFile.lastIndexOf('/')) || '/home/matt/workspace';
  },
  TM_FILEPATH: () => (window as any).activeFileName || '/home/matt/workspace/file.ts',
  CURRENT_YEAR: () => new Date().getFullYear().toString(),
  CURRENT_MONTH: () => String(new Date().getMonth() + 1).padStart(2, '0'),
  CURRENT_DATE: () => String(new Date().getDate()).padStart(2, '0'),
  CURRENT_HOUR: () => String(new Date().getHours()).padStart(2, '0'),
  CURRENT_MINUTE: () => String(new Date().getMinutes()).padStart(2, '0'),
  CURRENT_SECOND: () => String(new Date().getSeconds()).padStart(2, '0'),
  CLIPBOARD: () => '', // Clipboard requires async, return empty string for now
  WORKSPACE_NAME: () => 'opustrator',
  RANDOM: () => Math.random().toString(36).substring(7),
  UUID: () => crypto.randomUUID(),
};

export function parseSnippet(template: string): ParsedSnippet {
  const fields = new Map<number, SnippetField>();
  const variables = new Set<string>();
  let maxTabStop = 0;

  // Regular expressions for different placeholder types
  const placeholderRegex = /\$\{(\d+)(?::([^}|]+))?\}/g; // ${1} or ${1:default}
  const choiceRegex = /\$\{(\d+)\|([^}]+)\|}/g; // ${1|option1,option2|}
  const variableRegex = /\$\{([A-Z_]+(?:_[A-Z]+)*)\}/g; // ${TM_FILENAME}
  const nestedVarRegex = /\$\{(\d+):\$\{([A-Z_]+(?:_[A-Z]+)*):?([^}]*)\}\}/g; // ${1:${TM_FILENAME:default}}

  // First pass: Find all variables
  let match;
  while ((match = variableRegex.exec(template)) !== null) {
    const varName = match[1];
    if (SNIPPET_VARIABLES[varName]) {
      variables.add(varName);
    }
  }

  // Second pass: Find nested variables with tab stops
  template = template.replace(nestedVarRegex, (fullMatch, tabStop, varName, fallback, offset) => {
    const index = parseInt(tabStop);
    maxTabStop = Math.max(maxTabStop, index);

    if (!fields.has(index)) {
      fields.set(index, {
        index,
        name: varName.toLowerCase().replace(/_/g, ' '),
        defaultValue: fallback || varName,
        isVariable: true,
        variableName: varName,
        positions: [offset]
      });
    }

    if (SNIPPET_VARIABLES[varName]) {
      variables.add(varName);
    }

    return fullMatch;
  });

  // Third pass: Find choice placeholders
  template.replace(choiceRegex, (match, tabStop, choiceStr, offset) => {
    const index = parseInt(tabStop);
    maxTabStop = Math.max(maxTabStop, index);

    const choices = choiceStr.split(',').map((s: string) => s.trim());

    if (!fields.has(index)) {
      fields.set(index, {
        index,
        name: `choice_${index}`,
        choices,
        defaultValue: choices[0],
        positions: [offset]
      });
    } else {
      fields.get(index)!.positions.push(offset);
    }

    return match;
  });

  // Fourth pass: Find basic placeholders
  template.replace(placeholderRegex, (match, tabStop, defaultVal, offset) => {
    const index = parseInt(tabStop);
    maxTabStop = Math.max(maxTabStop, index);

    if (!fields.has(index)) {
      const name = defaultVal || `field_${index}`;
      fields.set(index, {
        index,
        name: name.toLowerCase().replace(/_/g, ' '),
        defaultValue: defaultVal || '',
        positions: [offset]
      });
    } else {
      // This is a linked placeholder (appears multiple times)
      fields.get(index)!.positions.push(offset);
    }

    return match;
  });

  return {
    fields,
    variables,
    template,
    maxTabStop
  };
}

export function renderSnippet(
  template: string,
  values: Map<number, string>,
  resolveVariables: boolean = true
): string {
  let result = template;

  // Replace variables first
  if (resolveVariables) {
    for (const [varName, resolver] of Object.entries(SNIPPET_VARIABLES)) {
      const regex = new RegExp(`\\$\\{${varName}(?::([^}]+))?\\}`, 'g');
      result = result.replace(regex, (match, fallback) => {
        try {
          const value = resolver();
          return value || fallback || varName;
        } catch {
          return fallback || varName;
        }
      });
    }
  }

  // Replace tab stops with values
  // Sort by index descending to avoid replacing partial matches
  const sortedEntries = Array.from(values.entries()).sort((a, b) => b[0] - a[0]);

  for (const [index, value] of sortedEntries) {
    // Replace all occurrences of this tab stop
    const patterns = [
      new RegExp(`\\$\\{${index}\\|[^}]+\\|}`, 'g'), // Choice
      new RegExp(`\\$\\{${index}:([^}]+)\\}`, 'g'),  // With default
      new RegExp(`\\$\\{${index}\\}`, 'g'),          // Plain
      new RegExp(`\\$\\{${index}:\\$\\{[^}]+\\}\\}`, 'g'), // Nested
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, value);
    }
  }

  return result;
}

export function getNextTabStop(
  currentIndex: number,
  maxIndex: number,
  direction: 'forward' | 'backward'
): number {
  if (direction === 'forward') {
    return currentIndex < maxIndex ? currentIndex + 1 : 1;
  } else {
    return currentIndex > 1 ? currentIndex - 1 : maxIndex;
  }
}

// Transform functions for advanced snippets
export const TRANSFORMS: Record<string, (input: string) => string> = {
  upcase: (s) => s.toUpperCase(),
  downcase: (s) => s.toLowerCase(),
  capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  pascalcase: (s) => s.replace(/(^|[_-])([a-z])/g, (_, __, letter) => letter.toUpperCase()),
  camelcase: (s) => {
    const pascal = TRANSFORMS.pascalcase(s);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  },
  snakecase: (s) => s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
  kebabcase: (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
};