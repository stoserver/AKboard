const express = require('express');
const passport = require('../config/passport');
const userService = require('../services/userService');
const tokenService = require('../services/tokenService');
const mailService = require('../services/mailService');
const smsService = require('../services/smsService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');
const env = require('../config/env');

const router = express.Router();

const attemptStore = new Map();
function exceededAttempts(key, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const entry = attemptStore.get(key);
  if (!entry || now > entry.resetAt) {
    attemptStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  attemptStore.set(key, entry);
  return entry.count > limit;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 8
  };
}

function registrationPolicy() {
  return {
    termsLabel: settingsService.getSetting('terms_label', '{사이트이름} 이용약관에 동의합니다'),
    privacyLabel: settingsService.getSetting('privacy_label', '개인정보 처리방침에 동의합니다.')
  };
}

router.get('/register', (req, res) => {
  res.render('auth/register', { error: null, success: null, verifyInfo: null, ...registrationPolicy() });
});

router.post('/register', async (req, res) => {
  const { contactType, contactValue, studentId, realName, nickname, username, password, termsAgreed, privacyAgreed } = req.body;

  if (!contactType || !contactValue || !studentId || !realName || !nickname || !username || !password || password.length < 8) {
    return res.render('auth/register', {
      error: '학번/이름/닉네임/연락처/아이디/비밀번호(8자 이상)를 입력하세요.',
      success: null,
      verifyInfo: null,
      ...registrationPolicy()
    });
  }

  if (termsAgreed !== 'on' || privacyAgreed !== 'on') {
    return res.render('auth/register', {
      error: '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.',
      success: null,
      verifyInfo: null,
      ...registrationPolicy()
    });
  }

  try {
    const created = userService.createUser({
      email: contactType === 'email' ? contactValue : null,
      phone: contactType === 'phone' ? contactValue : null,
      studentId,
      realName,
      nickname,
      username,
      password,
      termsAgreed: true,
      privacyAgreed: true
    });

    const code = userService.createVerificationRequest({
      userId: created.id,
      channel: contactType,
      target: contactValue
    });

    if (contactType === 'email') {
      await mailService.sendVerificationCode(contactValue, code);
      return res.render('auth/register', {
        error: null,
        success: '가입 마지막 단계입니다. 이메일 인증코드를 입력해 인증을 완료하세요.',
        verifyInfo: `인증 대상: ${contactValue}`,
        ...registrationPolicy()
      });
    }

    const smsSent = await smsService.sendVerificationSms({ phone: contactValue, code });
    return res.render('auth/register', {
      error: null,
      success: '가입 마지막 단계입니다. 아래 안내대로 문자 인증 후 확인 버튼을 눌러주세요.',
      verifyInfo: `${smsSent ? '자동 문자 발송 시도 완료. ' : ''}1666-3538번호로 "${code}"을 보내주시고 밑 확인을 눌러주세요.`,
      ...registrationPolicy()
    });
  } catch (error) {
    return res.render('auth/register', {
      error: '중복된 연락처(이메일/전화번호) 또는 아이디입니다.',
      success: null,
      verifyInfo: null,
      ...registrationPolicy()
    });
  }
});

router.get('/verify', (req, res) => {
  res.render('auth/verify', { success: null, error: null });
});

router.post('/verify', async (req, res) => {
  const { identifier, code, channel } = req.body;
  if (!identifier || !code || !channel) {
    return res.render('auth/verify', { success: null, error: '인증 타입/연락처/인증코드를 모두 입력하세요.' });
  }

  const user = userService.getUserByContact(identifier);
  if (!user) {
    return res.render('auth/verify', { success: null, error: '사용자를 찾을 수 없습니다.' });
  }

  if (channel === 'email') {
    const ok = userService.verifyByCode({ userId: user.id, code, channel: 'email' });
    if (!ok) {
      return res.render('auth/verify', { success: null, error: '유효하지 않거나 만료된 인증코드입니다.' });
    }
    return res.render('auth/verify', { success: '이메일 인증이 완료되었습니다. 로그인하세요.', error: null });
  }

  const apiVerified = await smsService.verifyViaOctomo({ phone: identifier, code });
  if (!apiVerified) {
    return res.render('auth/verify', { success: null, error: 'Octomo API 키 검증 결과 false 입니다. 문자 발송 후 다시 시도하세요.' });
  }

  const verified = userService.markPhoneVerificationComplete(user.id, code);
  if (!verified) {
    return res.render('auth/verify', { success: null, error: '저장된 인증 요청이 없거나 만료되었습니다.' });
  }

  return res.render('auth/verify', { success: '휴대폰 인증이 완료되었습니다. 로그인하세요.', error: null });
});

router.get('/find-id', (req, res) => {
  res.render('auth/find-id', { error: null, success: null, foundId: null, guide: null });
});

router.post('/find-id/request', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.render('auth/find-id', { error: '전화번호를 입력하세요.', success: null, foundId: null, guide: null });
  }

  if (exceededAttempts(`find-id:${req.ip}:${phone}`)) {
    return res.render('auth/find-id', { error: '시도가 너무 많습니다. 잠시 후 재시도하세요.', success: null, foundId: null, guide: null });
  }

  const user = userService.findUserByPhone(phone);
  if (!user) {
    return res.render('auth/find-id', {
      error: null,
      success: null,
      foundId: null,
      guide: '등록된 계정이 없습니다. 학번/이름을 준비해 채널톡으로 문의해주세요.'
    });
  }

  const code = userService.createRecoveryCode({ userId: user.id, channel: 'find_id_phone', target: phone });
  const smsSent = await smsService.sendVerificationSms({ phone, code });
  auditService.logEvent({ action: 'auth.find_id.request', targetType: 'user', targetId: String(user.id), ipAddress: req.ip });
  req.session.findIdUserId = user.id;
  req.session.findIdPhone = phone;

  return res.render('auth/find-id', {
    error: null,
    success: '아이디 찾기 인증코드가 준비되었습니다.',
    foundId: null,
    guide: `${smsSent ? '자동 문자 발송 시도 완료. ' : ''}1666-3538번호로 "${code}"을 보내주시고 확인을 눌러주세요.`
  });
});

router.post('/find-id/verify', async (req, res) => {
  const { code } = req.body;
  const userId = req.session.findIdUserId;
  const phone = req.session.findIdPhone;
  if (!userId || !phone || !code) {
    return res.render('auth/find-id', { error: '인증 세션이 없거나 코드가 누락되었습니다.', success: null, foundId: null, guide: null });
  }

  const apiVerified = await smsService.verifyViaOctomo({ phone, code });
  if (!apiVerified) {
    return res.render('auth/find-id', { error: '전화 인증이 실패했습니다.', success: null, foundId: null, guide: null });
  }

  const ok = userService.verifyRecoveryCode({ userId, channel: 'find_id_phone', code });
  if (!ok) {
    return res.render('auth/find-id', { error: '코드가 유효하지 않거나 만료되었습니다.', success: null, foundId: null, guide: null });
  }

  const user = userService.getUserById(userId);
  auditService.logEvent({ action: 'auth.2fa.success', targetType: 'user', targetId: String(userId), ipAddress: req.ip });
  req.session.findIdUserId = null;
  req.session.findIdPhone = null;
  return res.render('auth/find-id', { error: null, success: '아이디 찾기가 완료되었습니다.', foundId: user.username, guide: null });
});

router.get('/reset-password', (req, res) => {
  res.render('auth/reset-password', { error: null, success: null, guide: null });
});

router.post('/reset-password/request', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.render('auth/reset-password', { error: '이메일 또는 전화번호를 입력하세요.', success: null, guide: null });
  }

  if (exceededAttempts(`reset-password:${req.ip}:${identifier}`)) {
    return res.render('auth/reset-password', { error: '시도가 너무 많습니다. 잠시 후 재시도하세요.', success: null, guide: null });
  }

  const user = userService.findUserByEmailOrPhone(identifier);
  if (!user) {
    return res.render('auth/reset-password', { error: '가입된 계정을 찾을 수 없습니다.', success: null, guide: null });
  }

  if (user.email && identifier.toLowerCase() === user.email.toLowerCase()) {
    const code = userService.createRecoveryCode({ userId: user.id, channel: 'password_reset_email', target: user.email });
    await mailService.sendPasswordResetCode(user.email, code);
    auditService.logEvent({ action: 'auth.reset_password.request.email', targetType: 'user', targetId: String(user.id), ipAddress: req.ip });
    req.session.resetPasswordUserId = user.id;
    req.session.resetPasswordChannel = 'password_reset_email';
    req.session.resetPasswordTarget = user.email;
    return res.render('auth/reset-password', { error: null, success: '이메일로 재설정 코드를 보냈습니다.', guide: null });
  }

  const code = userService.createRecoveryCode({ userId: user.id, channel: 'password_reset_phone', target: user.phone });
  const smsSent = await smsService.sendVerificationSms({ phone: user.phone, code });
  auditService.logEvent({ action: 'auth.reset_password.request.phone', targetType: 'user', targetId: String(user.id), ipAddress: req.ip });
  req.session.resetPasswordUserId = user.id;
  req.session.resetPasswordChannel = 'password_reset_phone';
  req.session.resetPasswordTarget = user.phone;
  return res.render('auth/reset-password', {
    error: null,
    success: '전화 인증 후 비밀번호를 재설정하세요.',
    guide: `${smsSent ? '자동 문자 발송 시도 완료. ' : ''}1666-3538번호로 "${code}"을 보내주시고 확인을 눌러주세요.`
  });
});

router.post('/reset-password/confirm', async (req, res) => {
  const { code, newPassword } = req.body;
  const userId = req.session.resetPasswordUserId;
  const channel = req.session.resetPasswordChannel;
  const target = req.session.resetPasswordTarget;

  if (!userId || !channel || !target || !code || !newPassword || newPassword.length < 8) {
    return res.render('auth/reset-password', { error: '코드/새 비밀번호(8자 이상)를 확인하세요.', success: null, guide: null });
  }

  if (channel === 'password_reset_phone') {
    const apiVerified = await smsService.verifyViaOctomo({ phone: target, code });
    if (!apiVerified) {
      return res.render('auth/reset-password', { error: '전화 인증이 실패했습니다.', success: null, guide: null });
    }
  }

  const ok = userService.verifyRecoveryCode({ userId, channel, code });
  if (!ok) {
    return res.render('auth/reset-password', { error: '코드가 유효하지 않거나 만료되었습니다.', success: null, guide: null });
  }

  userService.updatePassword(userId, newPassword);
  auditService.logEvent({ action: 'auth.reset_password.success', targetType: 'user', targetId: String(userId), ipAddress: req.ip });
  req.session.resetPasswordUserId = null;
  req.session.resetPasswordChannel = null;
  req.session.resetPasswordTarget = null;
  return res.render('auth/reset-password', { error: null, success: '비밀번호가 초기화되었습니다. 로그인하세요.', guide: null });
});

router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (exceededAttempts(`login:${req.ip}:${identifier}`)) {
    return res.render('auth/login', { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' });
  }
  const result = userService.authenticateUser(identifier, password);

  if (!result.ok) {
    auditService.logEvent({ action: 'auth.login.failed', targetType: 'auth', targetId: identifier, ipAddress: req.ip });
    return res.render('auth/login', { error: result.reason });
  }

  if (result.require2FA) {
    const code = userService.createLogin2FACode(result.user);
    if (result.user.email) {
      await mailService.sendVerificationCode(result.user.email, code);
    }
    req.session.pending2faUserId = result.user.id;
    return res.redirect('/auth/2fa');
  }

  const roles = userService.getUserRoles(result.user.id);
  const token = tokenService.sign(result.user, roles);
  await new Promise((resolve) => req.session.regenerate(resolve));
  res.cookie('token', token, cookieOptions());
  auditService.logEvent({ actorUserId: result.user.id, action: 'auth.login.success', targetType: 'user', targetId: String(result.user.id), ipAddress: req.ip });
  return res.redirect('/user/dashboard');
});

router.get('/2fa', (req, res) => {
  if (!req.session.pending2faUserId) {
    return res.redirect('/auth/login');
  }

  return res.render('auth/2fa', { error: null, success: null });
});

router.post('/2fa', (req, res) => {
  const userId = req.session.pending2faUserId;
  if (!userId) {
    return res.redirect('/auth/login');
  }

  const { code } = req.body;
  const ok = userService.verifyLogin2FA(userId, code);
  if (!ok) {
    return res.status(400).render('auth/2fa', { error: '2FA 코드가 유효하지 않거나 만료되었습니다.', success: null });
  }

  const user = userService.getUserById(userId);
  auditService.logEvent({ action: 'auth.2fa.success', targetType: 'user', targetId: String(userId), ipAddress: req.ip });
  const roles = userService.getUserRoles(userId);
  const token = tokenService.sign(user, roles);
  res.cookie('token', token, cookieOptions());
  req.session.pending2faUserId = null;
  return res.redirect('/user/dashboard');
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/auth/login' }), (req, res) => {
  const roles = userService.getUserRoles(req.user.id);
  const token = tokenService.sign(req.user, roles);
  res.cookie('token', token, cookieOptions());
  return res.redirect('/user/dashboard');
});

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/auth/login' }), (req, res) => {
  const roles = userService.getUserRoles(req.user.id);
  const token = tokenService.sign(req.user, roles);
  res.cookie('token', token, cookieOptions());
  return res.redirect('/user/dashboard');
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  auditService.logEvent({ actorUserId: req.user?.id || null, action: 'auth.logout', targetType: 'auth', ipAddress: req.ip });
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
