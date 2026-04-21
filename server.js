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
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,               // JS cannot read the cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax'              // blocks cross-site POST (CSRF mitigation)
  }
}));

// Make login state available to all templates
app.use((req, res, next) => {
  res.locals.loggedIn = !!req.session.customerId;
  next();
});

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

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

//ROUTES BELOW

// home route
app.get("/", (req, res) => {
  res.render('home');
});

// calender route
app.get("/calender", (req, res) => {
  res.render('calender');
});

// PSA route
app.get("/psa", async (req, res) => {
  const customerId = req.session.customerId;

  if (!customerId) {
    return res.redirect("/login");
  }

  if (customerId === 1) {
    return res.redirect("/employeepsa");
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
        cardCount: order["Card Count"],
        shipmentStatus: shipment ? shipment.Status : "Not Assigned",
        dateShipped: shipment ? shipment.DateShipped : null
      };
    });

    res.render('psa', { orders: result, customerId });
  } catch (err) {
    console.log(err);
    res.render('psa', { orders: [], error: 'Unable to load orders', customerId });
  }
});

app.get("/customer-orders", async (req, res) => {
  const customerId = req.session.customerId;

  if (!customerId) {
    return res.status(401).json({ error: "Not logged in" });
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
  const error = req.query.error;
  res.render('login', { error: error === 'invalid' ? 'Invalid username or password' : null });
});

app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const account = await checkLogin(username, password);
    // Regenerate session to prevent session fixation
    req.session.regenerate((err) => {
      if (err) return res.redirect("/login?error=invalid");
      req.session.customerId = account.CustomerID;
      res.redirect("/psa");
    });
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
    const hashedPassword = await bcrypt.hash(password, 12);
    const newCustomer = new Customer({
      CustomerID: customerId,
      username,
      Name: name,
      Email: email,
      Password: hashedPassword
    });

    const savedCustomer = await newCustomer.save();
    req.session.customerId = savedCustomer.CustomerID;
    res.redirect("/psa");
  } catch (err) {
    res.redirect(`/accountcreation?error=${encodeURIComponent(err.message || err)}`);
  }
});

app.get("/accountcreation", (req, res) => {
  const error = req.query.error;
  res.render('accountcreation', { error: error ? decodeURIComponent(error) : null });
});

app.get("/employeepsa", requireEmployee, async (req, res) => {
  try {
    const shipmentId = req.query.shipmentId;
    const error = req.query.error;
    let errorMsg = '';
    if (error === 'update_failed') errorMsg = 'Failed to update shipment.';
    if (shipmentId) {
      // Show shipment details with orders
      const shipment = await Shipment.findOne({ ShipmentID: parseInt(shipmentId, 10) }).lean();
      if (!shipment) {
        return res.status(404).render('employeepsa', { error: 'Shipment not found' });
      }
      const shipmentOrders = await ShipmentOrder.find({ ShipmentID: parseInt(shipmentId, 10) }).lean();
      const orderIds = shipmentOrders.map(so => so.OrderID);
      const orders = await Order.find({ OrderID: { $in: orderIds } }).lean();
      const customerIds = [...new Set(orders.map(o => o.CustomerID))];
      const customers = await Customer.find({ CustomerID: { $in: customerIds } }).select("CustomerID username").lean();
      const customerMap = customers.reduce((acc, c) => {
        acc[c.CustomerID] = c.username;
        return acc;
      }, {});
      const ordersWithCustomers = orders.map(order => ({
        OrderID: order.OrderID,
        CustomerUsername: customerMap[order.CustomerID] || 'Unknown',
        "Card Count": order["Card Count"],
        ShipmentStatus: shipment.Status,
        Date: order.Date
      }));
      res.render('employeepsa', { shipment, orders: ordersWithCustomers, view: 'details', error: errorMsg });
    } else {
      // Show list of shipments
      const shipments = await Shipment.aggregate([
        {
          $lookup: {
            from: 'shipmentorders', // collection name, assuming it's 'shipmentorders'
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
            orders: 0 // remove the orders array from output
          }
        }
      ]);
      res.render('employeepsa', { shipments, view: 'list', error: errorMsg });
    }
  } catch (err) {
    console.log(err);
    res.status(500).render('employeepsa', { error: 'Unable to load data' });
  }
});

const ALLOWED_STATUSES = ["Pending", "Shipped", "Delivered"];

app.post("/employeepsa", requireEmployee, async (req, res) => {
  const { shipmentId, status, dateShipped } = req.body;

  if (!shipmentId || !ALLOWED_STATUSES.includes(status)) {
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

    console.log('Shipment update result:', updatedShipment);

    if (!updatedShipment) {
      return res.redirect(`/employeepsa?shipmentId=${shipmentId}&error=update_failed`);
    }

    res.redirect(`/employeepsa?shipmentId=${shipmentId}`);
  } catch (err) {
    console.log('Shipment update error:', err);
    res.redirect(`/employeepsa?shipmentId=${shipmentId}&error=update_failed`);
  }
});

app.get("/employee-search", requireEmployee, async (req, res) => {
  const query = req.query.name ? req.query.name.trim() : '';

  if (!query) {
    return res.render('employeesearch', { query: '', customers: null });
  }

  try {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = await Customer.find({
      Name: { $regex: escapedQuery, $options: 'i' }
    }).lean();

    if (customers.length === 0) {
      return res.render('employeesearch', { query, customers: [] });
    }

    const customerIds = customers.map(c => c.CustomerID);
    const orders = await Order.find({ CustomerID: { $in: customerIds } }).lean();
    const orderIds = orders.map(o => o.OrderID);
    const shipmentLinks = await ShipmentOrder.find({ OrderID: { $in: orderIds } }).lean();
    const shipmentIds = shipmentLinks.map(l => l.ShipmentID);
    const shipments = await Shipment.find({ ShipmentID: { $in: shipmentIds } }).lean();

    const shipmentById = shipments.reduce((acc, s) => { acc[s.ShipmentID] = s; return acc; }, {});
    const shipmentByOrderId = shipmentLinks.reduce((acc, l) => { acc[l.OrderID] = l.ShipmentID; return acc; }, {});

    const ordersByCustomer = orders.reduce((acc, order) => {
      const shipmentId = shipmentByOrderId[order.OrderID];
      const shipment = shipmentById[shipmentId];
      if (!acc[order.CustomerID]) acc[order.CustomerID] = [];
      acc[order.CustomerID].push({
        OrderID: order.OrderID,
        cardCount: order["Card Count"],
        date: order.Date,
        shipmentStatus: shipment ? shipment.Status : "Not Assigned",
        dateShipped: shipment ? shipment.DateShipped : null
      });
      return acc;
    }, {});

    const results = customers.map(c => ({
      CustomerID: c.CustomerID,
      Name: c.Name,
      username: c.username,
      Email: c.Email,
      orders: ordersByCustomer[c.CustomerID] || []
    }));

    res.render('employeesearch', { query, customers: results });
  } catch (err) {
    console.log(err);
    res.render('employeesearch', { query, customers: [], error: 'Search failed' });
  }
});

app.get("/createshipment", requireEmployee, (req, res) => {
  res.render('createshipment');
});

app.post("/createshipment", requireEmployee, async (req, res) => {
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

app.get("/createorder", requireEmployee, async (req, res) => {
  try {
    const pendingShipments = await Shipment.find({ Status: "Pending" }).select("ShipmentID").lean();
    res.render('createorder', { pendingShipments });
  } catch (err) {
    console.log(err);
    res.render('createorder', { pendingShipments: [], error: 'Unable to load shipments' });
  }
});

app.post("/createorder", requireEmployee, async (req, res) => {
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

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
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