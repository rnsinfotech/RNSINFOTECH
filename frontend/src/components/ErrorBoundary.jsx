import React from "react";
import { ErrorState } from "./ui/Stateviews";
import { reportClientError } from "../lib/errorReporter";

/**
 * ErrorBoundary — catches render/runtime errors in its subtree so one
 * broken page can't blank the entire app. Placed once around <Routes>
 * in App.jsx; resets automatically when the route (children) changes.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError(error, { componentStack: info?.componentStack });
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rns-container" style={{ padding: "80px 0" }}>
          <ErrorState
            title="This page hit a snag"
            message="Something went wrong while rendering this page. Try reloading, or head back home."
            action={{ label: "Reload page", onClick: () => window.location.reload() }}
            secondaryAction={{ label: "Go home", href: "/" }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
