import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://sitrep.ultimamilla.com.ar/api';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 15 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
};

const DATE_FROM = '2024-01-01';
const DATE_TO = '2026-12-31';

export default function () {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'admin@dgfa.mendoza.gov.ar',
    password: 'admin123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login status 200': (r) => r.status === 200 });

  if (loginRes.status !== 200) {
    sleep(1);
    return;
  }

  const token = JSON.parse(loginRes.body).data.tokens.accessToken;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Reportes con rangos de fecha amplios
  const reportEndpoints = [
    `${BASE_URL}/reportes/manifiestos?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}`,
    `${BASE_URL}/reportes/manifiestos?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}&agruparPor=estado`,
    `${BASE_URL}/reportes/manifiestos?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}&agruparPor=tipoResiduo`,
    `${BASE_URL}/analytics/manifiestos-por-mes?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}`,
    `${BASE_URL}/analytics/residuos-por-tipo?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}`,
    `${BASE_URL}/analytics/por-estado?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}`,
    `${BASE_URL}/analytics/tiempo-promedio?fechaDesde=${DATE_FROM}&fechaHasta=${DATE_TO}`,
  ];

  const reportRes = http.batch(reportEndpoints.map(url => ({
    method: 'GET',
    url,
    params: { headers },
  })));

  reportEndpoints.forEach((url, i) => {
    const name = url.split('/analytics/').pop() || url.split('/reportes/').pop() || url;
    check(reportRes[i], {
      [`reporte ${name} status 200`]: (r) => r.status === 200,
    });
  });

  sleep(2);
}
