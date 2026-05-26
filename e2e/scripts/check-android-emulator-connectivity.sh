#!/bin/sh
# Verify the Android emulator can reach Firebase emulators running on the host (10.0.2.2).
# TCP-level nc check — confirms the emulator's network stack can route to the host ports.
# HTTP-level readiness (emulators accepting requests) is verified host-side in e2e-android.yml
# before this script runs, so TCP routing is all we need to validate here.
echo "Checking emulator→host Firebase connectivity..."
for i in $(seq 1 15); do
  AUTH=$(adb shell 'nc -w1 10.0.2.2 9099 </dev/null >/dev/null 2>&1 && echo ok || echo fail' | tr -d '\r')
  FS=$(adb shell 'nc -w1 10.0.2.2 8080 </dev/null >/dev/null 2>&1 && echo ok || echo fail' | tr -d '\r')
  echo "  attempt $i: auth=$AUTH firestore=$FS"
  if [ "$AUTH" = "ok" ] && [ "$FS" = "ok" ]; then
    echo "Emulator→host connectivity verified after ${i}x2s"
    exit 0
  fi
  if [ "$i" -eq 15 ]; then
    echo "ERROR: emulator cannot reach Firebase emulators on host"
    exit 1
  fi
  sleep 2
done
