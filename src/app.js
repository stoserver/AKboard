const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const ipBlockMiddleware = require('./middleware/ipBlock');
const setupGuard = require('./middleware/setupGuard');
const passport = require('./config/passport');
const settingsService = require('./services/settingsService');

const installRoutes = require('./routes/installRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use((req, res, next) => {
  res.locals.siteName = settingsService.getSetting('site_name', 'AKBoard 1');
  next();
});
app.use(ipBlockMiddleware);
app.use(setupGuard);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'
  })
);

app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

app.use('/install', installRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: '페이지를 찾을 수 없습니다.' });
});

module.exports = app;
