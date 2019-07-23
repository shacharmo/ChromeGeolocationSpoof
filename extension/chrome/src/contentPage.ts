import axios from 'axios';

function overrideGeolocation(extension) {
    if (!navigator.geolocation)
        return;

    console.log('overriding default geolocation');
    const orgWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    const orgGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    const orgClearWatch = navigator.geolocation.clearWatch;

    // TODO support more than one callback
    let callbackCounter = 0;
    const callbacks = {};
    let spoofedPosition: Position = undefined;

    let lastRegisterWatchSuccess: PositionCallback;
    let route: any;
    let routePlayRate = 1;
    let routeCurrentTime = 0;
    let routeLastPointIndex = 0;
    let routePlayInterval = 250;
    let routeTimer: any;

    function interpolatePoint(origin, next, time) {
        const segmentTime = next.time - origin.time;
        const timeDiff = time - origin.time;
        const percentage = timeDiff / segmentTime;
        const distance2 = origin.speed * 3600 / 1000 * timeDiff;
        const distance = origin.distance * percentage;
        const bearing = origin.bearing;
        const radius = 6371e3;

        // TODO test why distance and distance2 differ so much
        // console.log(`time=${time}, timeDiff=${timeDiff}, distance=${distance} vs ${distance2}, bearing=${bearing}, origin=${JSON.stringify(origin)}`);

        // TODO add credit
        // sinφ2 = sinφ1⋅cosδ + cosφ1⋅sinδ⋅cosθ
        // tanΔλ = sinθ⋅sinδ⋅cosφ1 / cosδ−sinφ1⋅sinφ2
        // see mathforum.org/library/drmath/view/52049.html for derivation
        const δ = distance / radius; // angular distance in radians
        const θ = bearing * Math.PI / 180;

        const φ1 = origin.coordinates[0] * Math.PI / 180;
        const λ1 = origin.coordinates[1] *  Math.PI / 180;

        const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
        const φ2 = Math.asin(sinφ2);
        const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
        const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
        const λ2 = λ1 + Math.atan2(y, x);

        const lat = φ2 * 180 / Math.PI;
        const lon = λ2 * 180 / Math.PI;

        const point = {
          interpolated: true,
          distance: origin.distance - distance,
          bearing: origin.bearing,
          speed: origin.speed,
          time,
          coordinates: [lat, lon]
        };
        return point;
    }

    function playRoute() {
        if (routeTimer) {
            pauseRoute();
        }
        // TODO test interpolate point before timer
        routeTimer = setInterval(() => {
            if (routeLastPointIndex + 1 >= route.length) {
                pauseRoute();
                return;
            }

            routeCurrentTime += (routePlayInterval / 1000) * routePlayRate;

            let routePoint = undefined;
            let routeNextPointIndex = routeLastPointIndex;
            while (route[routeNextPointIndex] && route[routeNextPointIndex].time <= routeCurrentTime) {
                routeNextPointIndex++;
            }
            if (routeNextPointIndex > routeLastPointIndex) {
                routeLastPointIndex = routeNextPointIndex;
                routePoint = route[routeLastPointIndex - 1];
                // console.log(`org route point: index=${routeLastPointIndex - 1}, time=${routeCurrentTime}, point=${JSON.stringify(routePoint)}`)
            } else if (routeLastPointIndex == route.length) {
                routePoint = route[route.length - 1];
                pauseRoute();
                // console.log(`last route point: index=${route.length - 1}, time=${routeCurrentTime}, point=${JSON.stringify(routePoint)}`)
            } else {
                routePoint = interpolatePoint(route[routeLastPointIndex - 1], route[routeLastPointIndex], routeCurrentTime);
                // console.log(`inter route point: index=${routeLastPointIndex - 1}, time=${routeCurrentTime}, point=${JSON.stringify(routePoint)}`)
            }

            if (lastRegisterWatchSuccess) {
                lastRegisterWatchSuccess({
                    coords: {
                        accuracy: 1, // TODO form configuration
                        altitude: undefined,
                        altitudeAccuracy: undefined,
                        heading: routePoint.bearing,
                        latitude: routePoint.coordinates[0],
                        longitude: routePoint.coordinates[1],
                        speed: routePoint.speed
                    },
                    timestamp: undefined // TODO set timestamp?
                });
            }

            if (routeLastPointIndex + 1 >= route.length) {
                pauseRoute();
            }
        }, routePlayInterval);
    }

    function pauseRoute() {
        if (routeTimer) {
            clearInterval(routeTimer);
        }
    }

    function resetRoute() {
        routeCurrentTime = 0;
        routeLastPointIndex = 0;
        if (route && lastRegisterWatchSuccess) {
            lastRegisterWatchSuccess({
                coords: {
                    accuracy: 1,
                    altitude: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    latitude: route[0].coordinates[0],
                    longitude: route[0].coordinates[1],
                    speed: undefined
                },
                timestamp: undefined
            });
        }
    }

    window.addEventListener('message', (event: any) => {
        if (event.source != window || !event.data.type)
            return;
        switch (event.data.type) {
            case 'getLocation':
                const payload = {
                    type: 'getLocationResult',
                    id: event.data.id,
                    position: undefined
                };
                if (spoofedPosition) {
                    payload.position = spoofedPosition;
                    window.postMessage(payload, '*');
                } else {
                    orgGetCurrentPosition((position) => {
                        payload.position = {
                            coords: {
                                accuracy: position.coords.accuracy,
                                altitude: position.coords.altitude,
                                altitudeAccuracy: position.coords.altitudeAccuracy,
                                heading: position.coords.heading,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                speed: position.coords.speed
                            },
                            timestamp: position.timestamp
                        };
                        window.postMessage(payload, '*');
                    });
                }
                break;
            case 'setLocation':
                if (!lastRegisterWatchSuccess)
                    return;
                spoofedPosition = event.data.position;
                lastRegisterWatchSuccess(event.data.position);
                break;
            case 'setRoute':
                route = event.data.route;
                pauseRoute();
                resetRoute();
                break;
            case 'playRoute':
                routePlayRate = event.data.playbackRate;
                if (route)
                    playRoute();
                break;
            case 'pauseRoute':
                routePlayRate = event.data.playbackRate;
                if (route)
                    pauseRoute();
                break;
            case 'resetRoute':
                routePlayRate = event.data.playbackRate;
                if (route)
                    resetRoute();
                break;
            default:
                break;
        }
    });

    navigator.geolocation.getCurrentPosition = (successCallback: PositionCallback,
                                                errorCallback?: PositionErrorCallback, options?: PositionOptions) => {
        if (spoofedPosition) {
            successCallback(spoofedPosition);
            return;
        }

        return orgGetCurrentPosition((position: Position) => {
            var modifiedPosition: Position = {
                coords: {
                    accuracy: 150,
                    altitude: 0,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    speed: undefined
                },
                timestamp: undefined
            }
            successCallback(modifiedPosition);
        }, (error: PositionError) => {
            if (errorCallback)
                errorCallback(error);
        }, options);
    };

    navigator.geolocation.watchPosition = (successCallback: PositionCallback,
                                           errorCallback?: PositionErrorCallback, options?: PositionOptions) => {
        lastRegisterWatchSuccess = successCallback;
        return orgWatchPosition((position: Position) => {
            if (spoofedPosition) {
                successCallback(spoofedPosition);
            } else {
                var modifiedPosition: Position = {
                    coords: {
                        accuracy: 150,
                        altitude: 0,
                        altitudeAccuracy: undefined,
                        heading: undefined,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        speed: undefined
                    },
                    timestamp: undefined
                }
                successCallback(modifiedPosition);
            }
        }, (error: PositionError) => {
            if (errorCallback)
                errorCallback(error);
        }, options);
    };

    // Clean script injection
    let script = document.getElementById('geolocation-override');
    if (script)
        script.remove();
}

// Script injection
var inject = '(function(){ ' + overrideGeolocation + ' overrideGeolocation("' + chrome.runtime.id + '");})()';
var script = document.createElement('script');
script.setAttribute('id', 'geolocation-override');
script.appendChild(document.createTextNode(inject));
document.documentElement.appendChild(script);

chrome.runtime.onMessage.addListener((request, sender, respond) => {
    const handler = new Promise((resolve, reject) => {
        if (!request) {
            return reject('Empty request');
        }
        switch (request.type) {
            case 'getLocation':
                // TODO fix somehow? not working properly on desktop, mobile not tested. maybe can be dumbed down to normal call to getCurrentPosition
                const id = 43; // TODO generate
                const listener = (event: any) => {
                    if (event.source != window || !event.data.type ||
                        event.data.type != 'getLocationResult' || event.data.id != id)
                        return;
                    window.removeEventListener('message', listener);
                    resolve(event.data.position);
                };
                window.addEventListener('message', listener);
                window.postMessage({
                    type: 'getLocation',
                    id: id
                }, '*');
                break;
            case 'setLocation':
                window.postMessage({
                    type: 'setLocation', position: {
                        coords: {
                            accuracy: request.accuracy || 150,
                            altitude: request.altitude || 0,
                            altitudeAccuracy: request.altitudeAccuracy,
                            heading: request.heading,
                            latitude: request.lat || request.latitude,
                            longitude: request.lon || request.longitude,
                            speed: request.speed
                        },
                        timestamp: request.timestamp
                    }
                }, '*');
                return resolve();
            case 'getRoute':
                const routeServiceUrl = 'http://localhost:3000/route?from={from}&to={to}'; // TODO get url from configuration (options)/storage
                const url = routeServiceUrl.replace('{from}', encodeURIComponent(request.from)).replace('{to}', encodeURIComponent(request.to));
                console.log(url);
                // TODO move service logic to extension (no need for external service, but requires more configuration/options)
                axios.get(url).then(({data}) => {
                    window.postMessage({
                        type: 'setRoute',
                        route: data
                    }, '*');
                    resolve('Route ready to play')
                });
                break;
            case 'playRoute':
            case 'pauseRoute':
            case 'resetRoute':
                window.postMessage({
                    type: request.type,
                    playbackRate: request.speed
                }, '*');
                break;
            default:
                return reject(`'${request.type}' is not a supported request type`);
        }
    });

    handler.then(message => respond(message)).catch(error => respond(error));
    return true;
});