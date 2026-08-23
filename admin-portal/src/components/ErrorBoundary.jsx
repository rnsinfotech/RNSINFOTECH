import React from 'react';
import { reportClientError } from '../lib/errorReporter';
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { reportClientError(error, { componentStack: info?.componentStack }); }
  componentDidUpdate(prevProps) { if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() { if (this.state.error) return <main style={{ padding: 32 }}><h1>Something went wrong</h1><p>Please reload the page and try again.</p><button onClick={() => window.location.reload()}>Reload</button></main>; return this.props.children; }
}
