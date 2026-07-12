module.exports = {
  apps: [{
    name:               'nature-kingdom',
    script:             'server.js',
    instances:          'max',           // One per CPU core
    exec_mode:          'cluster',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT:     2431,
    },
    error_file:      'logs/error.log',
    out_file:        'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    watch:           false,
  }, {
    name:               'nature-kingdom-admin',
    script:             'admin-server.js',
    instances:          1,
    exec_mode:          'fork',
    env: {
      NODE_ENV: 'production',
      ADMIN_PORT: 3001,
    },
    error_file:      'logs/admin-error.log',
    out_file:        'logs/admin-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    watch:           false,
  }]
};
