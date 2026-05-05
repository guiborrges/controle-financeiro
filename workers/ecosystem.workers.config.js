module.exports = {
  apps: [
    {
      name: 'sync-pluggy',
      script: './workers/worker_pluggy.js',
      cwd: '/home/ubuntu/controle-financeiro',
      autorestart: true,
      watch: false
    },
    {
      name: 'process-pdf-ai',
      script: './workers/worker_oracle_ai.js',
      cwd: '/home/ubuntu/controle-financeiro',
      autorestart: true,
      watch: false
    }
  ]
};

