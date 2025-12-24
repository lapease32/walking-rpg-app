import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DistanceDisplayProps {
  distance: number;
  unit?: 'km' | 'mi';
}

/**
 * Display component for showing distance traveled
 */
export default function DistanceDisplay({
  distance,
  unit = 'km',
}: DistanceDisplayProps) {
  const formatDistance = (meters: number): string => {
    if (unit === 'km') {
      const km = meters / 1000;
      return km.toFixed(2);
    }
    // For miles
    const miles = meters / 1609.34;
    return miles.toFixed(2);
  };

  const formatShortDistance = (meters: number): string => {
    if (meters >= 1000) {
      return formatDistance(meters) + (unit === 'km' ? ' km' : ' mi');
    }
    return Math.round(meters) + ' m';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Distance Traveled</Text>
      <Text style={styles.value}>{formatShortDistance(distance)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});

