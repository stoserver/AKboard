const env = require('../config/env');
const settingsService = require('./settingsService');

function getSmsConfig() {
  return {
    apiKey: settingsService.getSetting('octomo_api_key', env.octomoApiKey),
    verifyUrl: settingsService.getSetting('octomo_verify_url', env.octomoVerifyUrl),
    sendUrl: settingsService.getSetting('octomo_send_url', env.octomoSendUrl)
  };
}

async function sendVerificationSms({ phone, code, sender = '1666-3538' }) {
  const { apiKey, sendUrl } = getSmsConfig();
  if (!apiKey || !sendUrl) {
    return false;
  }

  try {
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey
      },
      body: JSON.stringify({ phone, sender, message: `AKBoard 인증코드: ${code}` })
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.sent === true || payload?.success === true || payload?.result === true;
  } catch (error) {
    return false;
  }
}

async function verifyViaOctomo({ phone, code }) {
  const { apiKey, verifyUrl } = getSmsConfig();

  if (!apiKey || !verifyUrl) {
    return false;
  }

  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey
      },
      body: JSON.stringify({ phone, code })
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.verified === true || payload?.success === true || payload?.result === true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  sendVerificationSms,
  verifyViaOctomo
};
