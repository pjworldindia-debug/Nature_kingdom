module.exports = {
  apps: [{
    name:               'nature-kingdom',
    script:             'server.js',
    instances:          'max',           // One per CPU core
    exec_mode:          'cluster',
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
      PORT:     3000,
    },
    error_file:      'logs/error.log',
    out_file:        'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    watch:           false,
  }]
};
