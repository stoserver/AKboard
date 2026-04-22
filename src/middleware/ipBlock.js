const adminService = require('../services/adminService');

module.exports = function ipBlockMiddleware(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || '').split(',')[0].trim();

  if (ip && adminService.isIpBlocked(ip)) {
    return res.status(403).render('error', { message: `접근이 차단된 IP입니다: ${ip}` });
  }

  return next();
};
