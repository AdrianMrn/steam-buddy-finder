var mongoose = require('mongoose');
var request = require('request');
var rp = require('request-promise');
var cheerio = require('cheerio');
var async = require('async');

mongoose.Promise = global.Promise;

var scrape = function(uri){
    request(uri, function(err, response, body) {
        if(err) console.log(err);
        if(response && response.statusCode == 200){

            var friendsPage = "";
            var $ = cheerio.load(body);

            /*friendsPage = $('div.profile_friend_links > div.profile_count_link.ellipsis > a').attr('href');
            if (friendsPage) {
                gatherProfiles(friendsPage);
            }*/
            
            gamesPage = $('div.profile_item_links > div.profile_count_link > a').attr('href');
            if (gamesPage) {
                gatherGames(gamesPage);
            }

            //future: add to mongodb, recursiveness, ...?

        }
    });
}

var gatherProfiles = function(uri){
    request(uri, function(err, response, body) {
        if(err) console.log(err);
        if(response && response.statusCode == 200){

            var profileUrls = [];
            var $ = cheerio.load(body);

            friendProfileUrls = $('a.friendBlockLinkOverlay');
            $(friendProfileUrls).each(function(i, link){
                var l = $(link).attr('href');
                //future: save each as a new profile in mongodb
            });
        }
    });
}

var gatherGames = function(uri){
    request(uri, function(err, response, body) {
        if(err) console.log(err);
        if(response && response.statusCode == 200){

            var gameItemsScript = [];
            var json;
            var $ = cheerio.load(body);

            //getting the script with all the game info
            gameItemsScript = $('body > div.responsive_page_frame.with_header > div.responsive_page_content > div.responsive_page_template_content > script');
            script = gameItemsScript.contents()['0'].data;

            //removing everything before the json starts
            jsonString = script.substring(script.indexOf("["));

            //removing everything after the json ends
            jsonString = jsonString.substring(0, jsonString.indexOf("}}];") + 3);

            json = JSON.parse(jsonString);
            async.each(json, function(game, callback) {
                var gameName = game.name;
                var hoursPlayed = 0;
                if (game.hours_forever) {
                    hoursPlayed = game.hours_forever.replace(/,/g, "");
                }

                console.log(gameName, hoursPlayed);
                callback();
            }, function(err) {
                if( err ) console.log('A game failed to process');

                console.log('All games have been processed successfully');
            });

            //console.log(gameName);
            //var hoursPlayed = $

            //future: save each to profile in mongodb
            //future: do the same for recently played games and edit accordingly in mongodb
        }
    });

}

scrape("https://steamcommunity.com/id/flashkonijn");