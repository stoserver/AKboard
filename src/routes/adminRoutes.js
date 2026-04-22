const express = require('express');
const { authRequired, requireRole } = require('../middleware/auth');
const userService = require('../services/userService');
const adminService = require('../services/adminService');
const boardService = require('../services/boardService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');

const router = express.Router();

router.use(authRequired);
router.use(requireRole('admin'));

function renderDashboard(req, res, error = null) {
  const users = userService.listUsers();
  const roles = adminService.listRoles();
  const boards = boardService.listAllBoards();
  const blockedIps = adminService.listBlockedIps();
  const auditLogs = auditService.listRecent(100);
  const config = {
    siteName: settingsService.getSetting('site_name', 'AKBoard 1'),
    termsLabel: settingsService.getSetting('terms_label', '{사이트이름} 이용약관에 동의합니다'),
    privacyLabel: settingsService.getSetting('privacy_label', '개인정보 처리방침에 동의합니다.'),
    smtpHost: settingsService.getSetting('smtp_host', 'smtp.gmail.com'),
    smtpPort: settingsService.getSetting('smtp_port', '587'),
    smtpUser: settingsService.getSetting('smtp_user', 'auth@parvia.kr'),
    smtpPass: settingsService.getSetting('smtp_pass', ''),
    octomoApiKey: settingsService.getSetting('octomo_api_key', ''),
    octomoVerifyUrl: settingsService.getSetting('octomo_verify_url', 'https://octomo.octoverse.kr/api/v1/messages/verify'),
    octomoSendUrl: settingsService.getSetting('octomo_send_url', 'https://octomo.octoverse.kr/api/v1/messages/send'),
    twoFactorRequired: settingsService.getBooleanSetting('two_factor_required', false)
  };

  return res.render('admin/dashboard', { user: req.user, users, roles, boards, blockedIps, auditLogs, config, error });
}

router.get('/dashboard', (req, res) => renderDashboard(req, res));

router.post('/users/:userId/block', (req, res) => {
  adminService.setUserBlocked(Number(req.params.userId), true);
  auditService.logEvent({ actorUserId: req.user.id, action: 'user.block', targetType: 'user', targetId: req.params.userId, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/users/:userId/unblock', (req, res) => {
  adminService.setUserBlocked(Number(req.params.userId), false);
  auditService.logEvent({ actorUserId: req.user.id, action: 'user.unblock', targetType: 'user', targetId: req.params.userId, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/users/:userId/two-factor', (req, res) => {
  userService.setTwoFactor(Number(req.params.userId), req.body.enabled === '1');
  auditService.logEvent({ actorUserId: req.user.id, action: 'user.2fa.toggle', targetType: 'user', targetId: req.params.userId, metadata: { enabled: req.body.enabled === '1' }, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/users/:userId/roles/assign', (req, res) => {
  try {
    adminService.assignRole(Number(req.params.userId), req.body.roleName);
    auditService.logEvent({ actorUserId: req.user.id, action: 'user.role.assign', targetType: 'user', targetId: req.params.userId, metadata: { role: req.body.roleName }, ipAddress: req.ip });
    res.redirect('/admin/dashboard');
  } catch (error) {
    renderDashboard(req, res.status(400), error.message);
  }
});

router.post('/users/:userId/roles/revoke', (req, res) => {
  try {
    adminService.revokeRole(Number(req.params.userId), req.body.roleName);
    auditService.logEvent({ actorUserId: req.user.id, action: 'user.role.revoke', targetType: 'user', targetId: req.params.userId, metadata: { role: req.body.roleName }, ipAddress: req.ip });
    res.redirect('/admin/dashboard');
  } catch (error) {
    renderDashboard(req, res.status(400), error.message);
  }
});

router.post('/ips/block', (req, res) => {
  adminService.addBlockedIp(req.body.ipAddress, req.body.reason);
  auditService.logEvent({ actorUserId: req.user.id, action: 'ip.block', targetType: 'ip', targetId: req.body.ipAddress, metadata: { reason: req.body.reason }, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/ips/unblock', (req, res) => {
  adminService.removeBlockedIp(req.body.ipAddress);
  auditService.logEvent({ actorUserId: req.user.id, action: 'ip.unblock', targetType: 'ip', targetId: req.body.ipAddress, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/settings/policies', (req, res) => {
  settingsService.setSetting('site_name', req.body.siteName || 'AKBoard 1');
  settingsService.setSetting('terms_label', req.body.termsLabel || '{사이트이름} 이용약관에 동의합니다');
  settingsService.setSetting('privacy_label', req.body.privacyLabel || '개인정보 처리방침에 동의합니다.');
  settingsService.setSetting('two_factor_required', req.body.twoFactorRequired === 'on' ? 'true' : 'false');
  auditService.logEvent({ actorUserId: req.user.id, action: 'settings.policies.update', targetType: 'settings', targetId: 'policies', ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/settings/auth', (req, res) => {
  settingsService.setSetting('smtp_host', req.body.smtpHost || 'smtp.gmail.com');
  settingsService.setSetting('smtp_port', String(req.body.smtpPort || '587'));
  settingsService.setSetting('smtp_user', req.body.smtpUser || '');
  settingsService.setSetting('smtp_pass', req.body.smtpPass || '');
  settingsService.setSetting('octomo_api_key', req.body.octomoApiKey || '');
  settingsService.setSetting('octomo_verify_url', req.body.octomoVerifyUrl || 'https://octomo.octoverse.kr/api/v1/messages/verify');
  settingsService.setSetting('octomo_send_url', req.body.octomoSendUrl || 'https://octomo.octoverse.kr/api/v1/messages/send');
  auditService.logEvent({ actorUserId: req.user.id, action: 'settings.auth.update', targetType: 'settings', targetId: 'auth', ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

router.post('/boards', (req, res) => {
  auditService.logEvent({ actorUserId: req.user.id, action: 'board.create', targetType: 'board', targetId: req.body.slug, ipAddress: req.ip });
  boardService.createBoard({
    slug: req.body.slug,
    title: req.body.title,
    description: req.body.description,
    requiredRole: req.body.requiredRole
  });
  res.redirect('/admin/dashboard');
});

router.post('/boards/:boardId/update', (req, res) => {
  auditService.logEvent({ actorUserId: req.user.id, action: 'board.update', targetType: 'board', targetId: req.params.boardId, ipAddress: req.ip });
  boardService.updateBoard(Number(req.params.boardId), {
    slug: req.body.slug,
    title: req.body.title,
    description: req.body.description,
    requiredRole: req.body.requiredRole
  });
  res.redirect('/admin/dashboard');
});

router.post('/boards/:boardId/delete', (req, res) => {
  boardService.deleteBoard(Number(req.params.boardId));
  auditService.logEvent({ actorUserId: req.user.id, action: 'board.delete', targetType: 'board', targetId: req.params.boardId, ipAddress: req.ip });
  res.redirect('/admin/dashboard');
});

module.exports = router;
