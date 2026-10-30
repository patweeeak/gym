/*
 * Live walk/run tracker.
 * - Steps: peak detection on the phone's accelerometer (DeviceMotion).
 * - Distance/route: GPS via watchPosition.
 * If the motion sensor is unavailable, steps are estimated from GPS distance.
 * Both APIs require HTTPS (or localhost) and a user gesture to start.
 */
import { useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'running' | 'paused';

const haversineKm = ([la1, lo1]: [number, number], [la2, lo2]: [number, number]) => {
  const R = 6371, rad = Math.PI / 180;
  const dLa = (la2 - la1) * rad, dLo = (lo2 - lo1) * rad;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export function useTracker(mode: 'walk' | 'run') {
  const [status, setStatus] = useState<Status>('idle');
  const [motionSteps, setMotionSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [sensors, setSensors] = useState({ motion: false, gps: false });
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<Status>('idle');
  const det = useRef({ avg: 9.8, above: false, last: 0 });
  const lastPos = useRef<[number, number] | null>(null);
  const watchId = useRef<number | null>(null);
  const motionHandler = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  statusRef.current = status;

  // timer
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setDurationSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const onMotion = (e: DeviceMotionEvent) => {
    if (statusRef.current !== 'running') return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    setSensors((s) => (s.motion ? s : { ...s, motion: true }));
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const d = det.current;
    d.avg = d.avg * 0.92 + mag * 0.08;
    const now = performance.now();
    const threshold = mode === 'run' ? 2.4 : 1.25;
    if (!d.above && mag - d.avg > threshold && now - d.last > (mode === 'run' ? 220 : 300)) {
      d.above = true;
      d.last = now;
      setMotionSteps((s) => s + 1);
    } else if (d.above && mag - d.avg < 0.3) {
      d.above = false;
    }
  };

  const onPos = (p: GeolocationPosition) => {
    if (statusRef.current !== 'running') return;
    if (p.coords.accuracy > 35) return; // ignore noisy fixes
    const pt: [number, number] = [p.coords.latitude, p.coords.longitude];
    setSensors((s) => (s.gps ? s : { ...s, gps: true }));
    if (lastPos.current) {
      const km = haversineKm(lastPos.current, pt);
      if (km < 0.003) return; // jitter
      setDistanceKm((d) => d + km);
    }
    lastPos.current = pt;
    setRoute((r) => [...r, pt]);
  };

  const attach = () => {
    motionHandler.current = onMotion;
    window.addEventListener('devicemotion', onMotion);
    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(onPos, (err) => setError(`GPS: ${err.message}`), {
        enableHighAccuracy: true, maximumAge: 1000, timeout: 20000,
      });
    }
  };
  const detach = () => {
    if (motionHandler.current) window.removeEventListener('devicemotion', motionHandler.current);
    motionHandler.current = null;
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  useEffect(() => detach, []);

  const start = async () => {
    setError(null);
    // iOS needs explicit permission for motion sensors
    const DM = (window as any).DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') {
      try {
        const res = await DM.requestPermission();
        if (res !== 'granted') setError('Motion permission denied — steps will be estimated from GPS.');
      } catch { /* ignore */ }
    }
    if (!window.isSecureContext) setError('Sensors need HTTPS. Open the app over https:// to track live.');
    attach();
    setStatus('running');
  };

  const pause = () => { setStatus('paused'); lastPos.current = null; };
  const resume = () => setStatus('running');

  const reset = () => {
    detach();
    setStatus('idle');
    setMotionSteps(0); setDistanceKm(0); setDurationSec(0); setRoute([]);
    lastPos.current = null;
    det.current = { avg: 9.8, above: false, last: 0 };
  };

  const stride = mode === 'run' ? 1.0 : 0.75; // metres
  const steps = motionSteps > 0 ? motionSteps : Math.round((distanceKm * 1000) / stride);

  return { status, steps, distanceKm, durationSec, route, sensors, error, start, pause, resume, reset };
}
