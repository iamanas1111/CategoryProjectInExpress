const mysql = require('mysql');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const axios = require("axios"); // Import Axios or your preferred HTTP library


const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
        user: 'weldon.kemmer74@ethereal.email',
        pass: 'pTcYTCeGuSbzqGRyaV'
    }
})

function sendOTPByEmail(email, otp) {
    const mailOptions = {
        from: 'weldon.kemmer74@ethereal.email',
        to: email,
        subject: 'OTP Verification',
        text: `Your OTP for verification is: ${otp}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}


function generateOTP() {
    const length = 6;
    const characters = '0123456789';
    let OTP = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        OTP += characters.charAt(randomIndex);
    }

    return OTP;
}

const db = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'categoryexpress'
});

exports.loginForm = (req, res, next) => {
    console.log('Token to LoginForm/form: ' + req.csrfToken());
    res.render('loginpage', { title: 'Express', session: req.session, csrfToken: req.csrfToken });
};

exports.login = async (req, res, next) => {
    console.log('Token from LoginForm/form: ' + req.body._csrf)

    const user_name = req.body.user_name;
    const password = req.body.password;

    // Replace this query with your actual query to fetch user data
    const query = `
    SELECT * FROM users
    WHERE user_name = ?
  `;

    db.query(query, [user_name], async (error, results) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).send('Database error');
        }

        if (results.length > 0) {
            const user = results[0];

            // Compare the entered password with the hashed password in the database
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                // Set session variables
                req.session.user_id = user.id;
                req.session.user_name = user.user_name;
                return res.redirect('/categoryindex');
            } else {
                return res.send('Incorrect Password');
            }
        } else {
            return res.send('Incorrect Email Address');
        }
    });
};


exports.logout = (request, response, next) => {
    // if (request.session.passport && request.session.passport.user && request.session.passport.user?.password) {
    //     const access_token = request.session.passport.user.password;
    //     const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${access_token}`;

    //     // Send a POST request to revoke the access token
    //     axios.post(revokeUrl)
    //         .then(() => {
    //             // Access token revoked, destroy the session
    //             request.session.destroy((err) => {
    //                 if (err) {
    //                     // console.error(err);
    //                 }
    //                 // Redirect the user to the home page or a suitable URL after logout
    //                 response.redirect("/");
    //             });
    //         })
    //         .catch((error) => {
    //             console.error("Error revoking access token:", error);
    //             // Even if there's an error, still destroy the session and log the user out
    //             request.session.destroy((err) => {
    //                 if (err) {
    //                     // console.error(err);
    //                 }
    //                 // Redirect the user to the home page or a suitable URL after logout
    //                 response.redirect("/");
    //             });
    //         });
    // } else if (request.session.user_id) {
        // No access token or user session, just destroy the session and redirect
        request.session.destroy((err) => {
            if (err) {
                // console.error(err);
            }
            response.redirect("/");
        });
    // }
};



exports.signupForm = (req, res) => {
    console.log('Token to SignUp/form: ' + req.csrfToken());
    res.render('signuppage', { csrfToken: req.csrfToken });
}
const SECRET_KEY = "NOTESAPI";

exports.signup = async (req, res) => {
    const { name, user_name, password, confirm_password } = req.body;
    console.log('Token from Signup/form: ' + req.body._csrf)

    if (password !== confirm_password) {
        return res.status(422).json({ message: "Passwords do not match" });
    } else {
        // Check if the username already exists
        const checkQuery = `SELECT user_name FROM users WHERE user_name = ?`;
        db.query(checkQuery, [user_name], async (err, checkResult) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (checkResult.length > 0) {
                return res.redirect(`/signup?error=${encodeURIComponent('Username already exists. Please choose a different Username.')}`);
            }

            const generatedOTP = generateOTP();

            // Send OTP via email
            sendOTPByEmail(user_name, generatedOTP);
            req.session.generatedOTP = generatedOTP;
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert the new user into the database
            const insertQuery = `INSERT INTO users (name, user_name, password,otp) VALUES (?, ?, ?,?)`;
            db.query(insertQuery, [name, user_name, hashedPassword, generatedOTP], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                req.session.user_name = user_name;
                req.session.user_id = result.insertId; // Assuming your primary key column is named 'id'
                req.session.name = name;

                const token = jwt.sign({ user_name: user_name }, SECRET_KEY, { expiresIn: '1m' });

                res.cookie('token', token, { httpOnly: true });
                // res.status(201).json({ message: 'User registered successfully', token });

                res.render('verify', { user_name, generatedOTP, csrfToken: req.csrfToken });
            });
        });
    }
};

exports.verify = (req, res) => {
    const user_name = req.session.user_name;
    const preGeneratedOTP = req.session.generatedOTP;
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).send('Unauthorized');
    }

    // Verify  JWT token
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send('Unauthorized');
        }

        const decodedUsername = decoded.user_name;

        if (decodedUsername !== user_name) {
            return res.status(401).send('Unauthorized');
        }

        //  OTP verification 
        const checkQuery = `SELECT * FROM users WHERE user_name = ?`;
        db.query(checkQuery, [user_name], (error, rows) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Database error');
            }

            if (rows.length > 0) {
                const user = rows[0];

                if (user.otp == preGeneratedOTP) {
                    const message = 'User registered successfully';
                    res.render('categoryindex', { message });
                } else {
                    return res.status(401).send('Incorrect OTP');
                }
            } else {
                return res.status(401).send('User not found');
            }
        });
    });
};


exports.view = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id || 'DefaultId';;
        const user_namee = req.session.user_name || req.session.passport.user.name || 'DefaultUsername';
        const csrfToken = req.csrfToken();

        console.log(user_namee);
        console.log(user_id);
        const userProfile = req.session.passport?.user?.photo || 'DefaultPhoto';
        const userEmail = req.session.passport?.user?.user_name || 'undefined' || 'DefaultEmail';
        db.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error connecting to the database");
            }
            const searchQuery = req.query.search || ''; // Get the search query from the request
            const sql = `
            
            SELECT a.cname, a.id, b.cname AS pname, subquery.cc
            FROM category_manager AS a
            JOIN category_manager AS b ON b.id = a.pid
            LEFT JOIN (
                SELECT c_id, user_id, COUNT(*) AS cc FROM product_manager GROUP BY c_id, user_id
            ) AS subquery ON subquery.c_id = a.id AND subquery.user_id = "${user_id}"
            WHERE (a.cname LIKE "%${searchQuery}%" OR EXISTS (
                SELECT 1 FROM category_manager AS b WHERE b.id = a.pid AND b.cname LIKE "%${searchQuery}%"
            ))
            AND a.user_id = "${user_id}";
        
        `;
            // console.log(sql);
            db.query(sql, [user_id, `%${searchQuery}%`, `%${searchQuery}%`, user_id], (err, rows) => {
                connection.release();
                if (!err) {

                    res.render('categoryindex.hbs', { category: rows, searchQuery: searchQuery, user_namee, csrfToken, userProfile, userEmail });
                } else {
                    console.log(err);
                }

                console.log('The data from Category table are : \n', rows);
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};


exports.addCategoryForm = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;
        console.log(user_id);

        db.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error connecting to the database");
            }
            connection.query('SELECT distinct cname FROM categoryexpress.category_manager where pid=0 AND user_id=?', [user_id], (err, rows) => {
                connection.release()

                if (!err) {
                    res.render('addCategory.hbs', { parentCategory: rows });
                } else {
                    console.log(err);
                }

                console.log('The data from products table are : \n', rows);
            })

        })
    } else {
        res.render('unauthorisedUser')
    }
};


exports.addCategory = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;

        const { cname, pname } = req.body;
        const checkQuery = `SELECT cname FROM category_manager WHERE cname = ? AND user_id=?`;
        db.query(checkQuery, [cname, user_id], (err, checkResult) => {
            if (err) {
                console.log(err);
                return res.status(500).send("Database error");
            }

            if (checkResult.length > 0) {
                const error_message = "Category name already exists. Please choose a different name.";
                res.render('addCategory.hbs', { error_message });
            } else {
                let pid = 0;
                if (pname) {
                    const sql0 = `SELECT id FROM category_manager WHERE cname = ?`;
                    db.query(sql0, [pname], (err, result1) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).send("Database error");
                        }

                        if (result1.length > 0) {
                            pid = result1[0].id;
                        }

                        const insertQuery = `INSERT INTO category_manager (cname, pid,user_id) VALUES (?, ?,?)`;
                        db.query(insertQuery, [cname, pid, user_id], (err, result) => {
                            if (err) {
                                console.log(err);
                                return res.status(500).send("Database error");
                            }

                            res.redirect('/categoryindex');
                        });
                    });
                } else {
                    const insertQuery = `INSERT INTO category_manager (cname, pid,user_id) VALUES (?, ?, ?)`;
                    db.query(insertQuery, [cname, pid, user_id], (err, result) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).send("Database error");
                        }

                        res.redirect('/categoryindex');
                    });
                }
            }
        });
    } else {
        res.render('unauthorisedUser')
    }
};


exports.editCategoryForm = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {

        const id = req.query.id;
        const pname = req.query.pname;

        db.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error connecting to the database");
            }

            const sql = `SELECT * FROM category_manager WHERE id = ${id}`;
            connection.query(sql, (err, rows) => {
                if (err) {
                    console.log(err);
                    return res.status(500).send("Error querying the database");
                }

                const parentCategoriesSql = "SELECT distinct cname, pid, id FROM category_manager where pid=0;";
                connection.query(parentCategoriesSql, (err, parentCategories) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).send("Error querying the database");
                    }

                    const processedParentCategories = parentCategories.map(category => {
                        return {
                            ...category,
                            selected: category.cname === pname
                        };
                    });

                    res.render('editCategory', {
                        categories: rows,
                        parentCategories: processedParentCategories,
                        error_message: '',
                        pname: pname

                    });
                    console.log(pname);

                });

                connection.release();
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.editCategory = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const id = req.body.id;
        const user_id = req.session.user_id || req.session.passport?.user?.id;

        const { cname, pname, original_cname } = req.body; // Add original_cname to your form

        if (cname !== original_cname) {
            const checkQuery = `SELECT cname FROM category_manager WHERE cname=? AND user_id=?`;

            db.query(checkQuery, [cname, user_id], (error, checkResult) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send("Database Error");
                }

                if (checkResult.length > 0) {
                    const error_message = "Category name already exists. Please choose a different name.";
                    return res.render('editCategory.hbs', { error_message });
                } else {
                    updateCategory();
                }
            });
        } else {
            updateCategory();
        }

        function updateCategory() {

            if (pname) {

                const updateQuery = `UPDATE category_manager SET cname=?, pid=? WHERE id=?`;
                db.query(updateQuery, [cname, pname, id], (error, result) => {
                    if (error) {
                        console.log(error);
                        return res.status(500).send("Database Error");
                    }

                    res.redirect("/categoryindex");
                });

            } else {
                const updateQuery = `UPDATE category_manager SET cname=? WHERE id=?`;
                db.query(updateQuery, [cname, id], (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).send("Database Error");
                    }

                    res.redirect('/categoryindex');
                });
            }
        }
    } else {
        res.render('unauthorisedUser')
    }
};


exports.deleteCategory = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {

        const categoryId = req.query.id;

        db.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error connecting to the database");
            }

            connection.query('DELETE FROM category_manager WHERE id = ?', [categoryId], (err, result) => {
                connection.release();

                if (err) {
                    console.error(err);
                    return res.status(500).send("Error deleting product from the database");
                }

                res.redirect('/categoryindex'); // Redirect back to the product list
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.productindex = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;

        const searchQuery = req.query.search || ''; // Get the search query from the request



        const sql = `
    SELECT a.produnct_name, a.price, a.quantity, b.cname, a.prod_id, a.product_image
    FROM product_manager AS a
    LEFT JOIN category_manager AS b ON b.id = a.c_id
    WHERE a.user_id = ? AND a.produnct_name LIKE ?;
   
    
    `;

        db.query(sql, [user_id, `%${searchQuery}%`], (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching data from the database');
            }

            res.render('productindex.hbs', { products: rows, searchQuery: searchQuery });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.addProductForm = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;

        db.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error connecting to the database");
            }

            const sql = "SELECT distinct cname FROM categoryexpress.category_manager where pid<>0 AND user_id=?;";
            db.query(sql, [user_id], (err, rows) => {
                connection.release();

                if (!err) {
                    res.render('addproduct.hbs', { categories: rows, error_message: "" });
                } else {
                    console.log(err);
                    res.status(500).send("Error fetching data from the database");
                }
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};


exports.addProduct = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;
        const {
            produnct_name,
            price,
            quantity,
            category
        } = req.body;
        console.log(category, req);
        let newImageName = '';
        if (req.file) {
            newImageName = req.file.filename;
        }

        const sql0 = 'SELECT id FROM category_manager WHERE cname = ? AND user_id=?';
        db.query(sql0, [category, user_id], (err, result1) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Query Unsuccessful');
            }

            const cid = result1[0].id;

            const matchingQuery = 'SELECT produnct_name FROM product_manager WHERE produnct_name = ? AND user_id=?';
            db.query(matchingQuery, [produnct_name, user_id], (err, queryResult) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Query Unsuccessful');
                }

                if (queryResult.length > 0) {
                    const error_message = 'Product name already exists. Please choose a different name.';
                    return res.status(400).json({ error_message });
                }

                const sql = 'INSERT INTO product_manager (produnct_name, price, quantity, c_id, product_image,user_id) VALUES (?, ?, ?, ?, ?,?)';
                db.query(sql, [produnct_name, price, quantity, cid, newImageName, user_id], (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Query Unsuccessful');
                    }

                    res.redirect('/productindex'); // Redirect to product index page after update
                });
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.editProductForm = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        const user_id = req.session.user_id || req.session.passport?.user?.id;

        const id = req.query.param1;
        const pname = req.query.param2;

        const getProductQuery = `SELECT * FROM product_manager WHERE prod_id = ?`;
        db.query(getProductQuery, [id], (productErr, productResult) => {
            if (productErr) {
                console.error(productErr);
                return res.status(500).send("Query Unsuccessful");
            }

            // Fetch data from category_manager table
            const getCategoriesQuery = `SELECT * FROM category_manager WHERE cname = ?`;
            db.query(getCategoriesQuery, [pname], (categoryErr, categoryResult) => {
                if (categoryErr) {
                    console.error(categoryErr);
                    return res.status(500).send("Query Unsuccessful");
                }

                // Fetch all parent categories
                const getAllParentCategory = `SELECT distinct cname,pid,id FROM categoryexpress.category_manager where pid>0 AND user_id=?;`
                db.query(getAllParentCategory, [user_id], (parentErr, parentCategoryResult) => {
                    if (parentErr) {
                        console.error(parentErr);
                        return res.status(500).send("Query Unsuccessful");
                    }

                    // Process parent categories to set selected flag
                    const processedParentCategories = parentCategoryResult.map(category => {
                        return {
                            ...category,
                            selected: category.cname === pname
                        };
                    });

                    // Render the editproduct template with data
                    res.render('editproduct', {
                        error_message: '',
                        productData: productResult,
                        categories: categoryResult,
                        parentCategories: processedParentCategories,
                        pname: pname
                    });
                });
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.editProduct = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {

        const user_id = req.session.user_id || req.session.passport?.user?.id;

        const prod_id = req.body.prod_id;
        const produnct_name = req.body.produnct_name;
        const price = req.body.price;
        const pname = req.body.pname
        const quantity = req.body.quantity;
        let product_image_previous = req.body.product_image_previous; // Initial value


        const newImageName = req.file ? req.file.filename : product_image_previous;

        // Fetch category ID
        const getCidQuery = `SELECT id FROM category_manager WHERE cname = ? AND user_id=?`;
        db.query(getCidQuery, [pname, user_id], (err, results) => {
            if (err) {
                console.error('Error fetching category ID:', err);
                return res.status(500).send('Query Unsuccessful');
            }

            console.log('Results:', results); // Add this line

            if (results.length === 0) {
                console.log('No matching category found');
                return res.status(500).send('Category Not Found');
            }

            const cid = results[0].id;

            // Update product data
            const updateProductQuery = `UPDATE product_manager 
                                    SET produnct_name = ?, price = ?, quantity = ?, c_id = ?, product_image = ? 
                                    WHERE prod_id = ?`;
            db.query(updateProductQuery, [produnct_name, price, quantity, cid, newImageName, prod_id], (err, result) => {
                if (err) {
                    console.error('Error updating product:', err);
                    return res.status(500).send('Query Unsuccessful');
                }

                console.log('Product updated successfully');
                res.redirect('/productindex'); // Redirect to product index page after update
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.deleteProduct = (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {

        const id = req.query.id;
        const category = req.query.param2;

        let cid;

        const sql0 = `SELECT id FROM category_manager WHERE cname = ?`;
        db.query(sql0, [category], (err, result1) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Query Unsuccessful');
            }

            cid = result1[0].id;

            const sql = `DELETE FROM product_manager WHERE prod_id = ?`;
            db.query(sql, [id], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Query Unsuccessful');
                }

                // Perform any other necessary updates

                res.redirect('/productindex');
            });
        });
    } else {
        res.render('unauthorisedUser')
    }
};

exports.deleteMultiple = async (req, res) => {
    if (req.session.user_id || req.session.passport?.user?.id) {
        res.render('unauthorisedUser')
    }
    const { selected } = req.body;

    if (!selected || !Array.isArray(selected) || selected.length === 0) {
        return res.status(400).send('Invalid selection');
    }

    try {

        for (const id of selected) {
            await db.query('DELETE FROM product_manager WHERE prod_id = ?', [id]);

        }

        res.redirect('/productindex'); // Redirect back to your original page
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }

};

exports.error = (req, res) => {
    res.render('error')
}

