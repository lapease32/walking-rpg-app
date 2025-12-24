import Geolocation from '@react-native-community/geolocation';
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
}

type LocationUpdateCallback = (location: LocationData) => void;
type DistanceUpdateCallback = (distanceData: DistanceData) => void;

/**
 * Location Service
 * Handles GPS tracking, distance calculation, and movement monitoring
 */
class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private previousLocation: LocationData | null = null;
  private totalDistance: number = 0; // meters
  private onLocationUpdate: LocationUpdateCallback | null = null;
  private onDistanceUpdate: DistanceUpdateCallback | null = null;
  private isTracking: boolean = false;
  private config = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000,
    distanceFilter: 5, // Minimum distance (in meters) to trigger update
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
        this.config
      );
    });
  }

  /**
   * Start tracking location continuously
   */
  startTracking(
    onLocationUpdate: LocationUpdateCallback,
    onDistanceUpdate: DistanceUpdateCallback
  ): void {
    if (this.isTracking) {
      console.warn('Location tracking is already active');
      return;
    }

    this.onLocationUpdate = onLocationUpdate;
    this.onDistanceUpdate = onDistanceUpdate;
    this.isTracking = true;

    // Get initial location
    this.getCurrentLocation()
      .then((location) => {
        this.previousLocation = location;
        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }
      })
      .catch((error) => {
        console.error('Error getting initial location:', error);
      });

    // Watch for position changes
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

        // Calculate distance if we have a previous location
        if (this.previousLocation) {
          const distance = this.calculateDistance(
            this.previousLocation.latitude,
            this.previousLocation.longitude,
            location.latitude,
            location.longitude
          );

          // Only add distance if it's reasonable (filters out GPS jumps)
          if (distance < 1000 && distance > 0) {
            // Ignore if more than 1km (likely GPS error)
            this.totalDistance += distance;

            if (this.onDistanceUpdate) {
              this.onDistanceUpdate({
                incremental: distance,
                total: this.totalDistance,
              });
            }
          }
        }

        this.previousLocation = this.currentLocation;
        this.currentLocation = location;

        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }
      },
      (error: GeolocationError) => {
        console.error('Location tracking error:', error);
        // Handle different error codes
        if (error.code === 1) {
          console.error('Location permission denied');
        } else if (error.code === 2) {
          console.error('Location position unavailable');
        } else if (error.code === 3) {
          console.error('Location request timeout');
        }
      },
      this.config
    );
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
}

// Export singleton instance
export default new LocationService();

