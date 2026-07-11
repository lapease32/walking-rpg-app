import logger from '../utils/logger';
import { useState, useRef, useEffect } from 'react';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import BatteryOptimizationService from '../services/BatteryOptimizationService';
import { saveTrackingState } from '../utils/storage';

export function useLocation() {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const currentLocationRef = useRef<LocationData | null>(null);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const handleLocationUpdate = (location: LocationData): void => {
    currentLocationRef.current = location;
    setCurrentLocation(location);
  };

  const startTracking = async (
    onDistanceUpdate: (data: DistanceData) => Promise<void>,
  ): Promise<void> => {
    const granted = await LocationService.requestPermission();
    if (!granted) {
      logger.warn('Location permission denied — tracking not started');
      return;
    }
    // Android only, once: ask the OS to exempt us from battery optimization so Doze / OEM killers
    // don't suspend background GPS while walking. Fire-and-forget — never blocks tracking start.
    BatteryOptimizationService.maybeRequestExemption().catch(console.error);
    LocationService.startTracking(handleLocationUpdate, onDistanceUpdate);
    setIsTracking(true);
    saveTrackingState(true);
    AnalyticsService.trackingStarted();
    NotificationService.startForegroundService().catch(console.error);
  };

  const stopTracking = (): void => {
    LocationService.stopTracking();
    setIsTracking(false);
    saveTrackingState(false);
    AnalyticsService.trackingStopped();
    NotificationService.stopForegroundService().catch(console.error);
  };

  return {
    isTracking,
    currentDistance,
    setCurrentDistance,
    currentLocation,
    setCurrentLocation,
    currentLocationRef,
    startTracking,
    stopTracking,
  };
}
