import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://sitrep.ultimamilla.com.ar/api';

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '15s', target: 30 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'admin@dgfa.mendoza.gov.ar',
    password: 'admin123',
  }), { headers: { 'Content-Type': 'application/json' } });
  const token = JSON.parse(loginRes.body).data.tokens.accessToken;
  return { token, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export default function (data) {
  const { headers } = data;

  // Consultar páginas 1, 2, 3 con distintos límites
  const pages = [
    { page: 1, limit: 25 },
    { page: 2, limit: 25 },
    { page: 3, limit: 25 },
    { page: 1, limit: 50 },
    { page: 2, limit: 50 },
  ];

  const paginationRes = http.batch(pages.map(p => ({
    method: 'GET',
    url: `${BASE_URL}/manifiestos?page=${p.page}&limit=${p.limit}`,
    params: { headers },
  })));

  pages.forEach((p, i) => {
    check(paginationRes[i], {
      [`manifiestos page=${p.page} limit=${p.limit} status 200`]: (r) => r.status === 200,
    });
  });

  sleep(1);
}
