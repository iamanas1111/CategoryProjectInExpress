require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const db = require('./db')
const bcrypt = require('bcrypt')
const routes = require('./server/routes/user');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const app = express();

// View engine setup
app.set('view engine', 'hbs');
app.use('/css', express.static(path.join(__dirname, 'css')));
app.set('views', path.join(__dirname, 'views'));

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(
  session({
    secret: uuidv4(),
    resave: false,
    saveUninitialized: true,
  })
);

// Routes
app.use('/', routes);

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK,
    },
    function (accessToken, refreshToken, profile, cb) {
      bcrypt.hash(accessToken, 10, (hashErr, hashedToken) => {
        if (hashErr) {
          return cb(hashErr);
        }

        // Add user data to the profile object
        profile.accessToken = hashedToken; // Store the hashed token

        // Check if the user already exists in the database based on their email
        const userEmail = profile.emails[0].value;
        const selectUserQuery = 'SELECT * FROM users WHERE user_name = ?';

        db.query(selectUserQuery, [userEmail], (err, rows) => {
          if (err) {
            return cb(err);
          }

          if (rows && rows.length > 0) {
            // Update existing user data with the hashed token
            const updateUserQuery =
              'UPDATE users SET name = ?, user_name = ?, photo = ?, password = ? WHERE password = ?';

            db.query(
              updateUserQuery,
              [
                profile.displayName,
                userEmail,
                profile.photos[0].value,
                hashedToken, // Store the hashed token in the database
                accessToken, // Match based on the original access token
              ],
              (updateErr) => {
                if (updateErr) {
                  return cb(updateErr);
                }
                // Return the updated user data from the database
                return cb(null, rows[0]);
              }
            );
          } else {
            // Create a new user record with the hashed token
            const newUser = {
              password: hashedToken, // Store the hashed token in the database
              name: profile.displayName,
              user_name: userEmail,
              photo: profile.photos[0].value,
            };
            const insertUserQuery = 'INSERT INTO users SET ?';
            db.query(insertUserQuery, newUser, (insertErr, result) => {
              if (insertErr) {
                return cb(insertErr);
              }
              newUser.id = result.insertId;
              cb(null, newUser);
            });
          }
        });
      });
    }
  )
);


passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});
app.use(passport.initialize());
app.use(passport.session());


// Start the server
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
