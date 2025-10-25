import React from "react";
import "./index.css";
import { Dashboard } from "./views/Dashboard";
import { LandingPage } from "./views/LandingPage";

type AppView = "landing" | "dashboard";

export interface AppProps {
  initialView?: AppView;
}

function resolveView(initialView?: AppView): AppView {
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const pathView: AppView = path.startsWith("/dashboard") ? "dashboard" : "landing";

  if (initialView === "dashboard" || pathView === "dashboard") {
    return "dashboard";
  }

  return "landing";
}

export function App({ initialView }: AppProps) {
  const view = resolveView(initialView);

  if (view === "dashboard") {
    return <Dashboard />;
  }

  return <LandingPage />;
}

export default App;
