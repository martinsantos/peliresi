module.exports = {
  apps: [{
    name: 'sitrep-backend',
    script: 'dist/index.js',
    cwd: '/var/www/sitrep-backend',
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/root/.pm2/logs/sitrep-backend-error.log',
    out_file: '/root/.pm2/logs/sitrep-backend-out.log',
    merge_logs: true,
    time: true
  }]
};
