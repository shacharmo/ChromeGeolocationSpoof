module.exports = {
    "speedKMPH": 50,
    "pointsEverySeconds": 5,
    "minimumPoints": 3,
    "maximumPoints": 50,
    "bingApiKey": "",
    "geocodingUrl": "http://dev.virtualearth.net/REST/v1/Locations?query={location}&maxResults=1&key={key}",
    "routeUrl": "http://dev.virtualearth.net/REST/v1/Routes/driving?wayPoint.1={from}&waypoint.2={to}&routeAttributes=routePath&maxSolutions=1&distanceUnit=km&key={key}"
}