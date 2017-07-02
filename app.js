var mongoose = require('mongoose');
var request = require('request');
var rp = require('request-promise');
var cheerio = require('cheerio');
var async = require('async');
var user_schema = require('./models/users').user;

mongoose.Promise = global.Promise;


var scrape = function(uri){
    console.log("Now scraping", uri);
    request(uri, function(err, response, body) {
        if (err) console.log(err);
        if (response && response.statusCode == 200){
            var $ = cheerio.load(body);

            getProfileInfo($, function(userInfo) {
                gatherProfiles($, function() {
                    gatherGames($, function(userGames) {
                        user_schema.findOneAndUpdate({ 'profileUrl':uri }, {
                            'isScraped': true,
                            'profileUrl': uri,
                            'username': userInfo.username,
                            'locationInfo.locationString':userInfo.locationString,
                            'locationInfo.locationCoords.latitude':userInfo.latitude,
                            'locationInfo.locationCoords.longitude':userInfo.longitude,
                            'locationInfo.country':userInfo.country,
                            'gamesOwned': userGames,
                        }, {upsert:true}, function(err, response){
                            if (err) console.log(err);
                            console.log(uri, "added.");
                            findNewProfile();
                        });
                    });
                });
            });
        }
    });
}

var getProfileInfo = function($, next){
    var userInfo = {};
    userInfo.username = $('span.actual_persona_name').text();

    var _locationString = $('img.profile_flag')
    if (_locationString && _locationString[0]) {
        userInfo.locationString = _locationString[0].next.data.trim();

        //Google Maps API geocoding
        key="AIzaSyDNzut-ttTQa6_O1SJVKQxMw5tBgVwjBf4" //future: move this to a gitignored file
        url="https://maps.googleapis.com/maps/api/geocode/json?address=" + userInfo.locationString + "&key=" + key;

        request(url, function(err, response, body) {
            body = JSON.parse(body);

            userInfo.latitude = body.results[0].geometry.location.lat;
            userInfo.longitude = body.results[0].geometry.location.lng;
        });

        userInfo.country = userInfo.locationString.split(" ").splice(-1)[0];
    }
    next(userInfo);
} 

var gatherProfiles = function($, next){
    friendsPage = $('div.profile_friend_links > div.profile_count_link.ellipsis > a').attr('href');
    if (friendsPage) {
        request(friendsPage, function(err, response, body) {
            if (err) console.log(err);
            if (response && response.statusCode == 200){

                var profileUrls = [];
                var $ = cheerio.load(body);

                friendProfileUrls = $('a.friendBlockLinkOverlay');
                $(friendProfileUrls).each(function(i, link){
                    var l = $(link).attr('href');
                    user_schema.findOne({ 'profileUrl':l }, function(err, response) {
                        if (err) console.log(err);
                        if (!response) {
                            new user_schema({
                                'profileUrl':l,
                                'isScraped':false,
                            }).save(function(err){
                                if (err) console.log(err);
                            })
                        }
                    })
                });
                next();
            }
        });
    } else {
        next();
    } 
}

var gatherGames = function($, next){
    var userGames = [];
    gamesPage = $('div.profile_item_links > div.profile_count_link > a').attr('href');
    if (gamesPage) {
        request(gamesPage, function(err, response, body) {
            if (err) console.log(err);
            if (response && response.statusCode == 200){
                var gameItemsScript = [];
                var json;
                var $ = cheerio.load(body);

                //getting the script with all the game info
                gameItemsScript = $('body > div.responsive_page_frame.with_header > div.responsive_page_content > div.responsive_page_template_content > script');
                script = gameItemsScript.contents()['0'].data;

                //removing everything before the json starts
                jsonString = script.substring(script.indexOf("["));

                //removing everything after the json ends
                jsonString = jsonString.substring(0, jsonString.indexOf("}];") + 2);

                json = JSON.parse(jsonString);
                async.each(json, function(game, callback) {
                    var gameInfo = {};
                    gameInfo.appId = game.appid;
                    gameInfo.name = game.name;
                    gameInfo.logoUrl = "";
                    if (game.logo) {
                        gameInfo.logoUrl = game.logo;
                    }
                    gameInfo.hoursPlayed = 0;
                    if (game.hours_forever) {
                        gameInfo.hoursPlayed = game.hours_forever.replace(/,/g, "");
                    }
                    gameInfo.hoursPlayedRecently = 0;
                    if (game.hours) { // hours played in the last 2 weeks
                        gameInfo.hoursPlayedRecently = game.hours;
                    }
                    gameInfo.lastPlayed = 0;
                    if (game.last_played) { // unix timestamp of when the game was last played. 0 = never played.
                        gameInfo.lastPlayed = game.last_played;
                    }

                    userGames.push(gameInfo);
                    callback();
                }, function(err) {
                    if (err) console.log('A game failed to process.');
                    next(userGames);
                });
            }
        });
    } else {
        next(userGames);
    }
}

var findNewProfile = function() {
    //future: add $or to check for profiles scraped longer than x days ago (a week?)
    user_schema.findOne({ 'isScraped':false}, function(err, response){
        if (err) console.log(err);
        if (response) {
            scrape(response.profileUrl);
        }
    })
}

scrape("https://steamcommunity.com/id/flashkonijn");