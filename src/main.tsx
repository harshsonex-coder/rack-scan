import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode is left out on purpose: in development it starts the camera twice.
createRoot(document.getElementById("root")!).render(<App />);
