import logger from '../../utils/logger';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import CrashlyticsService from '../../services/CrashlyticsService';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Report to Crashlytics ONCE here, with the ReactRenderError label. The logger call below is
    // dev-console-only (debug does not forward) — using logger.error would double-report + drop the label.
    CrashlyticsService.recordError(error, 'ReactRenderError');
    logger.debug('ErrorBoundary caught a render error:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app encountered an unexpected error. Your progress is saved — tap below to try again.
        </Text>
        {__DEV__ && this.state.error && (
          <ScrollView style={styles.devBox}>
            <Text style={styles.devText}>{this.state.error.toString()}</Text>
          </ScrollView>
        )}
        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

/**
 * Deliberately NOT themed. ErrorBoundary is a class component (React requires one for
 * componentDidCatch) so it can't use the useTheme hook — and, more importantly, it sits ABOVE the
 * ThemeProvider in the tree and renders precisely when the app has already failed. Depending on the
 * theme context here would mean the crash screen could itself crash. So it hardcodes the NIGHT
 * palette's values: always readable, zero dependencies.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E', // NIGHT.bg
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ECE7EA', // NIGHT.text
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#A09AA2', // NIGHT.textSecondary
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    backgroundColor: '#14141B', // NIGHT.surface
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    width: '100%',
    marginBottom: 24,
  },
  devText: {
    color: '#C4453B', // NIGHT.danger
    fontSize: 12,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#FF6A2A', // NIGHT.accent
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#14141B', // NIGHT.onAccent
    fontSize: 16,
    fontWeight: '600',
  },
});
