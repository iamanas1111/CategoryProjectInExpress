const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true })
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const multer = require('multer')
const app = express()
const path = require('path')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})


app.use('/images', express.static(path.join(__dirname, 'public/images')));
const upload = multer({ storage: storage });

app.use(passport.initialize());
app.use(passport.session());
passport.use(
    new GoogleStrategy(
        {
            clientID: "873302452493-0vuedb8tub357qj1df5gqda4m533hihs.apps.googleusercontent.com",
            clientSecret: "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",
            callbackURL: "http://localhost:4000/auth/google/callback",
        },
        function (accessToken, refreshToken, profile, cb) {
            console.log(accessToken);
            cb(null, profile);
        }
    )
);

passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});


// Routes
router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    function (req, res) {
        res.redirect('/categoryindex');

    }
);

router.get('/', csrfProtection, userController.loginForm);
router.post('/login', csrfProtection, userController.login);
router.get('/signuppage', csrfProtection, userController.signupForm);
router.post('/signup', csrfProtection, userController.signup);
router.get('/verify', userController.verify);
router.post('/verify', userController.verify);
router.get('/logout', userController.logout);
router.get('/categoryindex', csrfProtection, userController.view);
router.get('/addCategory', userController.addCategoryForm);
router.post('/addCategory', userController.addCategory);
router.get('/editCategory', userController.editCategoryForm);
router.post('/editCategory', userController.editCategory);
router.get('/delete', userController.deleteCategory);
router.get('/productindex', userController.productindex);
router.get('/addproduct', userController.addProductForm);
router.post('/addproduct', upload.single('product_image'), userController.addProduct);
router.get('/editproduct', userController.editProductForm);
router.post('/editproduct', upload.single('product_image'), userController.editProduct);
router.get('/deleteproduct', userController.deleteProduct);
router.post('/deletemultipleproduct', userController.deleteMultiple)

router.get('*', userController.error);





module.exports = router;