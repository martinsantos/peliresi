import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://sitrep.ultimamilla.com.ar/api';

export const options = {
  stages: [
    { duration: '5s', target: 20 },
    { duration: '15s', target: 20 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Coordenadas fijas para simular transportistas (Mendoza, Argentina)
const LOCATIONS = [
  { lat: -32.889, lng: -68.845 },
  { lat: -32.895, lng: -68.830 },
  { lat: -32.880, lng: -68.860 },
  { lat: -32.900, lng: -68.840 },
  { lat: -32.870, lng: -68.870 },
];

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'transportes.andes@logistica.com',
    password: 'trans123',
  }), { headers: { 'Content-Type': 'application/json' } });
  const token = JSON.parse(loginRes.body).data.tokens.accessToken;
  return { token, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export default function (data) {
  const { headers } = data;

  // Cada VU elige una ubicación según su índice
  const idx = (__VU - 1) % LOCATIONS.length;
  const loc = LOCATIONS[idx];

  // Enviar ubicación GPS como transportista
  const gpsRes = http.post(`${BASE_URL}/tracking/ubicacion`, JSON.stringify({
    lat: loc.lat + (Math.random() - 0.5) * 0.005,
    lng: loc.lng + (Math.random() - 0.5) * 0.005,
    precision: 10 + Math.random() * 5,
    timestamp: new Date().toISOString(),
  }), { headers });

  check(gpsRes, { 'gps ubicacion 200': (r) => r.status === 200 });

  sleep(1);
}
