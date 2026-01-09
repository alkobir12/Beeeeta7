import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Ignore translation-related errors
    if (error.message && (
      error.message.includes('removeChild') ||
      error.message.includes('Maximum call stack') ||
      error.message.includes('NotFoundError')
    )) {
      console.log('Translation error caught and ignored');
      this.setState({ hasError: false });
      return;
    }
    console.error('Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
