import React, { useState, useEffect } from "react";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL;

async function fetchMessage() {
  const res = await fetch(`${API_URL}/hello/`);
  const data = await res.json();
  console.log(data);
}

export function App() {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/hello/`)
      .then((res) => res.json())
      .then((data) => setMsg(data.message))
      .catch((err) => console.error("Fetch error:", err));
  }, []);

  return <h1>{msg || "Loading..."}</h1>;
}

export default App;
