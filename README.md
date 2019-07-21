# Chrome Geolocation Spoof Extension
Chrome extension to spoof geolocation and simulate a route - useful for GPS applications development

## Extension
The extension is under _extension_ directory.  
See project's [README.md](extension/README.md) for details.

## Service
Currently getting route points is via a service under _routeToPositionsService_ directory.  
The service uses Bing Maps API.  
Copy _config.example.js_ to _config.js_ and add your Bing Maps API key.  
Install dependencies via `npm install`.  
Run the service using `node -r esm index.js`

The service logic will move into the extension in the future.  
Also, currently the URL is hardcoded in extension (look for localhost:3000).  

## Demo
A demo page which watch the current position can be found under _demo_ directory.  
Install the extension, open the demo page, click on the extension popup and have fun.

## Notes
The extension is in early development stage and is not stable.  
Two-way binding is not properly set-up which requires clicking on the popup's UI to see updates.  
There is no storage yet so all setting are hardcoded and the values reset once the popup closes.    
Also, get position doesn't always work (but is a redundant feature anyway).  
