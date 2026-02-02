import { Component, type ReactNode } from 'react';
import { Button } from './Button';
import { Card, CardContent } from './Card';

interface Props {
  children: ReactNode;
  viewName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for wrapping views
 * Catches JavaScript errors and displays a fallback UI
 */
export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.viewName || 'view'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-8">
              <div className="text-4xl mb-4 text-rose-400">⚠</div>
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-text-secondary mb-4">
                {this.props.viewName
                  ? `An error occurred in the ${this.props.viewName} view.`
                  : 'An unexpected error occurred.'}
              </p>
              {this.state.error && (
                <p className="text-sm text-text-muted mb-4 font-mono bg-surface-elevated p-2 rounded overflow-auto max-h-24">
                  {this.state.error.message}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
                <Button onClick={this.handleRetry}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
