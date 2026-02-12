const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const data = require("./data-service");

const app = express();
dotenv.config();

// set HTTP_PORT
const HTTP_PORT = process.env.PORT || 8080;

// set static folder
app.use(express.static(path.join(__dirname, "Public")));

// routing setup
// app.get("/", (req, res) => {
//   res.send("Hello World");
// });

// home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

// about route
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "about.html"));
});

// employees route
app.get("/employees", (req, res) => {
  data
    .getAllEmployees()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ message: err });
    });

  // res.send("Hello");
});

// managers route
app.get("/managers", (req, res) => {
  data
    .getManagers()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ message: err });
    });
});

// departments route
app.get("/departments", (req, res) => {
  data
    .getDepartments()
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ message: err });
    });
});


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
