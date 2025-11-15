import React from "react";
import ReactDOM from "react-dom/client";
import { SimpleTmuxApp } from "./SimpleTmuxApp";
import AppErrorBoundary from "./AppErrorBoundary";
import { setupConsoleForwarding } from "./utils/consoleForwarder";
import { setupKeyboardHandler } from "./utils/keyboardHandler";
import "./index.css";
// CRITICAL: Import xterm.js CSS for proper terminal rendering
import '@xterm/xterm/css/xterm.css';

// Forward browser console logs to backend terminal (for Claude debugging)
setupConsoleForwarding();

// Intercept browser shortcuts that conflict with terminal operations
setupKeyboardHandler();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <SimpleTmuxApp />
    </AppErrorBoundary>
  </React.StrictMode>,
);
