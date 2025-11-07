import React, { useState } from "react";
import "./FileCreationModal.css";
import { DirectorySelector } from "./DirectorySelector";

interface FileCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileCreated?: (path: string) => void;
  initialPath?: string;
}

export const FileCreationModal: React.FC<FileCreationModalProps> = ({
  isOpen,
  onClose,
  onFileCreated,
  initialPath = "/home/matt/workspace",
}) => {
  const [filePath, setFilePath] = useState(initialPath);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileType, setFileType] = useState("md");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [showDirSelector, setShowDirSelector] = useState(false);

  const templates: Record<string, string> = {
    md: `# ${fileName || "New Document"}\n\n## Overview\n\n## Details\n\n## Notes\n`,
    json: `{\n  "name": "${fileName || "config"}",\n  "description": "",\n  "version": "1.0.0"\n}`,
    txt: "",
    js: `// ${fileName || "script"}.js\n\nfunction main() {\n  console.log('Hello, world!');\n}\n\nmain();`,
    ts: `// ${fileName || "module"}.ts\n\nexport function hello(name: string): string {\n  return \`Hello, \${name}!\`;\n}`,
    tsx: `// ${fileName || "component"}.tsx\n\nimport React from 'react';\n\ninterface ${fileName || "Component"}Props {\n  // Add props here\n}\n\nexport const ${fileName || "Component"}: React.FC<${fileName || "Component"}Props> = (props) => {\n  return (\n    <div>\n      <h1>${fileName || "Component"}</h1>\n    </div>\n  );\n};`,
    jsx: `// ${fileName || "component"}.jsx\n\nimport React from 'react';\n\nexport const ${fileName || "Component"} = (props) => {\n  return (\n    <div>\n      <h1>${fileName || "Component"}</h1>\n    </div>\n  );\n};`,
    py: `#!/usr/bin/env python3\n# ${fileName || "script"}.py\n\ndef main():\n    print("Hello, world!")\n\nif __name__ == "__main__":\n    main()`,
    sh: `#!/bin/bash\n# ${fileName || "script"}.sh\n\necho "Hello, world!"`,
    yaml: `# ${fileName || "config"}.yaml\nname: ${fileName || "config"}\nversion: 1.0.0\n`,
    yml: `# ${fileName || "config"}.yml\nname: ${fileName || "config"}\nversion: 1.0.0\n`,
    css: `/* ${fileName || "styles"}.css */\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n}`,
    scss: `// ${fileName || "styles"}.scss\n\n$primary-color: #007bff;\n$secondary-color: #6c757d;\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n}`,
    html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${fileName || "Document"}</title>\n</head>\n<body>\n  <h1>Hello, world!</h1>\n</body>\n</html>`,
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <item>Content</item>\n</root>`,
    toml: `# ${fileName || "config"}.toml\n\ntitle = "${fileName || "Config"}"\nversion = "1.0.0"`,
    env: `# Environment variables\nNODE_ENV=development\nPORT=3000\n`,
    gitignore: `# Dependencies\nnode_modules/\n\n# Build\ndist/\nbuild/\n\n# Environment\n.env\n.env.local\n\n# IDE\n.vscode/\n.idea/\n\n# OS\n.DS_Store\nThumbs.db`,
    dockerfile: `FROM node:18-alpine\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm ci --only=production\n\nCOPY . .\n\nEXPOSE 3000\n\nCMD ["node", "server.js"]`,
  };

  const handleCreate = async () => {
    if (!fileName.trim()) {
      setError("Please enter a file name");
      return;
    }

    const fullPath = `${filePath}/${fileName}${fileName.includes(".") ? "" : `.${fileType}`}`;
    const content = fileContent || templates[fileType] || "";

    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("http://localhost:8127/api/files/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: fullPath,
          content,
        }),
      });

      if (response.ok) {
        onFileCreated?.(fullPath);
        onClose();
        // Reset form
        setFileName("");
        setFileContent("");
        setFileType("md");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create file");
      }
    } catch (err) {
      setError("Failed to create file: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="file-creation-modal-overlay" onClick={onClose}>
      <div className="file-creation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-creation-header">
          <h2>📝 Create New File</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="file-creation-body">
          <div className="form-group">
            <label>Directory Path</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/home/matt/workspace"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowDirSelector(true)}
                className="browse-btn"
                style={{
                  padding: "8px 16px",
                  background: "rgba(96, 165, 250, 0.1)",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                  borderRadius: "6px",
                  color: "#60a5fa",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>File Name</label>
            <div className="file-name-input">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="my-document"
                autoFocus
              />
              {!fileName.includes(".") && (
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="file-type-select"
                >
                  <option value="md">.md</option>
                  <option value="json">.json</option>
                  <option value="txt">.txt</option>
                  <option value="js">.js</option>
                  <option value="ts">.ts</option>
                  <option value="tsx">.tsx</option>
                  <option value="jsx">.jsx</option>
                  <option value="py">.py</option>
                  <option value="sh">.sh</option>
                  <option value="yaml">.yaml</option>
                  <option value="yml">.yml</option>
                  <option value="css">.css</option>
                  <option value="scss">.scss</option>
                  <option value="html">.html</option>
                  <option value="xml">.xml</option>
                  <option value="toml">.toml</option>
                  <option value="env">.env</option>
                  <option value="gitignore">.gitignore</option>
                  <option value="dockerfile">Dockerfile</option>
                </select>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>
              Initial Content
              <span className="optional">
                (optional - will use template if empty)
              </span>
            </label>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder={templates[fileType] || "Enter initial content..."}
              rows={10}
            />
          </div>

          {error && <div className="error-message">⚠️ {error}</div>}
        </div>

        <div className="file-creation-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="create-btn"
            onClick={handleCreate}
            disabled={isCreating || !fileName.trim()}
          >
            {isCreating ? "Creating..." : "✨ Create File"}
          </button>
        </div>
      </div>

      {/* Directory Selector Modal */}
      {showDirSelector && (
        <DirectorySelector
          isOpen={showDirSelector}
          currentPath={filePath}
          fileSelectionMode={false}
          onSelect={(path) => {
            setFilePath(path);
            setShowDirSelector(false);
          }}
          onClose={() => setShowDirSelector(false)}
        />
      )}
    </div>
  );
};
