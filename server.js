const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const shortid = require('shortid');

const app = express();
const Schema = mongoose.Schema;

const port = process.env.PORT || 3000;

// connect to db
mongoose.connect( process.env.MONGO_URI, { useUnifiedTopology: true, useNewUrlParser: true });
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log("MongoDB is connecting, con state: " + db.readyState);
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use static files
app.use(express.static("public"));
// root 
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// == Create SCHEMA & MODEL ==
// create log schema
const LogSchema = new Schema({
  description: { type: String, required: true },
  duration:    { type: Number, required: true },
  date:        { type: Date, default: new Date() }
});
// create user schema
const UserSchema = new Schema({
  _id:      { type: String, default: shortid.generate },
  username: { type: String, required: true },
  count:    { type: Number, 
              default: function(){ return this.log.length }
            },
  log: [LogSchema]
}, { _id: false });
// compile user model
const User = mongoose.model('User', UserSchema);

// == API endpoints ==
// POST - new user
app.post('/api/exercise/new-user', (req, res) => {
  
  let username = req.body.username.trim();
  if (!username) {
    // empty input
    res.json({error: 'Empty username'});
  } else {
    // register new user
    User.findOne({username: username}, (err, user) => {
      
      if (err) res.send(err);
      if (!user) {
        User.create({
          username: username,
          log: []
        }, (err, created) => {
          if (err) res.send(err);
          res.json({username: created.username, _id: created.id});
        })
      } else {
          res.json({error: 'Username Already Taken'});
      }
      
    });
  }
  
});
// POST - new log
app.post('/api/exercise/add', (req, res) => {
  
  let { userId, description, duration } = req.body;
  let date = new Date(req.body.date);
  if (isNaN(date.valueOf())) { // Invalid Date 
    date = new Date();
  }
  
  User.findOne({_id: userId}, (err, user) => {
    
    if (err) res.send(err);
    if(!user){
      res.json({error: "Unknown userID"});
    }else{
      user.log.push({
        description: description,
        duration: Number(duration),
        date: date
      });
      user.count = user.log.length;
      user.save((err, updated) => {
        if (err) res.send(err);
        let log = updated.log[updated.log.length - 1];
        res.json({
          username: updated.username,
          _id: updated.id,
          count: updated.count,
          description: log.description,
          duration: log.duration,
          date: log.date.toDateString()
        });
      });
    }
    
  })
  
});
// GET
app.get('/api/exercise/users', (req, res) => {
  
  User.find().select('username _id').exec((err, data) => {
    if (err) res.send(err);
    res.json(data);
  });
  
});
app.get('/api/exercise/log', (req, res) => {
  console.log(req.query);
  
  // option
  let limitOption, dateOption;
  if (req.query.limit && !isNaN(parseInt(req.query.limit))){
    limitOption = { log: { $slice: parseInt(req.query.limit) } };
  } else {
    limitOption = {};
  }
  
  User.findOne({ _id: req.query.userId }, limitOption)
      .select('-log._id -__v')
      .exec((err, data) => {
        if (err) res.send(err);
        if (!data) {
          res.json({error: "Unknown userID"});
        } else {
          let formatedLog = data.log.map(item => {
            return {
              description: item.description,
              duration: item.duration,
              date: item.date.toDateString()
            }
          });
          res.json({
            username: data.username,
            _id: data.id,
            count: data.count,
            log: formatedLog
          });
        }
  });
  
});


// == end of API endpoints ==

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});


