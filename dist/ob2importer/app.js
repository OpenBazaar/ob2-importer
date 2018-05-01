const { app, BrowserWindow, ipcMain } = require('electron');
var request = require('request');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

ipcMain.on('import-from-ob1-submission', function (event, csvfile, ip, port, authcookie) {
    console.log(csvfile, ip, port, authcookie);
});

ipcMain.on('auth-to-shopify', function (event, shopifyID) {

    var authWindow = new BrowserWindow({ width: 800, height: 600, show: false, 'node-integration': false });
	var shopifyURL = 'https://'+shopifyID+'.myshopify.com/admin/oauth/request_grant?client_id=71f6fb41dd6b8dc22b185e5f48a3ee92&redirect_uri=https://localhost&scope=read_product_listings&state=';

	console.log(shopifyURL);
	authWindow.loadURL(shopifyURL);
	authWindow.show();

	
	function handleCallback (url) {
		
		console.log(url);
		
	  var raw_code = /code=([^&]*)/.exec(url) || null;
	  var code = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
	  var error = /\?error=(.+)$/.exec(url);
	
	  if (code || error) {
	    // Close the browser if code found or error
	    authWindow.destroy();
	  }
	
	  // If there is a code, proceed to get token from github
	  if (code) {
	    
	    // POST to get token
	    var headers = {
		    'User-Agent':       'Super Agent2/0.0.1',
		    'Content-Type':     'application/x-www-form-urlencoded'
		}
		
		// Configure the request
		var options = {
		    url: 'https://'+shopifyID+'.myshopify.com/admin/oauth/access_token',
		    method: 'POST',
		    headers: headers,
		    form: {
			    'shop': shopifyID, 
			    'client_id': '71f6fb41dd6b8dc22b185e5f48a3ee92',
			    'client_secret': 'fe508f92feddaab407cc30bea6d4daf8', 
			    'code': code
			}
		}
		
		// Start the request
		request(options, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
		        // Print out the response body
		        var results = JSON.parse(body);
		        event.sender.send('shopify-results', results.access_token);
		    } else {
			    console.log(response.statusCode);
		    }
		})

	    
	    
	  } else if (error) {
	    alert('Oops! Something went wrong and we couldn\'t' +
	      'log you in using Github. Please try again.');
	  }
	}
	
	// Handle the response from GitHub - See Update from 4/12/2015
	
	authWindow.webContents.on('will-navigate', function (event, url) {
	  handleCallback(url);
	});
	
	authWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
	  handleCallback(newUrl);
	});
	
	// Reset the authWindow on close
	authWindow.on('close', function() {
	    authWindow = null;
	}, false);
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    'accept-first-mouse': true,
    'title-bar-style': 'hidden',
    show: false,
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open the DevTools.
  //mainWindow.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
  
  
});
