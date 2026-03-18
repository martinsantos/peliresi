const path = require('path');

// APP_DIR permite overridear el cwd en cualquier entorno sin modificar este archivo.
// En producción con deploys atómicos, APP_DIR se setea al release folder.
const appDir = process.env.APP_DIR || __dirname;

module.exports = {
  apps: [{
    name: 'sitrep-backend',
    script: path.join(appDir, 'dist/index.js'),
    cwd: appDir,
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/root/.pm2/logs/sitrep-backend-error.log',
    out_file: '/root/.pm2/logs/sitrep-backend-out.log',
    merge_logs: true,
    time: true
  }]
};
