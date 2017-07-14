# steam-buddy-finder
Contact adriaanmarain300@gmail.com for info please.

# TODO
- If we run into an error along the way anywhere (try > catch?), set that profile to isScraped = true and log the error somewhere?
- Get new profiles from groups
- Frontend: (Chrome) Browser Plugin

# Query Example
db.users.find({ 'locationInfo.locationCoords': { $nearSphere: { $geometry: { type: "Point", coordinates: [ 4,51 ] }, $maxDistance: 5*1600 } } })
--> Shows all users in a ~5km radius around a point between Aalst & Dendermonde, Belgium