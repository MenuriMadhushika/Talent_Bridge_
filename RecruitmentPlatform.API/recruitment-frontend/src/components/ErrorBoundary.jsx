import { Component } from "react";

export default class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error("Uncaught error:", error, info);
        // send to error tracking here (Sentry, etc.) if you use one
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 32, textAlign: "center" }}>
                    <h2>Something went wrong.</h2>
                    <button onClick={() => window.location.reload()}>Reload</button>
                </div>
            );
        }
        return this.props.children;
    }
}