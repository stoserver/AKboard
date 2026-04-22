const express = require('express');
const installService = require('../services/installService');
const settingsService = require('../services/settingsService');

const router = express.Router();

router.get('/', (req, res) => {
  if (installService.isInstalled()) {
    return res.redirect('/auth/login');
  }

  return res.render('install/setup', { error: null, success: null });
});

router.post('/', (req, res) => {
  if (installService.isInstalled()) {
    return res.redirect('/auth/login');
  }

  const {
    siteName,
    databaseName,
    adminUsername,
    adminPassword,
    oauthGoogleClientId,
    oauthGoogleClientSecret,
    oauthGithubClientId,
    oauthGithubClientSecret,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    octomoApiKey,
    octomoVerifyUrl,
    octomoSendUrl,
    termsLabel,
    privacyLabel,
    twoFactorRequired
  } = req.body;

  if (!siteName || !databaseName || !adminUsername || !adminPassword || adminPassword.length < 8) {
    return res.status(400).render('install/setup', {
      error: '사이트 이름/DB 이름/최고 관리자 아이디/비밀번호(8자 이상)를 입력하세요.',
      success: null
    });
  }

  try {
    installService.completeInstallation({
      siteName,
      databaseName,
      adminUsername,
      adminPassword,
      oauthGoogleClientId,
      oauthGoogleClientSecret,
      oauthGithubClientId,
      oauthGithubClientSecret,
      smtpHost,
      smtpPort: Number(smtpPort || 587),
      smtpSecure: smtpSecure === 'on',
      smtpUser,
      smtpPass,
      octomoApiKey,
      octomoVerifyUrl,
      octomoSendUrl,
      termsLabel,
      privacyLabel,
      twoFactorRequired: twoFactorRequired === 'on'
    });
    return res.redirect('/install/success');
  } catch (error) {
    return res.status(400).render('install/setup', {
      error: error.message || '설치 중 오류가 발생했습니다.',
      success: null
    });
  }
});

router.get('/success', (req, res) => {
  if (!installService.isInstalled()) {
    return res.redirect('/install');
  }

  return res.render('install/setup', {
    error: null,
    success: `설치 후 환영합니다! ${settingsService.getSetting('site_name', 'AKBoard 1')} 준비가 완료되었습니다.`
  });
});

module.exports = router;
