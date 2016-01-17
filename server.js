/* 
  Module dependencies:

  - Express
  - Http
  - Body parser
  - Underscore
  - Socket.IO
  - sqlite3

*/
var express = require("express");
var app = express();
var http = require("http").createServer(app);
var bodyParser = require("body-parser");
var io = require("socket.io").listen(http);
var _ = require("underscore");
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('db.sqlite3');

/* 
  The list of participants in our chatroom.
  The format of each participant will be:
  {
    id: "sessionId",
    name: "participantName"
  }
*/
var participants = [];

/* Server config */
app.set("port", process.env.PORT || 3000);
app.set("views", __dirname + "/views");
app.set("view engine", "jade");

/* Middleware */
app.use(express.static("public", __dirname + "/public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

/* Server routing */
app.get("/", function(request, response) {
  response.render("login");
});

app.post("/", function(request, response) {
  response.render("chat", {username: request.body.username});
});

app.post("/message", function(request, response) {
  var message = request.body.message;
  if(_.isUndefined(message) || _.isEmpty(message.trim())) {
    return response.json(400, {error: "Message is invalid"});
  }

  var name = request.body.name;
  var date = new Date(); 
  var timestamp = date.toLocaleString();

  io.sockets.emit("incomingMessage", {message: message, name: name, timestamp: timestamp});
  db.run("INSERT INTO data VALUES (?, ?, ?)", name, timestamp, message);

  response.json(200, {message: "Message received"});

});

/* Socket.IO events */
io.on("connection", function(socket){

  /*
    When a new user connects to our server, we expect an event called "newUser"
    and then we'll emit an event called "newConnection" with a list of all 
    participants to all connected clients
  */
  socket.on("newUser", function(data) {
    participants.push({id: data.id, name: data.name});
    io.sockets.emit("newConnection", {participants: participants});

    db.all("SELECT * FROM data", function(err, rows) {
      rows.forEach(function (row){
        socket.emit("incomingMessage",
	      {message: row.message, name: row.name, timestamp: row.timestamp});
      });
    });
  });

  /* 
    When a client disconnects from the server, the event "disconnect" is automatically 
    captured by the server. It will then emit an event called "userDisconnected" to 
    all participants with the id of the client that disconnected
  */
  socket.on("disconnect", function() {
    participants = _.without(participants,_.findWhere(participants, {id: socket.id}));
    io.sockets.emit("userDisconnected", {id: socket.id, sender:"system"});
  });

});

http.listen(app.get("port"), function() {
  console.log("Server up and running. Go to http://localhost:" + app.get("port"));
});
