var mongoose = require('mongoose');
Schema = mongoose.Schema;

var localConnection = mongoose.createConnection('mongodb://localhost/steam-buddy-finder');

var scrapeSchema = new Schema({
  steamid64: {type: Number, index: { unique: true }},
  username: String,
  profileUrl: String,
  isPublic: Boolean,
  gamesScraped: { type: Boolean, default: false },
  location: String,
  locationCoords: String,
  gamesOwned: [{
        appid: Number,
        hoursPlayed: Number,
        playedInLastTwoWeeks: { type: Boolean, default: false },
  }],
}, {
  timestamps: true
});

var scraper = localConnection.model('scraper', scrapeSchema);
module.exports = {
	scraper: scraper
};
