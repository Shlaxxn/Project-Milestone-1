const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const data = require("./data-service");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const exphbs = require("express-handlebars");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");

const app = express();
dotenv.config();

// set up handlebars
app.engine('.handlebars', exphbs.engine({ 
  extname: '.handlebars',
  defaultLayout: false,
  helpers: {
    eq: (a, b) => a === b,
    formatDate: (date) => {
      if (!date) return '';
      return date.toISOString().split('T')[0];
    }
  }
}));
app.set('view engine', '.handlebars');
app.set('views', path.join(__dirname, 'views'));

// set HTTP_PORT
const HTTP_PORT = process.env.PORT || 8080;

// Trust Render/Heroku/etc reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

// Fail fast if SESSION_SECRET is not set
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set in .env");
}

// Session middleware — keeps customers logged in for 24 hours
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  res.locals.loggedIn = !!req.session.customerId;
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));
app.use('/data', express.static('data'));

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
"Status": { type: String, enum: ["Pending", "Shipped", "Delivered"] },
"Order Count": {type: Number, default: 0},
"DateShipped": Date
});

var orderSchema = new Schema({
"OrderID": Number,
"CustomerID": Number,
"Card Count": Number,
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
  const account = await Customer.findOne({ username })
    .select("CustomerID Password")
    .lean();

  if (!account) {
    throw new Error("Invalid login credentials");
  }

  const match = await bcrypt.compare(password, account.Password);
  if (!match) {
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

// Middleware: employee-only routes
function requireEmployee(req, res, next) {
  if (req.session.customerId !== 1) {
    return res.redirect("/login");
  }
  next();
}

// Rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

//ROUTES BELOW

app.get("/", (req, res) => {
  res.render('home');
});

app.get("/calender", (req, res) => {
  res.render('calender');
});

app.get("/psa", async (req, res) => {
  const customerId = req.session.customerId;

  if (!customerId) return res.redirect("/login");
  if (customerId === 1) return res.redirect("/employeepsa");

  try {
    const orders = await Order.find({ CustomerID: customerId }).lean();
    const orderIds = orders.map(o => o.OrderID);
    const shipmentLinks = await ShipmentOrder.find({ OrderID: { $in: orderIds } }).lean();
    const shipmentIds = shipmentLinks.map(l => l.ShipmentID);
    const shipments = await Shipment.find({ ShipmentID: { $in: shipmentIds } }).lean();

    const shipmentById = {};
    shipments.forEach(s => shipmentById[s.ShipmentID] = s);

    const linkByOrderId = {};
    shipmentLinks.forEach(l => linkByOrderId[l.OrderID] = l.ShipmentID);

    const result = orders.map(o => ({
      OrderID: o.OrderID,
      cardCount: o["Card Count"],
      shipmentStatus: shipmentById[linkByOrderId[o.OrderID]]?.Status || "Not Assigned",
      dateShipped: shipmentById[linkByOrderId[o.OrderID]]?.DateShipped || null
    }));

    res.render('psa', { orders: result, customerId });
  } catch (err) {
    res.render('psa', { orders: [], error: 'Unable to load orders', customerId });
  }
});

// ADDED DELETE ORDER
app.post("/deleteorder", requireEmployee, async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ OrderID: Number(orderId) });
    if (!order) return res.redirect("/employeepsa");

    const link = await ShipmentOrder.findOne({ OrderID: order.OrderID });

    if (link) {
      await ShipmentOrder.deleteOne({ OrderID: order.OrderID });
      await Shipment.updateOne(
        { ShipmentID: link.ShipmentID },
        { $inc: { "Order Count": -1 } }
      );
    }

    await Order.deleteOne({ OrderID: order.OrderID });

    res.redirect("back");
  } catch (err) {
    console.log(err);
    res.redirect("/employeepsa");
  }
});

// ADDED DELETE SHIPMENT
app.post("/deleteshipment", requireEmployee, async (req, res) => {
  try {
    const { shipmentId } = req.body;

    const shipmentNum = Number(shipmentId);

    const links = await ShipmentOrder.find({ ShipmentID: shipmentNum });
    const orderIds = links.map(l => l.OrderID);

    await ShipmentOrder.deleteMany({ ShipmentID: shipmentNum });

    if (orderIds.length > 0) {
      await Order.deleteMany({ OrderID: { $in: orderIds } });
    }

    await Shipment.deleteOne({ ShipmentID: shipmentNum });

    res.redirect("/employeepsa");
  } catch (err) {
    console.log(err);
    res.redirect("/employeepsa");
  }
});

app.get("/employeepsa", requireEmployee, async (req, res) => {
  const shipmentId = req.query.shipmentId;
  const error = req.query.error;
  let errorMsg = '';

  if (error === 'update_failed') errorMsg = 'Failed to update shipment.';

  if (shipmentId) {
    const shipment = await Shipment.findOne({ ShipmentID: parseInt(shipmentId, 10) }).lean();
    if (!shipment) {
      return res.status(404).render('employeepsa', { error: 'Shipment not found' });
    }

    const shipmentOrders = await ShipmentOrder.find({ ShipmentID: parseInt(shipmentId, 10) }).lean();
    const orderIds = shipmentOrders.map(so => so.OrderID);
    const orders = await Order.find({ OrderID: { $in: orderIds } }).lean();

    const customerIds = [...new Set(orders.map(o => o.CustomerID))];
    const customers = await Customer.find({ CustomerID: { $in: customerIds } }).select("CustomerID username").lean();

    const customerMap = {};
    customers.forEach(c => customerMap[c.CustomerID] = c.username);

    const ordersWithCustomers = orders.map(order => ({
      OrderID: order.OrderID,
      CustomerUsername: customerMap[order.CustomerID] || 'Unknown',
      "Card Count": order["Card Count"],
      ShipmentStatus: shipment.Status,
      Date: order.Date
    }));

    res.render('employeepsa', { shipment, orders: ordersWithCustomers, view: 'details', error: errorMsg });
  } else {
    const shipments = await Shipment.aggregate([
      {
        $lookup: {
          from: 'shipmentorders',
          localField: 'ShipmentID',
          foreignField: 'ShipmentID',
          as: 'orders'
        }
      },
      {
        $addFields: {
          'Order Count': { $size: '$orders' }
        }
      },
      {
        $project: {
          orders: 0
        }
      }
    ]);

    res.render('employeepsa', { shipments, view: 'list', error: errorMsg });
  }
});

app.post("/employeepsa", requireEmployee, async (req, res) => {
  const { shipmentId, status, dateShipped } = req.body;

  if (!shipmentId || !["Pending", "Shipped", "Delivered"].includes(status)) {
    return res.redirect(`/employeepsa?shipmentId=${shipmentId || ''}&error=update_failed`);
  }

  try {
    const updateData = {
      Status: status,
      DateShipped: dateShipped ? new Date(dateShipped) : null
    };

    const updatedShipment = await Shipment.findOneAndUpdate(
      { ShipmentID: Number(shipmentId) },
      updateData,
      { new: true }
    );

    if (!updatedShipment) {
      return res.redirect(`/employeepsa?shipmentId=${shipmentId}&error=update_failed`);
    }

    res.redirect(`/employeepsa?shipmentId=${shipmentId}`);
  } catch (err) {
    console.log(err);
    res.redirect(`/employeepsa?shipmentId=${shipmentId}&error=update_failed`);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

data
  .initialize()
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log(`App listening on port: ${HTTP_PORT}`);
    });
  })
  .catch(err => {
    console.log(err);
  });