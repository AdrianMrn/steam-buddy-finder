var request = require('request');
var rp = require('request-promise');
var async = require('async');
var user_schema = require('./models/users').user;
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var key = "783021B49D36549D650942D12BE48EFD"; //move this to a .env file later


var scrape100 = function(steamids) {
    console.log("Starting to get info for batch.");
    gatherProfilesInfo(steamids, function() {
        console.log("Starting to get games for batch.");
        gatherProfilesGames(steamids, function() {
            console.log("Starting to get friends for batch.");
            gatherProfilesFriends(steamids, function() {
                console.log("Batch of 100 finished, getting another");
                findNewProfiles();
            });
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

            async.eachLimit(players, 5, function(player, callback) {
                var isPublic = 0;
                if (player.communityvisibilitystate == 3 && player.profilestate) isPublic = 1;

                user_schema.findOneAndUpdate({steamid:player.steamid}, {
                    steamid:player.steamid,
                    username: player.personaname,
                    profileurl: player.profileurl,
                    isPublic: isPublic,
                    lastlogoff: player.lastlogoff ? player.lastlogoff : 0,
                    avatar: player.avatar,
                    //private info
                    locationInfo: {
                        raw: {
                            loccountrycode: player.loccountrycode,
                            locstatecode: player.locstatecode,
                            loccityid: player.loccityid ? player.loccityid : null
                        } //get coordinates, ... using https://github.com/Holek/steam-friends-countries
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
        } else next()
    });
}


var gatherProfilesGames = function(steamids, next) {
    var uri = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + key + "&format=json&include_played_free_games=true&steamid=";
    var steamidsarray = steamids.split(",");

    async.eachLimit(steamidsarray, 5, function(steamid, callback) {
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
            } else callback();
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
            } else callback();
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
        async.each(users, function(user, callback) {
            steamids += user.steamid + ",";
            callback();
        }, function(err) {
            if (err) console.log(err);
            steamids = steamids.substring(0, steamids.length - 1);
            scrape100(steamids)
        });

    }).limit(100);
}

findNewProfiles();
//scrape100("76561197972851741,76561198320752697");