const fs = require("fs");

let shipments = [];
let orders = [];
let customers = [];

var mongoose = require("mongoose");
var Schema = mongoose.Schema;

mongoose.connect("mongodb+srv://aacardscalendar_db_user:<jODVZR0QxpGBmk4N>@aacardscluster.22qy1qa.mongodb.net/?appName=AACardsCluster");

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

module.exports.initialize = function () {
  return new Promise((resolve, reject) => {
    // helper to parse JSON and default to empty array on empty file
    const safeParse = (text) => {
      if (!text || text.trim() === "") return [];
      return JSON.parse(text);
    };

    fs.readFile("./data/shipments.json", "utf8", (err, data) => {
      if (err) {
        reject("Unable to read the file: shipments.json");
        return;
      }
      try {
        shipments = safeParse(data);
      } catch (e) {
        reject("Invalid JSON in shipments.json");
        return;
      }

      fs.readFile("./data/customers.json", "utf8", (err, data) => {
        if (err) {
          reject("Unable to read the file: customers.json");
          return;
        }
        try {
          customers = safeParse(data);
        } catch (e) {
          reject("Invalid JSON in customers.json");
          return;
        }

        fs.readFile("./data/orders.json", "utf8", (err, data) => {
          if (err) {
            reject("Unable to read the file: orders.json");
            return;
          }
          try {
            orders = safeParse(data);
          } catch (e) {
            reject("Invalid JSON in orders.json");
            return;
          }

          resolve();
        });
      });
    });
  });
};

// module.exports.addShipment = function (shipmentData) {
//   return new Promise((resolve, reject) => {
//     shipmentData.id = shipments.length + 1;
//     shipmentData.date = new Date().toISOString().split("T")[0];
//     shipments.push(shipmentData);

//     fs.writeFile("./data/shipments.json", JSON.stringify(shipments), (err) => {
//       if (err) {
//         reject("Unable to write to file: shipments.json");
//         return;
//       }
//       resolve();
//     });
//   });
// };

// module.exports.getShipments = function () {
//   return new Promise((resolve, reject) => {
//     if (shipments.length === 0) {
//       reject("No shipments found");
//       return;
//     }
//     resolve(shipments);
//   });
// };

// module.exports.addOrder = function (orderData) {
//   return new Promise((resolve, reject) => {
//     if (!customers.find(c => c.id === orderData.customerId)) {
//       reject("Customer not found");
//       return;
//     }
//     else if (isNaN(orderData.cardCount) || parseInt(orderData.cardCount, 10) <= 0) {
//       reject("Invalid card count");
//       return;
//     }
//     else {orderData.id = orders.length + 1;
//     orderData.date = new Date().toISOString().split("T")[0];
//     orderData.customerName = customers.find(c => c.id === orderData.customerId)?.name || "Unknown Customer";
//     orderData.cardCount = parseInt(orderData.cardCount, 10);
//     orders.push(orderData);
    
//     fs.writeFile("./data/orders.json", JSON.stringify(orders), (err) => {
//       if (err) {
//         reject("Unable to write to file: orders.json");
//         return;
//       }
//       resolve();
//     });
//     }
//   });
// };

// module.exports.getOrders = function () {
//   return new Promise((resolve, reject) => {
//     if (orders.length === 0) {
//       reject("No orders found");
//       return;
//     }
//     resolve(orders);
//   });
// };

// module.exports.getCustomers = function () {
//   return new Promise((resolve, reject) => {
//     if (customers.length === 0) {
//       reject("No customers found");
//       return;
//     }
//     resolve(customers);
//   });
// };  