# steam-buddy-finder
Contact adriaanmarain300@gmail.com for info please.

# TODO
- If we run into an error along the way anywhere (try > catch?), set that profile to isScraped = true and log the error somewhere?
- Get new profiles from groups
- Frontend: (Chrome) Browser Plugin

# Query Example
db.users.find({ 'games.appid':730, 'locationInfo.locationCoords': { $nearSphere: { $geometry: { type: "Point", coordinates: [ 4.4025,51.2194 ] }, $maxDistance: 5*1600 } } })
--> Shows all users that own CS:GO (appid 730) in a ~5km radius around Antwerp, Belgium (and Antwerp province, it seems).