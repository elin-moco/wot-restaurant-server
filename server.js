/* global require, Buffer */
'use strict';

var Server = require('socket.io');
var io = new Server(3000);
var EventEmitter2 = require('eventemitter2').EventEmitter2;


function ThingsServer() {
}

ThingsServer.prototype = Object.create(EventEmitter2.prototype);
ThingsServer.prototype.CROWDED_THRESHOLD = 400;
ThingsServer.prototype.LOCATIONS = {
  'philz coffee sunnyvale': {
    name: 'Philz Coffee Sunnyvale',
    location: '37.3880764,-122.1181335',
    distance: '1.8 miles, 5 minutes driving',
    estimatedWaitTime: '20 minutes'
  },
  'philz coffee palo alto middlefield': {
    name: 'Philz Coffee Palo Alto Middlefield',
    location: '37.4032528,-122.1295111',
    distance: '7.7 miles, 13 minutes driving',
    estimatedWaitTime: '20 minutes'
  }
};

ThingsServer.prototype.connect = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      if (self.board) {
        resolve();
      } else {
        // connect to Arduino for the first time
        var updateData = function(index, value) {
          var location = self.LOCATIONS[Object.keys(self.LOCATIONS)[index]];
          if (location) {
            var oldCrowdedVal = location.crowded;
            location.crowded = value > self.CROWDED_THRESHOLD;
            if (oldCrowdedVal != location.crowded) {
              self.emit('data-changed');
            }
          }
        };
        var five = require('johnny-five');
        self.board = new five.Board({repl: false});
        self.board.on('ready', function() {
          var led = new five.Led(7);
          led.on();
          var crowded0 = new five.Sensor({
            pin: "A0",
            freq: 1000
          });
          var crowded1 = new five.Sensor({
            pin: "A1",
            freq: 1000
          });
          crowded0.on("data", function() {
            updateData(0, this.value);
          });
          crowded1.on("data", function() {
            updateData(1, this.value);
          });
          resolve();
        });
      }
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
};

ThingsServer.prototype.search = function(terms, callback) {
  var result = [];
  for (var text in this.LOCATIONS) {
    var match = true;
    for (var term of terms) {
      if (-1 === text.indexOf(term)) {
        match = false;
      }
    }
    if (match) {
      result.push(this.LOCATIONS[text]);
    }
  }
  if (callback) {
    callback(result);
  }
};

var things = new ThingsServer();

io.on('connection', function(socket) {
  console.log('socket connected');
  var terms = [];
  var searchByTerms = function() {
    things.search(terms, function(data) {
      socket.emit('restaurant-data', data);
    });
  };
  things.connect().then(function() {
    // update search result when data changed
    things.on('data-changed', searchByTerms);
  });

  socket.on('restaurant-service', function(searchText) {
    terms = searchText.toLocaleLowerCase().split(' ');
    searchByTerms();
  });

  socket.on('disconnect', function() {
    console.log('socket disconnected');
    things.off('data-changed', searchByTerms);
  });
});
console.log('server ready');
