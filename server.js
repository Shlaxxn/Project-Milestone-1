const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const data = require("./data-service");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");

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

app.get("/accountcreation.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "accountcreation.html"));
});

app.get("/employeepsa", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "employeepsa.html"));
});

app.get("/createshipment", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "createshipment.html"));
});

app.post("/createshipment", (req, res) => {
  data.addShipment(req.body).then(() => {
    res.redirect("/createshipment");
  });
});

app.get("/createorder", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "createorder.html"));
});

app.post("/createorder", (req, res) => {
  data.addOrder(req.body).then(() => {
    res.redirect("/createorder");
  });
});

// run "node server.js" to start the setup server

// setup server 
data
  .initialize()
  .then(function () {
    app.listen(HTTP_PORT, function () {
      console.log(`App listening on port: ${HTTP_PORT}`);
    });
  })
  .catch(function (err) {
    console.log(`Unable to start server: ${err}`);
  });