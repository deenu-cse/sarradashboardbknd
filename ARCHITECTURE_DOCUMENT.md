# SARRA Architecture Document
## System Architecture — Spring and River Rejuvenation Authority

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX REVERSE PROXY                          │
│        (SSL Termination, Rate Limiting, Static Cache)           │
│                                                                 │
│  sarra.uk.gov.in          → localhost:3000 (Next.js Frontend)   │
│  dashboard.sarra.uk.gov.in → localhost:3001 (Next.js Dashboard) │
│  api.sarra.uk.gov.in      → localhost:5000 (Express API)        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   SARRA      │ │  SARRA       │ │  SARRA       │
│   Frontend   │ │  Dashboard   │ │  Backend API │
│  (Next.js)   │ │  (Next.js)   │ │  (Express)   │
│  Port: 3000  │ │  Port: 3001  │ │  Port: 5000  │
│              │ │              │ │              │
│  Public      │ │  Admin       │ │  REST API    │
│  Website     │ │  Portal      │ │  Server      │
└──────────────┘ └──────────────┘ └──────┬───────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼                             ▼
                 ┌──────────────┐              ┌──────────────┐
                 │  MongoDB     │              │  Cloudinary  │
                 │  Atlas       │              │  (CDN)       │
                 │  (Database)  │              │  Media       │
                 │  TLS Enabled │              │  Storage     │
                 └──────────────┘              └──────────────┘
```

---

## Data Flow Diagrams

### Authentication Flow
```
User → Login Form → POST /api/auth/login
  → Validate email/password → Check lockout
  → bcrypt.compare() → Generate Access Token (15min)
  → Generate Refresh Token (7d) → Store in DB
  → Set httpOnly cookie (refreshToken)
  → Return accessToken in JSON (stored in memory)
```

### Token Refresh Flow
```
Client (401 received) → POST /api/auth/refresh-token
  → Read refreshToken from httpOnly cookie
  → Verify JWT → Check DB (not revoked, not expired)
  → Revoke old refresh token → Generate new tokens
  → Set new httpOnly cookie → Return new accessToken
```

### Content Management Flow (Admin)
```
Admin → Dashboard Login → Create/Edit Content
  → Upload media → Multer validates (MIME, size)
  → Cloudinary stores media → MongoDB stores metadata
  → Public frontend fetches via API → SSR/CSR renders
```

---

## API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/refresh-token` | Refresh access token |
| GET | `/api/news` | List news articles |
| GET | `/api/news/slug/:slug` | Get news by slug |
| GET | `/api/gallery` | List gallery images |
| GET | `/api/announcements` | List announcements |
| GET | `/api/announcements/slug/:slug` | Get announcement by slug |
| GET | `/api/publications` | List publications |
| GET | `/api/ticker` | List active tickers |
| GET | `/api/health` | Health check |

### Protected Endpoints (Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new admin |
| POST | `/api/auth/logout` | Logout (revoke token) |
| GET | `/api/stats` | Dashboard statistics |
| POST | `/api/news` | Create news article |
| DELETE | `/api/news/:id` | Delete news article |
| POST | `/api/gallery` | Upload gallery image |
| DELETE | `/api/gallery/:id` | Delete gallery image |
| POST | `/api/announcements` | Create announcement |
| DELETE | `/api/announcements/:id` | Delete announcement |
| POST | `/api/publications` | Create publication |
| DELETE | `/api/publications/:id` | Delete publication |
| POST | `/api/ticker` | Create ticker |
| DELETE | `/api/ticker/:id` | Delete ticker |
| PATCH | `/api/ticker/:id` | Update ticker status |

---

## Database Collections

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `admins` | Admin user accounts | email, password (bcrypt), role, failedLoginAttempts |
| `refreshtokens` | JWT refresh tokens | token, adminId, expiresAt, isRevoked |
| `auditlogs` | Security audit trail | timestamp, userId, action, resource, ip, result |
| `news` | News articles | title, slug, content, thumbnail, images |
| `galleries` | Photo gallery | title, image, district, description |
| `announcements` | Public announcements | title, slug, description, image |
| `publications` | PDF publications | title, coverImage, pdf, description |
| `tickers` | News ticker items | text, isActive |

---

## Third-Party Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Cloudinary** | Image/document CDN storage | API key in .env |
| **MongoDB Atlas** | Cloud database | Connection string in .env |
| **Vercel** (optional) | Frontend hosting | Git-based deployment |
| **Render** (optional) | Backend hosting | Git-based deployment |

---

## Network Ports

| Port | Service | Access |
|------|---------|--------|
| 80 | Nginx HTTP → redirect to 443 | Public |
| 443 | Nginx HTTPS | Public |
| 3000 | Next.js (sarra frontend) | Localhost only |
| 3001 | Next.js (sarradashboard) | Localhost only |
| 5000 | Express (sarradashbbknd) | Localhost only |
| 27017 | MongoDB (if local) | Localhost only |
