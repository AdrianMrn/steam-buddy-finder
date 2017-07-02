var mongoose = require('mongoose');
Schema = mongoose.Schema;

var localConnection = mongoose.createConnection('mongodb://localhost/steam-buddy-finder3');

var userSchema = new Schema({
  isScraped: { type: Boolean, default: false },
  steamid: String,
  username: String,
  profileurl: String,
  isPublic: Boolean,
  lastlogoff: Number,
  avatar: String,
  locationInfo: {
    raw: {
      loccountrycode: String,
      locstatecode: String,
      loccityid: Number
    },
    locationCoords: { latitude: String, longitude: String },
    country: String,
  },
  games: [{
        appid: Number,
        playtime_forever: Number,
        playtime_2weeks: Number,
  }],
}, {
  timestamps: true
});

var user = localConnection.model('user', userSchema);
module.exports = {
	user: user
};
