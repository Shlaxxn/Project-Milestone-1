const express = require("express");
const dotenv = require("dotenv");
const path = require("path");


const app = express();
dotenv.config();

// set HTTP_PORT
const HTTP_PORT = process.env.PORT || 8080;

// set static folder
app.use(express.static(path.join(__dirname, "public")));

// routing setup
// app.get("/", (req, res) => {
//   res.send("Hello World");
// });

//ROUTES BELOW

// home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

// calender route
app.get("/calender", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "calender.html"));
});

// PSA route
app.get("/psa", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "psa.html"));
});

// login route
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});


// run "node server.js" to start the setup server

// setup server
app.listen(HTTP_PORT, function () {
  console.log(`App listening on port: ${HTTP_PORT}`);
});
  
