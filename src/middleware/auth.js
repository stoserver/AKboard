const tokenService = require('../services/tokenService');
const userService = require('../services/userService');

function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.redirect('/auth/login');
  }

  try {
    const decoded = tokenService.verify(token);
    const user = userService.getUserById(decoded.sub);
    if (!user || user.is_blocked || !user.is_verified) {
      res.clearCookie('token');
      return res.redirect('/auth/login');
    }

    req.user = user;
    return next();
  } catch (error) {
    res.clearCookie('token');
    return res.redirect('/auth/login');
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.includes(role)) {
      return res.status(403).render('error', { message: '접근 권한이 없습니다.' });
    }
    return next();
  };
}

module.exports = {
  authRequired,
  requireRole
};
