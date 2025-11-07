import React from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Link,
  Image,
  Table,
  Minus,
  CheckSquare,
  FileCode,
  Strikethrough,
  Highlighter,
} from 'lucide-react';

interface MarkdownToolbarProps {
  onInsert: (before: string, after?: string, defaultText?: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onInsert, textareaRef }) => {
  const insertFormatting = (before: string, after?: string, defaultText?: string) => {
    onInsert(before, after, defaultText);
  };

  const insertCodeBlock = (language: string = '') => {
    insertFormatting(`\n\`\`\`${language}\n`, '\n```\n', 'code here');
  };

  const insertTable = () => {
    const table = '\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n';
    insertFormatting(table, '', '');
  };

  const buttons = [
    { icon: Heading1, title: 'Heading 1', action: () => insertFormatting('# ', '', 'Heading 1') },
    { icon: Heading2, title: 'Heading 2', action: () => insertFormatting('## ', '', 'Heading 2') },
    { icon: Heading3, title: 'Heading 3', action: () => insertFormatting('### ', '', 'Heading 3') },
    { separator: true },
    { icon: Bold, title: 'Bold (Ctrl+B)', action: () => insertFormatting('**', '**', 'bold text') },
    { icon: Italic, title: 'Italic (Ctrl+I)', action: () => insertFormatting('*', '*', 'italic text') },
    { icon: Strikethrough, title: 'Strikethrough', action: () => insertFormatting('~~', '~~', 'strikethrough') },
    { icon: Highlighter, title: 'Highlight', action: () => insertFormatting('==', '==', 'highlighted') },
    { separator: true },
    { icon: Code, title: 'Inline Code', action: () => insertFormatting('`', '`', 'code') },
    { icon: FileCode, title: 'Code Block', action: () => insertCodeBlock() },
    { separator: true },
    { icon: List, title: 'Bullet List', action: () => insertFormatting('- ', '', 'List item') },
    { icon: ListOrdered, title: 'Numbered List', action: () => insertFormatting('1. ', '', 'List item') },
    { icon: CheckSquare, title: 'Task List', action: () => insertFormatting('- [ ] ', '', 'Task') },
    { separator: true },
    { icon: Quote, title: 'Quote', action: () => insertFormatting('> ', '', 'Quote') },
    { icon: Link, title: 'Link', action: () => insertFormatting('[', '](url)', 'link text') },
    { icon: Image, title: 'Image', action: () => insertFormatting('![', '](url)', 'alt text') },
    { icon: Table, title: 'Table', action: () => insertTable() },
    { icon: Minus, title: 'Horizontal Rule', action: () => insertFormatting('\n---\n', '', '') },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        flexWrap: 'wrap',
      }}
    >
      {buttons.map((button, index) => {
        if (button.separator) {
          return (
            <div
              key={`separator-${index}`}
              style={{
                width: '1px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.2)',
                margin: '0 4px',
              }}
            />
          );
        }

        const Icon = button.icon!;
        return (
          <button
            key={index}
            onClick={button.action}
            title={button.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 200, 87, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(255, 200, 87, 0.4)';
              e.currentTarget.style.color = '#ffc857';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            <Icon size={16} />
          </button>
        );
      })}

      {/* Language selector for code blocks */}
      <select
        onChange={(e) => insertCodeBlock(e.target.value)}
        style={{
          marginLeft: '8px',
          padding: '6px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
        defaultValue=""
      >
        <option value="" disabled>Code language...</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="bash">Bash</option>
        <option value="json">JSON</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="markdown">Markdown</option>
        <option value="sql">SQL</option>
        <option value="yaml">YAML</option>
      </select>
    </div>
  );
};

export default MarkdownToolbar;