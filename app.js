var request = require('request');
var rp = require('request-promise');
var async = require('async');
var user_schema = require('./models/users').user;
var vars = require('./.vars');
var geofile = require('./steam_countries.min.json');
var mongoose = require('mongoose');
var fs = require("fs");
var runSettingsFile = './.runSettings.js';
mongoose.Promise = global.Promise;

var key = vars.steamapikey;

var runSettings;
var scrapeProfiles, scrapeGames, scrapeFriends;
var updateRunSettings = function() {
    fs.readFile(runSettingsFile, 'utf8', function (err, data) {
        if (err) throw err;
        obj = JSON.parse(data);
        scrapeProfiles = obj.scrapeProfiles;
        scrapeGames = obj.scrapeGames;
        scrapeFriends = obj.scrapeFriends;

        console.log(scrapeProfiles, scrapeGames, scrapeFriends);
    });
    setTimeout(function() {
        updateRunSettings();
    }, 1000);
}
updateRunSettings();


//needs scrapedProfile == false steamids, batches of 100
var gatherProfilesInfo = function(steamids) {
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

                    //if coordinates would cause an error, switch them around again? no idea know why this happens.
                    if (locationCoords[1] >= 90) {
                        var tmp = locationCoords[1];
                    locationCoords[1] = locationCoords[0];
                    locationCoords[0] = tmp;
                    }
                } else locationCoords = null;

                user_schema.findOneAndUpdate({steamid:player.steamid}, {
                    scrapedProfile: true,
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
                    //console.log("Got a user's profile info:", player.steamid);
                    callback();
                });
            }, function(err) {
                if (err) console.log(err)
                var amountOfUsers = steamids.split(",").length
                console.log("Got", amountOfUsers, "users' profile info.");
                if(amountOfUsers < 100) {
                    console.log("gatherProfilesInfo: Less than 100 users in last batch, pausing for 30 seconds.");
                    setTimeout(function(){findNewProfiles(1);}, 30000);
                } else {
                    findNewProfiles(1);
                }
            });
        } else {
            //console.log(response);
            console.log("gatherProfilesInfo: Issue scraping ", steamids, response ? response.statusCode : "Error");
            /*user_schema.findOneAndUpdate({steamid:steamid},{errorWhileScraping:true}, function(err,response){
            });*/
            if (err) console.log(err);
            setTimeout(function(){findNewProfiles(1);}, 1000);
        }
    });
}

//needs scrapedGames == false && scrapedProfile == true, 1 by 1
var gatherProfilesGames = function(steamid) {
    var uri = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + key + "&format=json&include_played_free_games=true&steamid=";
    request(uri + steamid, function(err, response, body) {
        if (err) console.log(err);
        if (response && response.statusCode == 200){
            body = JSON.parse(body);
            games = body.response.games;
            if (games) {
                user_schema.findOneAndUpdate({steamid:steamid}, {games:games, scrapedGames:true,}, function(err, response) {
                if (err) console.log(err);
                    console.log("Got a user's gamelist:", steamid);
                    setTimeout(function(){findNewProfiles(2);}, 200);
                });
            } else {
                user_schema.findOneAndUpdate({steamid:steamid}, {errorWhileScraping:true,}, function(err, response) {
                    if (err) console.log(err);
                    /*future: create a variable percentageErrorsLast10Queries (or whatever)
                    that keeps track of the % amount of errors within the last 10 or so queries.
                    If this percentage > 30% or so (3 out of 10 last queries are errors),
                    pause the function for 5 minutes or so? Keep track of this for every function seperately (or together? idk)
                    --> how to do this maybe: create a function where you can send the type of query and its status,
                    function saves 3 arrays (1 for each function) that save the last 10 queries' statuses. if there's more than x% errors in this array,
                    we pause the function somehow? (variable pauseScrapeGames = true + a check at the start of that function which makes it timeout for a minute
                    before continuing)*/
                    console.log("Didn't manage to get a user's gamelist:", steamid);
                    setTimeout(function(){findNewProfiles(2);}, 200);
                });
            }
        } else {
            //console.log(response);
            console.log("gatherProfilesGames: Issue scraping ", steamid, response ? response.statusCode : "Error");
            user_schema.findOneAndUpdate({steamid:steamid},{errorWhileScraping:true}, function(err,response){
                if (err) console.log(err);
                findNewProfiles(2);
            });
        }
    });
}

//needs scrapedProfile == true && scrapedFriends == false, 1 by 1
var gatherProfilesFriends = function(steamid) {
    var uri = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=" + key + "&relationship=friend&steamid=";

    request(uri + steamid, function(err, response, body) {
        if (err) console.log(err);
        if (response && response.statusCode == 200){
            body = JSON.parse(body);
            friends = body.friendslist.friends;
            if (friends) {
                async.eachLimit(friends, 5, function(friend, callbackFriend) {
                    user_schema.findOne({steamid:friend.steamid}, function(err, response) {
                        if (err) console.log(err);
                        if (!response) {
                            user_schema.findOneAndUpdate({steamid:friend.steamid}, {
                                scrapedProfile:false,
                                scrapedGames:false,
                                scrapedFriends:false,
                                steamid:friend.steamid,
                            }, {upsert:true}, function(err, response){
                                if (err) console.log(err);
                                //console.log("Got a user's friend list:", steamid);
                                callbackFriend();
                            });
                        } else callbackFriend();
                    });
                }, function(err) {
                    if (err) console.log(err);
                    console.log("Got a user's friends' friendlists:", steamid);
                    user_schema.findOneAndUpdate({steamid:steamid}, {scrapedFriends:true}, function(err, response) {
                        if (err) console.log(err);
                        findNewProfiles(3);
                    });
                });
            } else findNewProfiles(3);
        } else {
            //console.log(response);
            console.log("gatherProfilesFriends: Issue scraping ", steamid, response ? response.statusCode : "Error");
            user_schema.findOneAndUpdate({steamid:steamid},{errorWhileScraping:true}, function(err,response){
                if (err) console.log(err);
                findNewProfiles(3);
            });
        }
    });
}

//takes a variable to decide which type of unscraped profiles to return (1=gatherProfilesInfo, 2=gatherProfilesGames, 3=gatherProfilesFriends)
//future: implement errorWhileScraping in each function
var findNewProfiles = function(scrapeType) {
    switch (scrapeType) {
        case 1: //1 = gatherProfilesInfo: get 100 (scrapedProfile == false) steamid64's from the database, delimited by commas
            steamids = "";
            user_schema.find({ $or:[ {errorWhileScraping:false}, {errorWhileScraping:{$exists:false}} ], scrapedProfile:false, steamid: {$exists: true}}, {steamid:1}, function(err,users) {
                if (err) console.log(err);
                if (!users.length) {
                    console.log("findNewProfiles(gatherProfilesInfo): No unscraped users found. Retry in 10.");
                    setTimeout(function(){ findNewProfiles(1); }, 10000);
                } else {
                    async.each(users, function(user, callback) {
                        steamids += user.steamid + ",";
                        callback();
                    }, function(err) {
                        if (err) console.log(err);
                        steamids = steamids.substring(0, steamids.length - 1);
                        gatherProfilesInfo(steamids)
                    });
                }
            }).limit(100);
            break;
        case 2: //2 = gatherProfilesGames: get 1 (scrapedGames == false) steamid64
            user_schema.findOne({ $or:[ {errorWhileScraping:false}, {errorWhileScraping:{$exists:false}} ], scrapedProfile:true, isPublic:true, scrapedGames:false}, {steamid:1}, function(err,user) {
                if (err) console.log(err);
                if (!user) {
                    console.log("findNewProfiles(gatherProfilesGames): No unscraped user found. Retry in 10.");
                    setTimeout(function(){ findNewProfiles(2); }, 10000);
                } else {
                    gatherProfilesGames(user.steamid)
                }
            });
            break;
        case 3: //3 = gatherProfilesFriends: get 1 (scrapedFriends == false) steamid64, this one is needed to populate the database with unscraped profiles
            user_schema.findOne({ $or:[ {errorWhileScraping:false}, {errorWhileScraping:{$exists:false}} ], scrapedProfile:true, isPublic:true, scrapedFriends:false}, {steamid:1}, function(err,user) {
                if (err) console.log(err);
                if (!user) {
                    console.log("findNewProfiles(gatherProfilesFriends): No unscraped user found. Retry in 10.");
                    setTimeout(function(){ findNewProfiles(3); }, 10000);
                } else {
                    gatherProfilesFriends(user.steamid)
                }
            });
            break;
    }
}

//findNewProfiles(1);
//findNewProfiles(2);
//findNewProfiles(3);

var firstRun = function() {
    new user_schema({
        steamid:"76561197972851741",
        scrapedProfile:false,
        scrapedGames:false,
        scrapedFriends:false,
    }).save(function(err){
        if (err) console.log(err);
    })
}
//firstRun();

//API part
var findNearbyUsers = function(appid, coordinates) {
    user_schema.find({
        //isScraped: true,
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