import express from 'express';
import axios from 'axios';
import config from './config';
import LatLon from 'geodesy/latlon-spherical';

// TODO create proper scripts in npm (currently run with node -r esm index.js)
// TODO refactor to logic and handlers

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

async function getRoute(from, to) {
    return new Promise((resolve, reject) => {
        const url = config.routeUrl.replace('{from}', encodeURIComponent(from))
            .replace('{to}', encodeURIComponent(to))
            .replace('{key}', config.bingApiKey);
        console.log(url);
        axios.get(url).then((result) => {
            try {
                //const points = result.data.resourceSets[0].resources[0].routeLegs[0].itineraryItems.map(x => x.maneuverPoint.coordinates);
                const points = result.data.resourceSets[0].resources[0].routePath.line.coordinates;
                resolve(points);
            } catch (err) {
                console.error('getRoute', err);
                reject(err);
            }
        });
    });
}

function calculatePoints(route) {
    const points = [];
    const speed = config.speedKMPH * 1000 / 3600; // speed in m/s
    let totalTime = 0;
    for (let i = 0; i < route.length - 1; i++) {
        // TODO improve by caching previous point
        points.push([totalTime, route[i][0], route[i][1]]);

        const p1 = new LatLon(route[i][0], route[i][1]);
        const p2 = new LatLon(route[i+1][0], route[i+1][1]);
        const distnace = p1.distanceTo(p2);
        // TODO interpolate between points
        totalTime += distnace / speed;
    }
    points.push([totalTime, route[route.length - 1][0], route[route.length - 1][1]]);
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

    const route = await getRoute(from, to);
    const gpsPoints = calculatePoints(route);
    res.send(gpsPoints);
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
});