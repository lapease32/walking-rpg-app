import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { Location } from '../models/Encounter';

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface LocationData extends Location {
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface DistanceData {
  incremental: number;
  total: number;
  location: LocationData; // Current location when distance was calculated
}

type LocationUpdateCallback = (location: LocationData) => void;
type DistanceUpdateCallback = (distanceData: DistanceData) => void | Promise<void>;

// 1 km/h in m/s — below this we consider the user stationary
const LOW_SPEED_THRESHOLD_MS = 1 / 3.6;
// How many consecutive low-speed readings (at 5s intervals ≈ 15s) before downgrading
const LOW_SPEED_READINGS_TO_DOWNGRADE = 3;

/**
 * Location Service
 * Handles GPS tracking, distance calculation, and movement monitoring
 */
class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private totalDistance: number = 0; // meters
  private onLocationUpdate: LocationUpdateCallback | null = null;
  private onDistanceUpdate: DistanceUpdateCallback | null = null;
  private isTracking: boolean = false;
  private isHighAccuracy: boolean = true;
  private consecutiveLowSpeedReadings: number = 0;

  private readonly getCurrentPositionConfig = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000,
  };

  private readonly highAccuracyWatchConfig = {
    enableHighAccuracy: true,
    distanceFilter: 5,
    showsBackgroundLocationIndicator: true,
    interval: 5000,
    fastestInterval: 2000,
  };

  // Used when stationary: drops GPS chip usage to network-based location.
  // Battery draw falls from ~150–300 mW to ~5–15 mW while the user isn't moving.
  private readonly lowAccuracyWatchConfig = {
    enableHighAccuracy: false,
    distanceFilter: 30,
    showsBackgroundLocationIndicator: true,
    interval: 30000,
    fastestInterval: 15000,
  };

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const result = await Geolocation.requestAuthorization('always');
      return result === 'granted';
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Walking RPG needs your location to track movement and trigger encounters.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  /**
   * Get current location (one-time)
   */
  getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed || 0,
            timestamp: position.timestamp,
          };
          this.currentLocation = location;
          resolve(location);
        },
        (error: GeolocationError) => {
          reject(error);
        },
        this.getCurrentPositionConfig,
      );
    });
  }

  /**
   * Start tracking location continuously
   */
  startTracking(
    onLocationUpdate: LocationUpdateCallback,
    onDistanceUpdate: DistanceUpdateCallback,
  ): void {
    if (this.isTracking) {
      console.warn('Location tracking is already active');
      return;
    }

    this.onLocationUpdate = onLocationUpdate;
    this.onDistanceUpdate = onDistanceUpdate;
    this.isTracking = true;
    this.isHighAccuracy = true;
    this.consecutiveLowSpeedReadings = 0;

    // Get initial location
    this.getCurrentLocation()
      .then(location => {
        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }
      })
      .catch(error => {
        console.error('Error getting initial location:', error);
      });

    this.startWatch();
  }

  private startWatch(): void {
    this.watchId = Geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed || 0, // m/s
          timestamp: position.timestamp,
        };

        // switchAccuracyMode resets currentLocation to null before restarting the
        // watch. The first callback after a restart is the cached last-known position
        // with speed=null. Without this guard, the null-speed branch below would
        // immediately revert to high-accuracy, defeating the battery saving before it begins.
        const isFirstCallbackAfterSwitch = this.currentLocation === null && !this.isHighAccuracy;

        // Calculate distance if we have a previous location
        if (this.currentLocation) {
          const distance = this.calculateDistance(
            this.currentLocation.latitude,
            this.currentLocation.longitude,
            location.latitude,
            location.longitude,
          );

          // Only accumulate distance from high-accuracy GPS readings. Network-based
          // positions in low-accuracy mode drift 100–500 m even while stationary,
          // which would grant phantom distance and trigger unearned encounters.
          if (distance >= 1 && distance < 1000 && this.isHighAccuracy) {
            this.totalDistance += distance;

            if (this.onDistanceUpdate) {
              const result = this.onDistanceUpdate({
                incremental: distance,
                total: this.totalDistance,
                location: location,
              });
              // Handle async callbacks that return promises
              if (result instanceof Promise) {
                result.catch(error => {
                  console.error('Error in distance update callback:', error);
                });
              }
            }
          }
        }

        this.currentLocation = location;

        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }

        // Adapt GPS accuracy to movement. Network providers (low-accuracy mode)
        // never populate speed, so handle both cases:
        if (position.coords.speed !== null) {
          this.updateAccuracyMode(position.coords.speed);
        } else if (!this.isHighAccuracy && !isFirstCallbackAfterSwitch) {
          // speed=null in low-accuracy mode means the network provider fired a
          // location update — which only happens when the user moved ≥30 m
          // (our distanceFilter). Restore high-accuracy so the GPS chip can
          // report reliable speed and distance again.
          this.switchAccuracyMode(true);
        }
      },
      (error: GeolocationError) => {
        console.error('Location tracking error:', error);
        if (error.code === 1) {
          console.error('Location permission denied');
        } else if (error.code === 2) {
          console.error('Location position unavailable');
        } else if (error.code === 3) {
          console.error('Location request timeout');
        }
      },
      this.isHighAccuracy ? this.highAccuracyWatchConfig : this.lowAccuracyWatchConfig,
    );
  }

  private updateAccuracyMode(speedMs: number): void {
    if (speedMs < LOW_SPEED_THRESHOLD_MS) {
      this.consecutiveLowSpeedReadings++;
      if (
        this.isHighAccuracy &&
        this.consecutiveLowSpeedReadings >= LOW_SPEED_READINGS_TO_DOWNGRADE
      ) {
        this.switchAccuracyMode(false);
      }
    } else {
      this.consecutiveLowSpeedReadings = 0;
      if (!this.isHighAccuracy) {
        this.switchAccuracyMode(true);
      }
    }
  }

  private switchAccuracyMode(toHighAccuracy: boolean): void {
    this.isHighAccuracy = toHighAccuracy;
    this.consecutiveLowSpeedReadings = 0;
    // Reset the anchor point so the position jump between network coordinates
    // and the first GPS fix isn't counted as travelled distance.
    this.currentLocation = null;
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.startWatch();
  }

  /**
   * Stop tracking location
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.onLocationUpdate = null;
    this.onDistanceUpdate = null;
  }

  /**
   * Get current location (from cache)
   */
  getCurrentLocationCached(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Get total distance traveled
   */
  getTotalDistance(): number {
    return this.totalDistance;
  }

  /**
   * Reset distance counter
   */
  resetDistance(): void {
    this.totalDistance = 0;
  }

  /**
   * Get current speed in km/h
   */
  getCurrentSpeed(): number {
    if (!this.currentLocation || !this.currentLocation.speed) {
      return 0;
    }
    // Convert m/s to km/h
    return this.currentLocation.speed * 3.6;
  }

  /**
   * Check if user is walking (speed between 3-8 km/h)
   */
  isWalking(): boolean {
    const speed = this.getCurrentSpeed();
    return speed >= 3 && speed <= 8;
  }

  /**
   * Check if location tracking is currently active
   */
  getIsTracking(): boolean {
    return this.isTracking;
  }
}

// Export singleton instance
export default new LocationService();
