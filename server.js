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
"Order Count": {type: Number, default: 0},
"DateShipped": Date
});

var orderSchema = new Schema({
"OrderID": Number,
"CustomerID": Number,
"Card Count": Number,
"Status": String,
"Date": Date
});

var customerSchema = new Schema({
  CustomerID: { type: Number, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  Name: { type: String, required: true },
  Email: { type: String, unique: true, required: true },
  Password: { type: String, required: true }
});

var shipmentorderSchema = new Schema({
  "ShipmentID": Number,
  "OrderID": Number
});

var Shipment = mongoose.model("Shipment", shipmentSchema);
var Order = mongoose.model("Order", orderSchema);
var Customer = mongoose.model("Customer", customerSchema);
var ShipmentOrder = mongoose.model("ShipmentOrder", shipmentorderSchema);

async function checkLogin(username, password) {
  const account = await Customer.findOne({ username, Password: password })
    .select("CustomerID")
    .lean();

  if (!account) {
    throw new Error("Invalid login credentials");
  }

  return account;
}
async function getNextCustomerId() {
  const lastCustomer = await Customer.findOne().sort({ CustomerID: -1 }).select("CustomerID").lean();
  return lastCustomer ? lastCustomer.CustomerID + 1 : 1;
}

async function getNextOrderId() {
  const lastOrder = await Order.findOne().sort({ OrderID: -1 }).select("OrderID").lean();
  return lastOrder ? lastOrder.OrderID + 1 : 1;
}

async function getNextShipmentId() {
  const lastShipment = await Shipment.findOne().sort({ ShipmentID: -1 }).select("ShipmentID").lean();
  return lastShipment ? lastShipment.ShipmentID + 1 : 1;
}

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
  const customerId = req.query.customerId;

  if (customerId && Number(customerId) === 1) {
    return res.redirect("/employeepsa");
  }

  res.sendFile(path.join(__dirname, "views", "psa.html"));
});

app.get("/customer-orders", async (req, res) => {
  const customerId = parseInt(req.query.customerId, 10);

  if (!customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }

  try {
    const orders = await Order.find({ CustomerID: customerId }).lean();
    const orderIds = orders.map((order) => order.OrderID);
    const shipmentLinks = await ShipmentOrder.find({ OrderID: { $in: orderIds } }).lean();
    const shipmentIds = shipmentLinks.map((link) => link.ShipmentID);
    const shipments = await Shipment.find({ ShipmentID: { $in: shipmentIds } }).lean();

    const shipmentById = shipments.reduce((acc, shipment) => {
      acc[shipment.ShipmentID] = shipment;
      return acc;
    }, {});

    const linkByOrderId = shipmentLinks.reduce((acc, link) => {
      acc[link.OrderID] = link.ShipmentID;
      return acc;
    }, {});

    const result = orders.map((order) => {
      const shipmentId = linkByOrderId[order.OrderID];
      const shipment = shipmentById[shipmentId];

      return {
        OrderID: order.OrderID,
        CustomerID: order.CustomerID,
        cardCount: order["Card Count"],
        orderStatus: order.Status,
        shipmentStatus: shipment ? shipment.Status : "Not Assigned",
        dateShipped: shipment ? shipment.DateShipped : null
      };
    });

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Unable to load customer orders" });
  }
});

// login route
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const account = await checkLogin(username, password);
    res.redirect(`/psa?customerId=${account.CustomerID}`);
  } catch (err) {
    res.redirect("/login?error=invalid");
  }
});

app.post("/createaccount", async (req, res) => {
  try {
    const { username, email, name, password, passwordconfirm } = req.body;

    if (!username || !email || !name || !password || !passwordconfirm) {
      throw new Error("All fields are required.");
    }

    if (password !== passwordconfirm) {
      throw new Error("Passwords do not match.");
    }

    const existingUser = await Customer.findOne({ $or: [{ username }, { Email: email }] });
    if (existingUser) {
      throw new Error("A user with that username or email already exists.");
    }

    const customerId = await getNextCustomerId();
    const newCustomer = new Customer({
      CustomerID: customerId,
      username,
      Name: name,
      Email: email,
      Password: password
    });

    const savedCustomer = await newCustomer.save();
    res.redirect(`/psa?customerId=${savedCustomer.CustomerID}`);
  } catch (err) {
    res.redirect(`/accountcreation.html?error=${encodeURIComponent(err.message || err)}`);
  }
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

app.post("/createshipment", async (req, res) => {
  try {
    const shipmentId = await getNextShipmentId();

    const newShipment = new Shipment({
      ShipmentID: shipmentId,
      Status: "Pending",
      "Order Count": 0,
      DateShipped: null
    });

    await newShipment.save();
    res.redirect("/createshipment");
  } catch (err) {
    res.redirect(`/createshipment?error=${encodeURIComponent(err.message || err)}`);
  }
});

app.get("/pending-shipments", async (req, res) => {
  try {
    const pendingShipments = await Shipment.find({ Status: "Pending" })
      .select("ShipmentID DateShipped")
      .lean();
    res.json(pendingShipments);
  } catch (err) {
    res.status(500).json({ error: "Unable to load pending shipments" });
  }
});

app.get("/createorder", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "createorder.html"));
});

app.post("/createorder", async (req, res) => {
  try {
    const { customer, cardCount, shipmentId } = req.body;

    if (!customer || !cardCount) {
      throw new Error("Customer and card count are required.");
    }

    const customerRecord = await Customer.findOne({
      $or: [{ username: customer }, { Name: customer }, { Email: customer }]
    }).select("CustomerID").lean();

    if (!customerRecord) {
      throw new Error("Customer not found.");
    }

    const orderId = await getNextOrderId();
    const cardCountNumber = parseInt(cardCount, 10);

    if (isNaN(cardCountNumber) || cardCountNumber <= 0) {
      throw new Error("Card count must be a positive number.");
    }

    const newOrder = new Order({
      OrderID: orderId,
      CustomerID: customerRecord.CustomerID,
      "Card Count": cardCountNumber,
      Status: "Pending",
      Date: new Date()
    });

    await newOrder.save();

    if (shipmentId) {
      const selectedShipment = await Shipment.findOne({
        ShipmentID: parseInt(shipmentId, 10),
        Status: "Pending"
      }).lean();

      if (!selectedShipment) {
        throw new Error("Selected shipment is not pending or does not exist.");
      }

      await ShipmentOrder.create({
        ShipmentID: selectedShipment.ShipmentID,
        OrderID: newOrder.OrderID
      });

      await Shipment.updateOne(
        { ShipmentID: selectedShipment.ShipmentID },
        { $inc: { "Order Count": 1 } }
      );
    }

    res.redirect("/createorder");
  } catch (err) {
    res.redirect(`/createorder?error=${encodeURIComponent(err.message || err)}`);
  }
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