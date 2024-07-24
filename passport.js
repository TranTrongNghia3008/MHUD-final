'use strict'

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const userModel = require('./models/userModel');

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await userModel.findOne({ Email: email });
    if (!user) {
        console.log('No user with that email')
      return done(null, false, { message: 'No user with that email.' });
    }

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return done(null, false, { message: 'Password incorrect.' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
