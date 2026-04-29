import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://sitrep.ultimamilla.com.ar/api';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'admin@dgfa.mendoza.gov.ar',
    password: 'admin123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login status 200': (r) => r.status === 200 });

  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body).data.tokens.accessToken;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const manifiestosRes = http.get(`${BASE_URL}/manifiestos?limit=10`, { headers });
    check(manifiestosRes, { 'manifiestos status 200': (r) => r.status === 200 });

    const dashRes = http.get(`${BASE_URL}/manifiestos/dashboard`, { headers });
    check(dashRes, { 'dashboard status 200': (r) => r.status === 200 });
  }

  sleep(1);
}
