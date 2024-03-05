const passport = require("passport");
const keys = require("../keys/keys");
const { DataTypes } = require("sequelize")
const User = require("../models/user")(sequelize, DataTypes);
const bcrypt = require("bcrypt");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const BCRYPT_SALT_ROUNDS = 12;
const jwt = require("jsonwebtoken");
const { USER_ROLE } = require("../constants/authConstants");
const JWTStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt;
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
let opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("JWT");
opts.secretOrKey = "jwt-secret";

const errHandler = (err) => {
  console.log("Error :: " + err);
};

passport.serializeUser((user, done) => {
  done(null, user.ID);
});

passport.deserializeUser((id, done) => {
  User.findOne({ where: { ID: id } }).then((user) => {
    done(null, user);
  });
});

passport.use(
  "register",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true,
      session: false,
    },
    async (req, email, password, done) => {
      try {
        const user = await User.findOne({
          where: {
            [Op.or]: [
              {
                email,
              },
              { email: req.body.email },
            ],
          },
        });
        if (user != null) {
          console.log("username or email already taken");
          return done(null, false, {
            message: "username or email already taken",
          });
        }
        bcrypt.hash(password, BCRYPT_SALT_ROUNDS).then((hashedPassword) => {
          User.create({
            email,
            password: hashedPassword,
            role: USER_ROLE,
          }).then((user) => {
            console.log("user created");
            return done(null, user);
          });
        });
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  "login",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      session: false,
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({
          where: {
            email,
          },
        });
        if (user === null) {
          return done(null, false, { message: "bad username" });
        }
        const response = await bcrypt.compare(password, user.password);
        if (response !== true) {
          console.log("passwords do not match");
          return done(null, false, { message: "passwords do not match" });
        }
        console.log("user found & authenticated");
        return done(null, user);
      } catch (err) {
        console.log(err);
      }
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID: keys.googleClientID,
      clientSecret: keys.googleClientSecret,
      callbackURL: "/api/v1/user/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      let existingUser = await User.findOne({ where: { googleID: profile.id } });
      console.log(profile);
      if (!existingUser) {
        const userEmail = profile?._json?.email ? profile?._json?.email : null;
        existingUser = await User.findOne({ where: { email: userEmail } });
      }
      console.log("existingUser");
      console.log(existingUser);
      if (existingUser) {
        return done(null, existingUser);
      }
      // console.log(profile);
      const user = await User.create({ googleID: profile._json.sub, firstName: profile._json.given_name, lastName: profile._json.family_name, email: profile._json.email, is_admin: false }).catch(errHandler);
      console.log(profile._json);
      done(null, user);
    }
  )
);

passport.use(
  "jwt",
  new JWTStrategy(opts, (jwt_payload, done) => {
    done(null, jwt_payload);
  })
);
