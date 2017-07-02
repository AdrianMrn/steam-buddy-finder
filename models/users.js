var mongoose = require('mongoose');
Schema = mongoose.Schema;

var localConnection = mongoose.createConnection('mongodb://localhost/steam-buddy-finder');

var userSchema = new Schema({
  steamid64: Number,
  username: String,
  profileUrl: String,
  isPublic: Boolean,
  isScraped: { type: Boolean, default: false },
  locationInfo: {
    locationString: String,
    locationCoords: { latitude: String, longitude: String },
    country: String,
  },
  gamesOwned: [{
        appId: Number,
        name: String,
        logoUrl: String,
        hoursPlayed: Number,
        hoursPlayedRecently: Number,
        lastPlayed: Number,
  }],
}, {
  timestamps: true
});

var user = localConnection.model('user', userSchema);
module.exports = {
	user: user
};
