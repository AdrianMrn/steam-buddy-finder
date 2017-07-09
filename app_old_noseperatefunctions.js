var request = require('request');
var rp = require('request-promise');
var async = require('async');
var user_schema = require('./models/users').user;
var vars = require('./.vars');
var geofile = require('./steam_countries.min.json');
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var key = vars.steamapikey;

var skipFriendList = true;

var scrape100 = function(steamids) {
    console.log("Starting to get info for batch.");
    gatherProfilesInfo(steamids, function() {
        console.log("Starting to get games for batch.");
        gatherProfilesGames(steamids, function() {
            console.log("Starting to get friends for batch.");
            if (!skipFriendList) {
                gatherProfilesFriends(steamids, function() {
                    console.log("Batch of 100 finished, getting another");
                    findNewProfiles();
                });
            } else {
                console.log("Batch of 100 finished, getting another");
                findNewProfiles();
            }
        });
    });
}

var gatherProfilesInfo = function(steamids, next) {
    var uri = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + key + "&steamids=" + steamids;
    request(uri, function(err, response, body) {
        if (err) console.log(err);
        if (response && response.statusCode == 200){
            var body = JSON.parse(response.body);
            players = body.response.players;

            async.eachLimit(players, 100, function(player, callback) {
                var isPublic = 0;
                if (player.communityvisibilitystate == 3 && player.profilestate) isPublic = 1;
                
                //getting geo info: https://github.com/Holek/steam-friends-countries
                var country, state, city;
                var locationString;
                var locationCoords = "";
                var arrLocationCoords = [];
                if (player.loccountrycode && geofile[player.loccountrycode]) {
                    country = geofile[player.loccountrycode].name;
                    locationString = country;
                    if (player.locstatecode && geofile[player.loccountrycode].states[player.locstatecode]) {
                        state = player.locstatecode ? geofile[player.loccountrycode].states[player.locstatecode].name : undefined;
                        locationString = state + ", " + locationString;
                        if (player.loccityid && geofile[player.loccountrycode].states[player.locstatecode].cities[player.loccityid]) {
                            city = player.loccityid ? geofile[player.loccountrycode].states[player.locstatecode].cities[player.loccityid].name : undefined;
                            locationString = city + ", " + locationString;
                            locationCoords = geofile[player.loccountrycode].states[player.locstatecode].cities[player.loccityid].coordinates;
                        } else {
                            locationCoords = geofile[player.loccountrycode].states[player.locstatecode].coordinates;
                        }
                    } else {
                        locationCoords = geofile[player.loccountrycode].coordinates;
                    }
                }

                if (locationCoords) {
                    locationCoords = locationCoords.split(',');
                    var tmp = locationCoords[1];
                    locationCoords[1] = locationCoords[0];
                    locationCoords[0] = tmp;
                } else locationCoords = null;

                user_schema.findOneAndUpdate({steamid:player.steamid}, {
                    steamid:player.steamid,
                    username: player.personaname,
                    profileurl: player.profileurl,
                    isPublic: isPublic,
                    lastlogoff: player.lastlogoff ? player.lastlogoff : 0,
                    avatar: player.avatar,
                    //private info
                    locationInfo: {
                        locationCoords: locationCoords,
                        locationString: locationString,
                        country: country,
                        raw: {
                            loccountrycode: player.loccountrycode,
                            locstatecode: player.locstatecode,
                            loccityid: player.loccityid ? player.loccityid : null
                        },
                    }
                }, {upsert:true}, function(err, response){
                    if (err) console.log(err);
                    console.log("Got a user's profile info:", player.steamid);
                    callback();
                });
            }, function(err) {
                if (err) console.log(err)
                next();
            });
        } else {
            console.log(response);
            if (response) console.log(response.statusCode ? response.statusCode : "Error");
            //process.exit();
            next();
        }
    });
}


var gatherProfilesGames = function(steamids, next) {
    var uri = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + key + "&format=json&include_played_free_games=true&steamid=";
    var steamidsarray = steamids.split(",");

    async.eachLimit(steamidsarray, 100, function(steamid, callback) {
        request(uri + steamid, function(err, response, body) {
            if (err) console.log(err);
            if (response && response.statusCode == 200){
                body = JSON.parse(body);
                games = body.response.games;
                user_schema.findOneAndUpdate({steamid:steamid}, {games:games, isScraped:true,}, function(err, response) {
                    if (err) console.log(err);
                    console.log("Got a user's games list:", steamid);
                    callback();
                });
            } else {
            console.log(response);
            if (response) console.log(response.statusCode ? response.statusCode : "Error");
            //process.exit();
            callback();
        }
        });
    }, function(err) {
        if (err) console.log(err);
        next();
    });
}

var gatherProfilesFriends = function(steamids, next) {
    var uri = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=" + key + "&relationship=friend&steamid=";
    var steamidsarray = steamids.split(",");

    async.eachLimit(steamidsarray, 5, function(steamid, callback) {
        request(uri + steamid, function(err, response, body) {
            if (err) console.log(err);
            if (response && response.statusCode == 200){
                body = JSON.parse(body);
                friends = body.friendslist.friends;

                async.eachLimit(friends, 5, function(friend, callbackFriend) {
                    user_schema.findOne({steamid:friend.steamid}, function(err, response) {
                        if (err) console.log(err);
                        if (!response) {
                            user_schema.findOneAndUpdate({steamid:friend.steamid}, {
                                isScraped:false,
                                steamid:friend.steamid,
                            }, {upsert:true}, function(err, response){
                                if (err) console.log(err);
                                console.log("Got a user's friend list:", steamid);
                                callbackFriend();
                            });
                        } else callbackFriend();
                    });
                }, function(err) {
                    if (err) console.log(err);
                    callback();
                });
            } else {
            console.log(response);
            if (response) console.log(response.statusCode ? response.statusCode : "Error");
            //process.exit();
            callback();
            }
        });
    }, function(err) {
        if (err) console.log(err);
        next();
    });
}

//gets 100 unscraped steamid64's from the database, delimited by commas & starts the scrape100() function
var findNewProfiles = function() {
    steamids = "";
    user_schema.find({isScraped:false, steamid: {$exists: true}}, {steamid:1}, function(err,users) {
        if (err) console.log(err);
        if (!users) {
            scrape100("76561197972851741"); //future: fix this because it doesn't work
        } else {
            async.each(users, function(user, callback) {
                steamids += user.steamid + ",";
                callback();
            }, function(err) {
                if (err) console.log(err);
                steamids = steamids.substring(0, steamids.length - 1);
                scrape100(steamids)
            });
        }
    }).limit(100);
}

findNewProfiles();
//scrape100("76561197972851741,76561198320752697");

//API part
var findNearbyUsers = function(appid, coordinates) {
    user_schema.find({
        isScraped: true,
        isPublic: true,
        'games.appid': appid
    }, {
        username:1,
        profileurl:1,
        avatar:1,
        'locationInfo.locationString':1
    }, function(err, response) {
        if (err) console.log(err);
        console.log(response);
    }).limit(1)
}

//findNearbyUsers(730, (100,50));