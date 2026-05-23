const AuditLog = require('../models/AuditLog');

/**
 * Audit Logger Middleware
 * Logs all important security events for CERT-In compliance
 * Retention: 180 days as per CERT-In guidelines
 */
const auditLogger = async (req, res, next) => {
  // Store original end function to capture response
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    // Capture response status after response is complete
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Skip logging for certain paths
    const skipPaths = ['/api/health', '/api/stats'];
    if (skipPaths.includes(req.path)) {
      return;
    }

    // Determine action type based on method and path
    let action = '';
    let resource = '';
    let result = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';

    // Parse action from request
    if (req.path.includes('/auth/login')) {
      action = 'LOGIN';
      resource = 'authentication';
    } else if (req.path.includes('/auth/logout')) {
      action = 'LOGOUT';
      resource = 'authentication';
    } else if (req.path.includes('/auth/register')) {
      action = 'REGISTER';
      resource = 'authentication';
    } else if (req.method === 'POST') {
      action = 'CREATE';
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      action = 'UPDATE';
    } else if (req.method === 'DELETE') {
      action = 'DELETE';
    } else if (req.method === 'GET') {
      action = 'READ';
    }

    // Determine resource type from path
    if (req.path.includes('/news')) resource = 'news';
    else if (req.path.includes('/gallery')) resource = 'gallery';
    else if (req.path.includes('/publications')) resource = 'publications';
    else if (req.path.includes('/ticker')) resource = 'ticker';
    else if (req.path.includes('/announcements')) resource = 'announcements';
    else if (req.path.includes('/stats')) resource = 'statistics';
    else if (req.path.includes('/auth')) resource = 'authentication';

    // Log asynchronously (don't block response)
    const logEntry = {
      timestamp: new Date(),
      userId: req.userData?.adminId || req.userData?.email || 'anonymous',
      userRole: req.userData?.role || 'unknown',
      action: action,
      resource: resource,
      resourceId: req.params?.id || 'N/A',
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      method: req.method,
      path: req.path,
      result: result,
      statusCode: res.statusCode,
    };

    // Save to database (fire and forget)
    if (resource) {
      AuditLog.create(logEntry).catch(err => {
        console.error('Audit log write error:', err.message);
      });
    }
  };

  next();
};

module.exports = auditLogger;