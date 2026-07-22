import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Failed to find #root element in index.html");
}

const app = (
    <BrowserRouter>
        <AuthProvider>
            <App />
        </AuthProvider>
    </BrowserRouter>
);

const isDev = import.meta.env.DEV;

ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
        {isDev ? <React.StrictMode>{app}</React.StrictMode> : app}
    </ErrorBoundary>
);