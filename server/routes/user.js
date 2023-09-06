const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const csrf =require('csurf');
const csrfProtection = csrf({cookie:true})

const multer = require('multer')
const app = express()
const path=require('path')

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
// Routes
router.get('/',csrfProtection,userController.loginForm);
router.post('/login',csrfProtection,userController.login);
router.get('/signuppage',userController.signupForm);
router.post('/signup',userController.signup);
router.get('/verify',userController.verify);
router.post('/verify',userController.verify);
router.get('/logout',userController.logout);
router.get('/categoryindex', userController.view);
router.get('/addCategory', userController.addCategoryForm);
router.post('/addCategory', userController.addCategory);
router.get('/editCategory', userController.editCategoryForm);
router.post('/editCategory', userController.editCategory);
router.get('/delete', userController.deleteCategory);
router.get('/productindex', userController.productindex);
router.get('/addproduct', userController.addProductForm);
router.post('/addproduct',upload.single('product_image'),userController.addProduct);
router.get('/editproduct',userController.editProductForm);
router.post('/editproduct',upload.single('product_image'),userController.editProduct);
router.get('/deleteproduct',userController.deleteProduct);
router.post('/deletemultipleproduct',userController.deleteMultiple)

router.get('*',userController.error);




  
module.exports = router;