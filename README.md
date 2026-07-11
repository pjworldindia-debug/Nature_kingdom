# Nature Kingdom - E-Commerce Platform v2.0

## Local Development (Docker)

To run the application locally on your machine for testing:

1. **Start PostgreSQL and Redis via Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Install Node Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in any necessary local credentials.

4. **Run Migrations & Seed:**
   ```bash
   npm run migrate
   npm run seed
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

6. **View the Site:**
   Open [http://localhost:3000](http://localhost:3000)

## Deployment Instructions

Please refer to the detailed **Post-Launch Verification Checklist** provided in your prompt.

### 1. Nginx Setup
Copy the contents of `nginx.conf.template` to `/etc/nginx/sites-available/nature-kingdom`, then enable it and restart Nginx.

### 2. Start Application
```bash
NODE_ENV=production pm2 start ecosystem.config.js --env production
pm2 save
```

### 3. Backups
Set up the cron job for backups:
```bash
chmod +x /var/www/nature-kingdom/scripts/backup-db.sh
```
Add to crontab (`crontab -e`):
```
0 2 * * * /var/www/nature-kingdom/scripts/backup-db.sh >> /var/log/nk-backup.log 2>&1
```
