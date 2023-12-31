const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();
const jwt = require('jsonwebtoken');    
const bcrypt = require("bcrypt");

//create and config server
const app = express();
app.use(cors());
app.use(express.json({limit: "25MB"}));

///BD connection
async function getConnection() {
    //create & config connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST, 
      user: process.env.DB_USER, 
      password: process.env.DB_PASS,
      database: process.env.DB_DATABASE 
    });
  
    connection.connect();
    return connection;
  }

  const generateToken = (payload) => {
    const token = jwt.sign(payload, "secret", { expiresIn: "12h" });
    return token;
  };

//init server/listener
  const serverPort = process.env.PORT || 4000;
  app.listen(serverPort, () => {
    console.log(`Server listening at http://localhost:${serverPort}`);
  });

//endpoints

/////////////endpoint GET: get all books
app.get("/api/books", async (req, res) =>{
    //getConnection
    const conn = await getConnection();
    //Query
    const queryBooks = "SELECT * FROM library";
    //Execute query
    const [results] = await conn.query(queryBooks);
    //End connection
    conn.end();
    //response
    res.json(results);
  });

/////////////endpoint GET with id: get book by id
app.get('/books/:id', async (req, res) => {
    ///get id by params
    const id = req.params.id;
    //Query
    const queryBook = 'SELECT * FROM library WHERE idBook = ?';
    //getConnection
    const conn = await getConnection();
    //Execute query
    const [result] = await conn.query(queryBook, id);
    //End connection
    conn.end();
    //response when the id doesn´t exist in the DB
    const numOfElements = result.length;
    if (numOfElements === 0) {
      res.json({
        success: true,
        message: "Creo que no hemos encontrado tu libro",
      });
      return;
    }
    //response
    res.json(result);
  })

  /////////endpoint POST: add new book
  app.post("/books", async (req, res) => {
    ///get data by bodyparams
    const dataBooks = req.body;
    const { title, author, genre, release_year, country, description} = dataBooks;
    //Query
    const queryNewBook =
      "INSERT INTO library (title, author, genre, release_year, country, description) VALUES (?, ?, ?, ?, ?, ?);";
    try {
       //getConnection
      const conn = await getConnection();
       //Execute query
      const [result] = await conn.query(queryNewBook, [
        title, author, genre, release_year, country, description
      ]);
      //Check if the book is already in the DB
      if (result.affectedRows === 0) {
        res.json({
          success: false,
          message: "Tu libro no se ha añadido. Prueba con otro",
        });
        return;
      }
      ////result successful
      res.json({
        success: true,
        id: result.insertId
      });
    } catch (error) {
        ////result unsuccessful/error
      res.json({
        success: false,
        message: `Ha habido un problema: ${error}`,
      });
    }
  });

/////////endpoint PUT: update book
app.put("/books/:id", async (req, res) => {
    ///get data by bodyparams
    const dataBooks = req.body;
    const { title, author, genre, release_year, country, description} = dataBooks;
    ///get id by params
    const id = req.params.id;
    //Check if the book exists in the DB and update it
    const queryUpdateBook =
      "UPDATE library SET title = ?, author = ?, genre = ?, release_year = ?, country = ?, description = ? WHERE idBook = ?";
    //getConnection
    const conn = await getConnection();
    //Execute query
    const [result] = await conn.query(queryUpdateBook, [
    title, author, genre, release_year, country, description, id
    ]);
    ///response
    res.json({
      success: true,
      message: "Enhorabuena! Tu libro se ha actualizado correctamente",
    });
  });

/////////endpoint DELETE: delete book
app.delete("/books/:id", async (req, res) => {
     ///get id by params
     const id = req.params.id;
    //Check if the book exists in the DB and delete it
     const queryDeleteBook =
     "DELETE FROM library WHERE idBook = ?";
    //getConnection
    const conn = await getConnection();
    //Execute query
    const [result] = await conn.query(queryDeleteBook, id);
    res.json({
      success: true,
      message: "Tu libro se ha eliminado correctamente",
    });
    conn.end();
  });

////////endpoint SIGN UP
app.post("/api/signup", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;
    //use bcrypt to encrypt password
    const passwordHashed = await bcrypt.hash(password, 10);
    //query
    const querySignUp = "INSERT INTO users_db (username, email, password) VALUES (?, ? ,?)";
    //getConnection and Execute query
    jwt.sign(password, 'secret_key', async (error, token) => {
        if (error) {
          res.status(400).send({"success": false, message: 'Error' });
        } else {
          const conn = await getConnection();
          const [result] = await conn.query(querySignUp, [username, email,passwordHashed]);
          conn.end();
          res.json({
            success: true,
            token: token,
            id: result.insertId
          });
        }
      });
  });
  
////////endpoint LOGIN
app.post("/api/login", async (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    //query to check if the user exists in the DB
    const queryLogin = "SELECT * FROM users_db WHERE email = ?";
    //getConnection and Execute query, get only the first user
    const conn = await getConnection();
    const [users] = await conn.query(queryLogin, [email]);
    const user = users[0]; 
    //check if the user password are the ones in the DB
    const passwordCorrect =
      user === null
        ? false
        : await bcrypt.compare(password, user.password);
    ///Incorrect credentials: unsuccessful request
    if (!(passwordCorrect && user)) {
      return res.json({ success: false, message: "Las credenciales que has introducido no son válidas" });
    }
    //Correct credentials: successful request
    const goodToken = {
      email: user.email,
      id: user.id,
    };
    const token = generateToken(goodToken);
    res.json({ 
        success: true, 
        token, 
        username: user.username 
    });
  });
