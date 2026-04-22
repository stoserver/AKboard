const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');
const env = require('./env');
const settingsService = require('../services/settingsService');
const userService = require('../services/userService');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, userService.getUserById(id) || null));

function providerSetting(dbKey, envValue) {
  return settingsService.getSetting(dbKey, envValue);
}

const googleClientId = providerSetting('oauth_google_client_id', env.oauthGoogleClientId);
const googleClientSecret = providerSetting('oauth_google_client_secret', env.oauthGoogleClientSecret);
if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: `${env.appBaseUrl}/auth/google/callback`
      },
      (accessToken, refreshToken, profile, done) => {
        const user = userService.findOrCreateOAuthUser({
          provider: 'google',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          username: profile.displayName || profile.username
        });
        done(null, user);
      }
    )
  );
}

const githubClientId = providerSetting('oauth_github_client_id', env.oauthGithubClientId);
const githubClientSecret = providerSetting('oauth_github_client_secret', env.oauthGithubClientSecret);
if (githubClientId && githubClientSecret) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: githubClientId,
        clientSecret: githubClientSecret,
        callbackURL: `${env.appBaseUrl}/auth/github/callback`
      },
      (accessToken, refreshToken, profile, done) => {
        const user = userService.findOrCreateOAuthUser({
          provider: 'github',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          username: profile.username
        });
        done(null, user);
      }
    )
  );
}

module.exports = passport;
