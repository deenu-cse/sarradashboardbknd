# SARRA Security Controls Document
## For CERT-In VAPT Auditor Review

This document lists every security control implemented, its file location, and verification method.

---

## A. Authentication Controls

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | JWT access token 15-min expiry | `controllers/authController.js:1` (ACCESS_TOKEN_EXPIRY constant) | Decode token, check `exp` claim |
| 2 | Refresh token 7-day expiry with DB storage | `controllers/authController.js:16-22` | Check RefreshToken collection |
| 3 | httpOnly cookie for refresh token | `controllers/authController.js:106-113` | Browser DevTools → Application → Cookies |
| 4 | Secure + SameSite cookie flags | `controllers/authController.js:108-109` | Set `NODE_ENV=production`, inspect cookies |
| 5 | Refresh token rotation | `controllers/authController.js:170-182` | Call refresh endpoint, verify old token is revoked |
| 6 | Token revocation on logout | `controllers/authController.js:215-222` | Call logout, try using old refresh token |
| 7 | Bcrypt rounds = 12 | `controllers/authController.js:6` (BCRYPT_ROUNDS constant) | Check password hash format |
| 8 | Account lockout (5 attempts, 30min) | `controllers/authController.js:70-76` | Try 5 wrong passwords, verify lockout |
| 9 | Password strength validation | `controllers/authController.js:259-264` | Try weak password, verify rejection |
| 10 | Register protected by auth middleware | `routes/authRoutes.js:15` | Call register without token, verify 401 |

## B. Authorization Controls

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | Auth middleware on all protected routes | `routes/*.js` | Call any POST/DELETE without token |
| 2 | Role-based authorization middleware | `middleware/authMiddleware.js:53-65` | Test with different role values |
| 3 | Stats route protected | `routes/statsRoutes.js:12` | GET /api/stats without token → 401 |

## C. Input Validation & Sanitization

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | express-mongo-sanitize | `index.js:95` | Send `{"email": {"$gt": ""}}` in login |
| 2 | xss-clean middleware | `index.js:98` | Send `<script>` in request body |
| 3 | hpp (HTTP Parameter Pollution) | `index.js:101` | Send duplicate query params |
| 4 | JSON body size limit (10kb) | `index.js:41` | Send payload > 10kb |
| 5 | File MIME type validation | `middleware/uploadMiddleware.js:15-27` | Upload a .exe renamed to .jpg |
| 6 | File size limit (10MB) | `middleware/uploadMiddleware.js:48-50` | Upload file > 10MB |
| 7 | File count limit (10) | `middleware/uploadMiddleware.js:51` | Upload > 10 files |
| 8 | MongoDB ObjectId validation | `controllers/announcementController.js:81` | Send invalid ID format |
| 9 | String length validation | `controllers/announcementController.js:10-17` | Send 10,000 char title |
| 10 | Pagination max limit (100) | `controllers/announcementController.js:53` | Request limit=10000 |
| 11 | Validation middleware utilities | `middleware/validate.middleware.js` | Unit test each validator |

## D. HTTP Security Headers

| # | Header | Value | File |
|---|--------|-------|------|
| 1 | Content-Security-Policy | Strict CSP | `index.js:18-28` (backend) + `next.config.ts/mjs` (frontend) |
| 2 | X-Frame-Options | DENY | `index.js:17` (Helmet) + `next.config.ts/mjs` |
| 3 | X-Content-Type-Options | nosniff | Helmet default + Next.js headers |
| 4 | Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | `index.js:30-34` + `next.config.ts/mjs` |
| 5 | X-XSS-Protection | 1; mode=block | Next.js headers config |
| 6 | Referrer-Policy | strict-origin-when-cross-origin | Next.js headers config |
| 7 | Permissions-Policy | camera=(), microphone=(), etc. | Next.js headers config |
| 8 | X-Powered-By | REMOVED | `index.js:38` + `poweredByHeader: false` |

**Verification:** Use `curl -I https://sarra.uk.gov.in` and check response headers.

## E. CORS Controls

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | Strict origin whitelist | `index.js:44-60` | Send request from unlisted origin |
| 2 | Credentials flag enabled | `index.js:61` | Check `Access-Control-Allow-Credentials` |
| 3 | Methods restricted | `index.js:62` | Send TRACE/CONNECT method |
| 4 | Headers restricted | `index.js:63` | Send custom header not in list |
| 5 | Origins from environment | `index.js:46-50` | Check ALLOWED_ORIGINS env var |

## F. Rate Limiting

| # | Control | Configuration | File |
|---|---------|--------------|------|
| 1 | General rate limit | 100 requests / 15 minutes | `index.js:72-78` |
| 2 | Auth rate limit | 10 requests / 15 minutes | `index.js:81-87` |
| 3 | Standard headers | RateLimit-* headers | `index.js:76-77` |

**Verification:** Send 11 login requests rapidly, verify 429 response.

## G. Audit Logging

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | AuditLog model with TTL | `models/AuditLog.js` | Check MongoDB `auditlogs` collection |
| 2 | Audit middleware | `middleware/auditLogger.js` | Perform any action, check DB for log |
| 3 | 180-day auto-deletion | `models/AuditLog.js:28` | Check TTL index on `timestamp` |
| 4 | Fields: timestamp, userId, action, resource, IP, userAgent, result | `middleware/auditLogger.js:58-71` | Query auditlogs collection |

## H. Database Security

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | TLS enabled for MongoDB | `index.js:107` | Check connection string for `tls=true` |
| 2 | Connection string in .env only | `.env` | grep for mongodb in source files |
| 3 | .env in .gitignore | `.gitignore:2` | `git status` should not show .env |
| 4 | Password not returned in API responses | `models/Admin.js:38-42` (toJSON method) | Call any endpoint returning admin data |

## I. Error Handling

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | Global error handler (no stack traces) | `index.js:137-149` | Trigger 500 error, check response |
| 2 | 404 handler | `index.js:132-134` | Request non-existent endpoint |
| 3 | Generic error messages | All controllers | Check all catch blocks return generic messages |
| 4 | Development-only error details | `index.js:147` | Only in NODE_ENV=development |

## J. Frontend Security

| # | Control | File | Verification |
|---|---------|------|-------------|
| 1 | Tokens NOT in localStorage | `sarra/src/lib/axiosInstance.js` | Search for `localStorage` |
| 2 | Access token in memory only | `sarra/src/lib/axiosInstance.js:30` | `window.__SARRA_ACCESS_TOKEN__` |
| 3 | Auto token refresh | `sarra/src/lib/axiosInstance.js:41-90` | Let token expire, verify auto-refresh |
| 4 | Forced logout on refresh failure | `sarra/src/lib/axiosInstance.js:80-84` | Revoke refresh token, verify redirect |
| 5 | withCredentials for cookies | `sarra/src/lib/axiosInstance.js:7` | Verify cookies sent cross-origin |
| 6 | Same pattern in dashboard | `sarradashboard/src/lib/api.js` | Mirror verification |

## K. GIGW 3.0 Compliance

| # | Requirement | Status | Path |
|---|-------------|--------|------|
| 1 | Privacy Policy | ✅ Implemented | `/privacy-policy` |
| 2 | Terms of Service | ✅ Implemented | `/terms` |
| 3 | Copyright Policy | ✅ Implemented | `/copyright` |
| 4 | Accessibility Statement | ✅ Implemented | `/accessibility` |
| 5 | Sitemap XML | ✅ Implemented | `/sitemap.xml` |
| 6 | robots.txt | ✅ Implemented | `/robots.txt` |
| 7 | Mobile Responsive | ✅ Tailwind CSS responsive | All pages |
| 8 | Alt Text on Images | ✅ Partial | Review all components |
| 9 | Hindi Language | ⚠️ Pending | Requires translation |
