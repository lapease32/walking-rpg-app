/* eslint-env jest */
// Jest setup for the animation stack (Reanimated 4 + gesture-handler).
// gesture-handler ships a jest setup that stubs its native module.
require('react-native-gesture-handler/jestSetup');

// Reanimated: swap in its official mock so any component that imports it under jest uses plain
// JS stubs instead of touching the native/UI-thread runtime. (No render tests import it today, but
// this keeps future ones — and any transitive import — from loading the real native module.)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
