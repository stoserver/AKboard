const installService = require('../services/installService');

function setupGuard(req, res, next) {
  if (installService.isInstalled()) {
    return next();
  }

  if (req.path.startsWith('/install') || req.path.startsWith('/public')) {
    return next();
  }

  return res.redirect('/install');
}

module.exports = setupGuard;
