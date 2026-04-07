const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const data = require("./data-service");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");

const app = express();
dotenv.config();

// set HTTP_PORT
const HTTP_PORT = process.env.PORT || 8080;

// parse form and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set static folder
app.use(express.static(path.join(__dirname, "public")));
app.use('/data', express.static('data'));

// routing setup
// app.get("/", (req, res) => {
//   res.send("Hello World");
// });

// mongoose connectionvar Schema = mongoose.Schema;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

var Schema = mongoose.Schema;

var shipmentSchema = new Schema({
"ShipmentID": Number,
"Status": String,
"Order Count": {type: Number, default: 0}
});

var orderSchema = new Schema({
"OrderID": Number,
"CustomerID": Number,
"Card Count": Number,
"Status": String
});

var customerSchema = new Schema({
"CustomerID": Number,
"Name": String,
"Email": String,
"PhoneNumber": String
});

var shipmentorderSchema = new Schema({
"ShipmentID": Number,
"OrderID": Number
});

var Shipment = mongoose.model("Shipment", shipmentSchema);
var Order = mongoose.model("Order", orderSchema);
var Customer = mongoose.model("Customer", customerSchema);
var ShipmentOrder = mongoose.model("ShipmentOrder", shipmentorderSchema);


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

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  data.checkLogin(username, password)
    .then((account) => {
      res.redirect(`/psa?customerId=${account.CustomerID}`);
    })
    .catch(() => {
      res.redirect("/login?error=invalid");
    });
});

app.post("/createaccount", (req, res) => {
  data.addAccount(req.body)
    .then((account) => {
      res.redirect(`/psa?customerId=${account.CustomerID}`);
    })
    .catch((err) => {
      res.redirect(`/accountcreation.html?error=${encodeURIComponent(err)}`);
    });
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