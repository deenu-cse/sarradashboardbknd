/**
 * PM2 Ecosystem Configuration
 * SARRA - Spring and River Rejuvenation Authority
 * Government of Uttarakhand
 */
module.exports = {
  apps: [
    // Backend API Server
    {
      name: 'sarradashbbknd',
      script: 'index.js',
      cwd: '/opt/sarra/backend',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Log configuration
      log_file: '/var/log/sarra/backend-combined.log',
      out_file: '/var/log/sarra/backend-out.log',
      error_file: '/var/log/sarra/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },

    // Public Frontend (Next.js)
    {
      name: 'sarra',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/opt/sarra/frontend',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_file: '/var/log/sarra/frontend-combined.log',
      out_file: '/var/log/sarra/frontend-out.log',
      error_file: '/var/log/sarra/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
    },

    // Admin Dashboard (Next.js)
    {
      name: 'sarradashboard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/opt/sarra/dashboard',
      instances: 1, // Dashboard has fewer users
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      log_file: '/var/log/sarra/dashboard-combined.log',
      out_file: '/var/log/sarra/dashboard-out.log',
      error_file: '/var/log/sarra/dashboard-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
    },
  ],
};
