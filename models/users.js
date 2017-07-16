var mongoose = require('mongoose');
Schema = mongoose.Schema;

var localConnection = mongoose.createConnection('mongodb://localhost/sbf2');

var userSchema = new Schema({
  errorWhileScraping: { type: Boolean, default: false },
  scrapedProfile: { type: Boolean, default: false },
  scrapedGames: { type: Boolean, default: false },
  scrapedFriends: { type: Boolean, default: false },
  steamid: { type: String, unique: true, index: true },
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
    locationCoords: { type: [Number], index: '2dsphere' },
    locationString: String,
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
