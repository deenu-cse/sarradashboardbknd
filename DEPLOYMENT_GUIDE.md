# SARRA Deployment Guide
## For ITDA/NIC Hosting Team

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | >= 18.0.0 LTS (recommended: 20.x LTS) |
| **npm** | >= 9.x |
| **RAM** | Minimum 2 GB (recommended: 4 GB) |
| **CPU** | 2 vCPU minimum |
| **Disk** | 20 GB SSD |
| **OS** | Ubuntu 22.04 LTS / RHEL 8+ |
| **MongoDB** | Atlas (cloud) or MongoDB 7.x+ with TLS |
| **SSL** | Required — TLS 1.2+ only |

---

## Architecture Overview

```
Internet → Nginx (reverse proxy + SSL) → PM2 (process manager)
                                              ├── sarradashbbknd (port 5000) - Express API
                                              ├── sarra (port 3000) - Next.js public site
                                              └── sarradashboard (port 3001) - Next.js dashboard
```

---

## Environment Variables

### Backend (sarradashbbknd)

| Variable | Description |
|----------|-------------|
| `PORT` | API server port (default: 5000) |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB connection string with TLS |
| `JWT_SECRET` | 64+ character random string |
| `JWT_REFRESH_SECRET` | 64+ character random string (different from above) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend URLs |

### Frontend (sarra)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g., https://api.sarra.uk.gov.in/api) |

### Dashboard (sarradashboard)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g., https://api.sarra.uk.gov.in/api) |

---

## Deployment Steps

### 1. Clone Repositories

```bash
git clone <sarra-repo> /opt/sarra/frontend
git clone <sarradashbbknd-repo> /opt/sarra/backend
git clone <sarradashboard-repo> /opt/sarra/dashboard
```

### 2. Install Dependencies

```bash
cd /opt/sarra/backend && npm ci --production
cd /opt/sarra/frontend && npm ci && npm run build
cd /opt/sarra/dashboard && npm ci && npm run build
```

### 3. Configure Environment Variables

```bash
# Copy and edit .env files
cp /opt/sarra/backend/.env.example /opt/sarra/backend/.env
# Edit with production values using: nano /opt/sarra/backend/.env

# Create frontend .env.local files
echo "NEXT_PUBLIC_API_URL=https://api.sarra.uk.gov.in/api" > /opt/sarra/frontend/.env.local
echo "NEXT_PUBLIC_API_URL=https://api.sarra.uk.gov.in/api" > /opt/sarra/dashboard/.env.local
```

### 4. Generate Strong JWT Secrets

```bash
openssl rand -base64 64  # Use output for JWT_SECRET
openssl rand -base64 64  # Use output for JWT_REFRESH_SECRET
```

### 5. Setup PM2 Process Manager

```bash
npm install -g pm2
cd /opt/sarra && pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-start on boot
```

### 6. Configure Nginx

```bash
cp nginx.conf /etc/nginx/sites-available/sarra
ln -s /etc/nginx/sites-available/sarra /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

### 7. SSL Certificate Setup

```bash
# Using Let's Encrypt (Certbot)
apt install certbot python3-certbot-nginx
certbot --nginx -d sarra.uk.gov.in -d dashboard.sarra.uk.gov.in -d api.sarra.uk.gov.in
```

---

## Health Check Endpoints

| Endpoint | Expected Response |
|----------|-------------------|
| `GET /api/health` | `{ "status": "ok", "timestamp": "...", "version": "1.0.0" }` |

---

## Monitoring

```bash
# Check PM2 process status
pm2 status

# View logs
pm2 logs sarradashbbknd
pm2 logs sarra
pm2 logs sarradashboard

# Monitor resources
pm2 monit
```

---

## Backup Strategy

1. **MongoDB**: Enable Atlas automated backups (daily, 7-day retention minimum)
2. **Application**: Git-based deployments — rollback via `git checkout`
3. **Cloudinary**: Enable backup add-on in Cloudinary dashboard
4. **Logs**: PM2 logs auto-rotate; audit logs in MongoDB with 180-day TTL
