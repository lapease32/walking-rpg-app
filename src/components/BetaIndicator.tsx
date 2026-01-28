import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppEnvironment } from '../constants/environment';

interface BetaIndicatorProps {
  /**
   * Whether to show the beta indicator
   * Set to false to hide in production builds
   */
  visible?: boolean;
  
  /**
   * Version string to display (optional)
   * e.g., "1.0.0-beta.1"
   */
  version?: string;
  
  /**
   * Build type/environment to display
   * 'development' | 'testing' | 'production'
   */
  buildType?: AppEnvironment;
  
  /**
   * Position of the indicator
   * 'top' - Fixed at top of screen
   * 'bottom' - Fixed at bottom of screen
   * 'inline' - Inline with content (for headers, etc.)
   */
  position?: 'top' | 'bottom' | 'inline';
  
  /**
   * Style variant
   * 'badge' - Small badge style
   * 'banner' - Full-width banner style
   */
  variant?: 'badge' | 'banner';
}

/**
 * Beta indicator component to clearly mark beta/test versions
 * Now displays build type (development, testing, or production) based on environment
 * 
 * Usage:
 * <BetaIndicator visible={true} buildType="testing" version="1.0.0-beta.1" />
 */
export default function BetaIndicator({
  visible = true,
  version,
  buildType,
  position = 'top',
  variant = 'banner',
}: BetaIndicatorProps) {
  if (!visible) {
    return null;
  }

  const isBanner = variant === 'banner';
  const containerStyle = [
    styles.container,
    isBanner ? styles.banner : styles.badge,
    position === 'top' && styles.topPosition,
    position === 'bottom' && styles.bottomPosition,
    // Color based on build type
    buildType === 'development' && styles.developmentBg,
    buildType === 'testing' && styles.testingBg,
    buildType === 'production' && styles.productionBg,
  ];

  // Get display text and icon based on build type
  const getBuildTypeDisplay = () => {
    switch (buildType) {
      case 'development':
        return { icon: '🔧', text: 'DEVELOPMENT BUILD' };
      case 'testing':
        return { icon: '🧪', text: 'TESTING BUILD' };
      case 'production':
        return { icon: '🚀', text: 'PRODUCTION BUILD' };
      default:
        return { icon: '🧪', text: 'BETA VERSION' };
    }
  };

  const { icon, text } = getBuildTypeDisplay();

  return (
    <View style={containerStyle}>
      <Text style={[styles.text, isBanner && styles.bannerText]}>
        {icon} {text}
      </Text>
      {version && (
        <Text style={[styles.versionText, isBanner && styles.bannerVersionText]}>
          {version}
        </Text>
      )}
      {isBanner && buildType === 'testing' && (
        <Text style={styles.warningText}>
          This is a test version. Features may be incomplete or unstable.
        </Text>
      )}
      {isBanner && buildType === 'development' && (
        <Text style={styles.warningText}>
          Development build. Debug features enabled.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FF9800', // Default/testing color
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  developmentBg: {
    backgroundColor: '#2196F3', // Blue for development
  },
  testingBg: {
    backgroundColor: '#FF9800', // Orange for testing
  },
  productionBg: {
    backgroundColor: '#4CAF50', // Green for production
  },
  banner: {
    width: '100%',
    paddingVertical: 12,
  },
  badge: {
    borderRadius: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  topPosition: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bottomPosition: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bannerText: {
    fontSize: 14,
    marginBottom: 4,
  },
  versionText: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.9,
    marginTop: 2,
    textAlign: 'center',
  },
  bannerVersionText: {
    fontSize: 11,
    marginBottom: 4,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.85,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
