const mysql = require('mysql');

const db = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'categoryexpress'
});

exports.loginForm = (req, res, next) => {
    res.render('loginpage', { title: 'Express', session: req.session });
};

exports.login = (req, res, next) => {
    const user_name = req.body.user_name;
    const password = req.body.password;

    // Replace this query with your actual query to fetch user data
    const query = `
        SELECT * FROM users
        WHERE user_name = "${user_name}"
    `;

    db.query(query, (error, data) => {
        if (error) {
            console.error(error);
            return res.send('Database error');
        }

        if (data.length > 0) {
            const user = data[0];

            if (user.password === password) {
                req.session.user_id = user.id;
                req.session.user_name=user.user_name;
                return res.redirect("/categoryindex");
            } else {
                return res.send('Incorrect Password');
            }
        } else {
            return res.send('Incorrect Email Address');
        }
    });
};

exports.logout=(request, response, next)=>{

    request.session.destroy();

    response.redirect("/");

};

exports.signupForm=(req,res)=>{
    res.render('signuppage');
}

exports.signup = (req, res) => {
    const { name, user_name, password, confirm_password } = req.body;
    
    if (password !== confirm_password) {
        return res.status(422).json({ message: "Passwords do not match" });
    } else {
        // Check if the username already exists
        const checkQuery = `SELECT user_name FROM users WHERE user_name = ?`;
        db.query(checkQuery, [user_name], (err, checkResult) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (checkResult.length > 0) {
                return res.redirect(`/signup?error=${encodeURIComponent('Username already exists. Please choose a different Username.')}`);
            }

            // Insert the new user into the database
            const insertQuery = `INSERT INTO users (name, user_name, password) VALUES (?, ?, ?)`;
            db.query(insertQuery, [name, user_name, password], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                // Store session data and redirect to the main page
                req.session.user_name = user_name;
                req.session.user_id = result.insertId; // Assuming your primary key column is named 'id'
                req.session.name = name;

                res.redirect('/categoryindex'); // Update the actual route
            });
        });
    }
};




exports.view=(req, res) => {
    if(req.session.user_id){
        const user_id=req.session.user_id;
        const user_namee=req.session.user_name;
        console.log(req.session);
        console.log(user_id);
    db.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error connecting to the database");
        }
        const searchQuery = req.query.search || ''; // Get the search query from the request
        const sql = `
        SELECT a.cname, a.id, b.cname as pname, subquery.cc
        FROM category_manager AS a
        JOIN category_manager AS b ON b.id = a.pid
        LEFT JOIN (
            SELECT c_id, COUNT(*) AS cc FROM product_manager GROUP BY c_id
        ) AS subquery ON subquery.c_id = a.id
        WHERE (a.cname LIKE ? OR EXISTS (
            SELECT 1 FROM category_manager AS b WHERE b.id = a.pid AND b.cname LIKE ?
        ))
        AND a.user_id = ?;
        
        `;
        db.query(sql, [`%${searchQuery}%`, `%${searchQuery}%`,user_id], (err, rows) => {
            connection.release();  
            if (!err) {

                res.render('categoryindex.hbs', { category: rows, searchQuery: searchQuery ,user_namee});
            } else {
                console.log(err);
            }

            console.log('The data from Category table are : \n', rows);
        });
    });
}else{
    res.send("Unauthorised User")
}
};


exports.addCategoryForm=(req, res) => {
    if(req.session.user_id){
        const user_id=req.session.user_id;

    db.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error connecting to the database");
        }
        connection.query('SELECT distinct cname FROM categoryexpress.category_manager where pid=0 AND user_id=?',[user_id], (err, rows) => {
            connection.release()

            if (!err) {
                res.render('addCategory.hbs', { parentCategory: rows });
            } else {
                console.log(err);
            }

            console.log('The data from products table are : \n', rows);
        })

    })
}else{
    res.send("Unauthorised User")
}
};


exports.addCategory=(req, res) => {
    if(req.session.user_id){
        const user_id=req.session.user_id;

    const { cname, pname } = req.body;
    const checkQuery = `SELECT cname FROM category_manager WHERE cname = ? AND user_id=?`;
    db.query(checkQuery, [cname,user_id], (err, checkResult) => {
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
                    db.query(insertQuery, [cname, pid,user_id], (err, result) => {
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
}else{
    res.send("Unauthorised User")
}
};


exports.editCategoryForm=(req, res) => {
    if(req.session.user_id){

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
}else{
    res.send("Unauthorised User")
}
};

exports.editCategory = (req, res) => {
    if (req.session.user_id) {
        const id = req.body.id;
        const { cname, pname, original_cname } = req.body; // Add original_cname to your form

        if (cname !== original_cname) {
            const checkQuery = `SELECT cname FROM category_manager WHERE cname=?`;

            db.query(checkQuery, [cname], (error, checkResult) => {
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
        res.send("Unauthorized User");
    }
};


exports.deleteCategory=(req, res) => {
    if(req.session.user_id){

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
}else{
    res.send("Unauthorised User")
}
};

exports.productindex=(req, res) => {
    if(req.session.user_id){
        const user_id=req.session.user_id;

    const searchQuery = req.query.search || ''; // Get the search query from the request

    

    const sql = `
    SELECT a.produnct_name, a.price, a.quantity, b.cname, a.prod_id, a.product_image
    FROM product_manager AS a
    LEFT JOIN category_manager AS b ON b.id = a.c_id
    WHERE a.user_id = ? AND b.cname LIKE ?;
   
    
    `;

    db.query(sql, [user_id ,`%${searchQuery}%`], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching data from the database');
        }

        res.render('productindex.hbs', { products: rows, searchQuery: searchQuery });
    });
}else{
    res.send("Unauthorised User")
}
};

exports.addProductForm=(req, res) => {
    if(req.session.user_id){
    const user_id=req.session.user_id;

    db.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error connecting to the database");
        }

        const sql = "SELECT distinct cname FROM categoryexpress.category_manager where pid<>0 AND user_id=?;";
        db.query(sql,[user_id], (err, rows) => {
            connection.release();

            if (!err) {
                res.render('addproduct.hbs', { categories: rows, error_message: "" });
            } else {
                console.log(err);
                res.status(500).send("Error fetching data from the database");
            }
        });
    });
}else{
    res.send("Unauthorised User")
}
};


exports.addProduct= (req, res) => {
    if(req.session.user_id){
    const user_id=req.session.user_id;
    const {
        produnct_name,
        price,
        quantity,
        category
    } = req.body;
     console.log(category,req);
    let newImageName = '';
    if (req.file) {
        newImageName = req.file.filename;
    }

    const sql0 = 'SELECT id FROM category_manager WHERE cname = ? AND user_id=?';
    db.query(sql0, [category,user_id], (err, result1) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Query Unsuccessful');
        }

        const cid = result1[0].id;

        const matchingQuery = 'SELECT produnct_name FROM product_manager WHERE produnct_name = ? AND user_id=?';
        db.query(matchingQuery, [produnct_name,user_id], (err, queryResult) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Query Unsuccessful');
            }

            if (queryResult.length > 0) {
                const error_message = 'Product name already exists. Please choose a different name.';
                return res.status(400).json({ error_message });
            }

            const sql = 'INSERT INTO product_manager (produnct_name, price, quantity, c_id, product_image,user_id) VALUES (?, ?, ?, ?, ?,?)';
            db.query(sql, [produnct_name, price, quantity, cid, newImageName,user_id], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Query Unsuccessful');
                }
                
                res.redirect('/productindex'); // Redirect to product index page after update
            });
        });
    });
}else{
    res.send("Unauthorised User")
}
};

exports.editProductForm= (req, res) => {
    if(req.session.user_id){

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
            const getAllParentCategory = `SELECT distinct cname,pid,id FROM category.category_manager where pid>0 ;`
            db.query(getAllParentCategory, (parentErr, parentCategoryResult) => {
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
}else{
    res.send("Unauthorised User")
}
};

exports.editProduct= (req, res) => {
    if(req.session.user_id){

    
    const prod_id = req.body.prod_id;
    const produnct_name = req.body.produnct_name;
    const price = req.body.price;
    const pname =req.body.pname
    const quantity = req.body.quantity;
    let product_image_previous = req.body.product_image_previous; // Initial value


    const newImageName = req.file ? req.file.filename : product_image_previous;

    // Fetch category ID
    const getCidQuery = `SELECT id FROM category_manager WHERE cname = ?`;
    db.query(getCidQuery, [pname], (err, results) => {
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
}else{
    res.send("Unauthorised User")
}
};

exports.deleteProduct=(req, res) => {
    if(req.session.user_id){

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
}else{
    res.send("Unauthorised User")
}
};