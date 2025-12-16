import React from 'react';
import logger from '@/components/utils/logger';
import ErrorState from '@/components/common/ErrorState';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary', 'Unhandled error in child tree', { 
      error: error.message,
      stack: errorInfo.componentStack 
    });
  }

  render() {
    if (this.state.hasError) {
      const { fallbackMessage } = this.props;
      return (
        <div className="p-6 flex justify-center items-center min-h-[400px]">
          <ErrorState 
            title="Something went wrong"
            message={fallbackMessage || "Something went wrong loading this section. Please refresh."}
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }

    return this.props.children;
  }
}