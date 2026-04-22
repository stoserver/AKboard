const jwt = require('jsonwebtoken');
const env = require('../config/env');

function sign(user, roles) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function verify(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  sign,
  verify
};
