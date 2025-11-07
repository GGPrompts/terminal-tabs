import React from "react";
import ReactDOM from "react-dom/client";
import SimpleTerminalApp from "./SimpleTerminalApp";
import AppErrorBoundary from "./AppErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <SimpleTerminalApp />
    </AppErrorBoundary>
  </React.StrictMode>,
);
