import express from 'express';
import axios from 'axios';
import config from './config';
import LatLon from 'geodesy/latlon-spherical';

// TODO refactor to logic and handlers
const metersPerSecondToKilometersPerHour = 3.6;

const app = express()
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

async function getLocation(address) {
    return new Promise((resolve, reject) => {
        const url = config.geocodingUrl.replace('{location}', encodeURIComponent(address)).replace('{key}', config.bingApiKey);
        axios.get(url).then((result) => {
            try {
                const coords = result.data.resourceSets[0].resources[0].point.coordinates;
                resolve({ lat: coords[0], lon: coords[1] });
            } catch (err) {
                console.error('getLocation', err);
                reject(err);
            }
        });
    })
}

function arePointsEqual(orgPoint, routePoint) {
    if (!orgPoint || !routePoint)
        return false;

    const orgPointLat = Math.floor(orgPoint.coordinates[0] * 10000);
    const orgPointLon = Math.floor(orgPoint.coordinates[1] * 10000);
    const routePointLat = Math.floor(routePoint[0] * 10000);
    const routePointLon = Math.floor(routePoint[1] * 10000);
    return (orgPointLat == routePointLat) && (orgPointLon == routePointLon);
}

function calcDistanceAndBearing(a, b) {
    if (!a || !b) {
        return 0;
    }

    const p1 = new LatLon(a[0], a[1]);
    const p2 = new LatLon(b[0], b[1]);
    const distance = p1.distanceTo(p2);
    const bearing = p1.initialBearingTo(p2)
    return { distance, bearing };
}

async function getRoute(from, to) {
    return new Promise((resolve, reject) => {
        const url = config.routeUrl.replace('{from}', encodeURIComponent(from))
            .replace('{to}', encodeURIComponent(to))
            .replace('{key}', config.bingApiKey);
        console.log(url);
        axios.get(url).then(({data}) => {
            try {
                const routePoints = data.resourceSets[0].resources[0].routeLegs[0].itineraryItems.map(x => ({
                    coordinates: x.maneuverPoint.coordinates,
                    distance: x.travelDistance,
                    duration: x.travelDuration,
                    speed: Math.ceil(x.travelDistance * 3600 / x.travelDuration)
                }));
                const pathPoints = data.resourceSets[0].resources[0].routePath.line.coordinates;
                resolve({ routePoints, pathPoints });
            } catch (err) {
                console.error('getRoute', err);
                reject(err);
            }
        });
    });
}

function calculatePoints(routePoints, pathPoints) {
    const points = [];
    let j = 0;
    let totalTime = 0;
    routePoints[0].lineIndex = 0;
    for (let i = 0; i < pathPoints.length; i++) {
        const currentPathPoint = pathPoints[i];
        const nextPathPoint = pathPoints[i + 1];
        if (arePointsEqual(routePoints[j + 1], currentPathPoint)) {
            j++;
            routePoints[j].lineIndex = i;
        }
        const speed = routePoints[j].speed;
        const { distance, bearing } = calcDistanceAndBearing(currentPathPoint, nextPathPoint);

        points.push({
            distance,
            bearing,
            speed,
            time: totalTime,
            coordinates: currentPathPoint
        });

        if (distance && speed)
        totalTime += distance / (speed / metersPerSecondToKilometersPerHour);
    }
    return points;
}

app.get('/route', async (req, res) => {
    let from;
    let to;

    if (req.query.fromLat && req.query.fromLon) {
        from = `${req.query.fromLat}, ${req.query.fromLat}`;
    } else if (req.query.from) {
        from = req.query.from;
    } else {
        return res.status(400).send('No from address or fromLat/fromLon pair');
    }

    if (req.query.toLat && req.query.toLon) {
        to = `${req.query.toLat}, ${req.query.toLat}`;
    } else if (req.query.to) {
        to = req.query.to;
    } else {
        return res.status(400).send('No to address or toLat/toLon pair');
    }

    const { routePoints, pathPoints } = await getRoute(from, to);
    const gpsPoints = calculatePoints(routePoints, pathPoints);
    res.send(gpsPoints);
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
});