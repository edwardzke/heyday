import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const viewFromDataset = rootElement.dataset.view;
const initialView =
  viewFromDataset === "dashboard" ? "dashboard" : "landing";

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App initialView={initialView} />
  </React.StrictMode>
);
