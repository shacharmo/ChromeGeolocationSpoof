function overrideGeolocation(extension) {
  if (!navigator.geolocation)
    return;

  console.log('overriding default geolocation');
  const orgWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);
  const orgGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const orgClearWatch = navigator.geolocation.clearWatch;

  let callbackCounter = 0;
  const callbacks = {};
  let spoofedPosition: Position = undefined;

  let lastRegisterWatchSuccess: PositionCallback;

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
      default:
        return reject(`'${request.type}' is not a supported request type`);
    }
  });

  handler.then(message => respond(message)).catch(error => respond(error));
  return true;
});