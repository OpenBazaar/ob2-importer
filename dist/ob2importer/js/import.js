var http = require('http');
var https = require('https');
var csv = require('fast-csv');
var os = require('os');
var fs = require('fs');
var csvSplitStream = require('csv-split-stream');
var mkdirp = require('mkdirp');
var request = require('request');
var path = require('path');
var ipcRenderer = require('electron').ipcRenderer;


var token_shopify = "";
var processed_dir = "processed";
var storeInfo = "";
var shippingInfo = "";
var shopifyID = "";

var platform = os.platform(); // So we can detect where the data directory is
var active_line = 0;
var header = "";

switch(platform) {
case 'darwin':
  var csv_directory = os.homedir() + "/Library/Application Support/OpenBazaar";
  break;
case 'win32':
  var csv_directory = path.join(process.env.APPDATA, "OpenBazaar");
  break;
case 'linux':
  var csv_directory = os.homedir() + "/.openbazaar";
  break;
}


document.addEventListener('DOMContentLoaded', function () {

  /*********************
    js-export-listings

    Export listings out of OpenBazaar 1.0 application into chunked files of 5
    listings to keep memory requirements low. Files are dumped into a new folder
    called processed as processed-x.csv.

  **********************/
  document.querySelector('#js-export-listings').addEventListener('click', function (event) {
    document.getElementById('error-listings-processed').innerHTML = "";
    document.getElementById('listings-processed').innerHTML = "";
    // Retrieve server details from HTML form
    var ip = document.querySelector('#ip-address').value || '127.0.0.1';
    var port = document.querySelector('#port').value || '18469';
    var ssl = document.querySelector('#ssl').checked;

    if(port > 65536 || port < 0 || isNaN(port)) {
      document.getElementById('error-listings-processed').innerHTML = "Port must be a number between 0 and 65536";
      return;
    }

    var options = {
      host: ip,
      protocol: (ssl) ? "https:" : "http:",
      rejectUnauthorized: false,
      port: port,
      path: '/api/v1/export',
      method: 'GET'
    };

    // Call export API method which will dump a listings.csv in the DATA_DIR
    if(ssl) {
      var req = https.request(options, function(res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));

        document.getElementById('listings-processed').innerHTML = "The export file (listings.csv) is now available on " + ip;

      });
    } else {
      var req = http.request(options, function(res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));

        document.getElementById('listings-processed').innerHTML = "The export file (listings.csv) is now available on " + ip;

      });
    }


    req.on('error', function(e) {
      document.getElementById('error-listings-processed').innerHTML = e;
      console.log(e);
    });
    req.on('timeout', function () {
      // Timeout happend. Server received request, but not handled it
      // (i.e. doesn't send any response or it took to long).
      // You don't know what happend.
      // It will emit 'error' message as well (with ECONNRESET code).

      console.log('timeout');
      req.abort();
    });

    req.end();


  })

  
  document.querySelector('#js-import-listings').addEventListener('click', function (event) {

    // Disable import button until finished or errored
    document.getElementById('js-import-listings').disabled = true;
    document.getElementById('js-import-listings').style.opacity = 0.5;

    document.getElementById('listings-processed').innerHTML = "";
    document.getElementById('listings-imported').innerHTML = "";
    document.getElementById('error-listings-imported').innerHTML = "";
    document.getElementById('error-listings-processed').innerHTML = "";

    var csvfile;

    try {
        csvfile = document.getElementById("csv-file").files[0].path;
    } catch(err) {
        document.getElementById('error-listings-imported').innerHTML = 'Please specify a file to be imported below.';
        enableImportButton();
        return;
    }

    console.log("File:", csvfile);

    // Move on to process the CSV
    importCSV(csvfile, "openbazaar");

  });
  
  // Wire up nav bar buttons
  var navGroupItems = document.getElementsByClassName('nav-group-item');
  Array.from(navGroupItems).forEach(function(element) {
      element.addEventListener('click', function(e) {
	      
	    // Handle active state for buttons
		Array.from(navGroupItems).forEach(function(item) {
			item.classList.remove("active");
		});
	  	this.classList.add("active");
	      
	    var target = this.getAttribute('data-target');
	    var x = document.getElementById("pane-"+target);
	    
	    // Hide all panes
	    var panes = document.getElementsByClassName('pane-importer');
		Array.from(panes).forEach(function(e) {
			e.style.display = "none";
		});
	    
	    // Show clicked pane
		if (x.style.display === "none") {
			x.style.display = "block";
		} 
      });
    });
  
  
  
});

function rmdirSyncForce(path) {
  var files, file, fileStats, i, filesLength;
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }

  files = fs.readdirSync(path);
  filesLength = files.length;

  if (filesLength) {
    for (i = 0; i < filesLength; i += 1) {
      file = files[i];

      fileStats = fs.statSync(path + file);
      if (fileStats.isFile()) {
        fs.unlinkSync(path + file);
      }
      if (fileStats.isDirectory()) {
        rmdirSyncForce(path + file);
      }
    }
  }
  fs.rmdirSync(path);
};

function createProcessDir(subdir, purge=false) {
	// Create processing directory    
	var fullpath = path.join(processed_dir, subdir);
    if (purge && fs.existsSync(fullpath)) {
      rmdirSyncForce(fullpath);
    }
    mkdirp(fullpath, function (err) {
        if (err) {
          console.error(err);
        } else {
          console.log("Folder "+fullpath+" created");
        }
    });
}

function authToShopify(event) {
	
	shopifyID = document.getElementById('input-storefront').value;
	
	document.getElementById('shopify-results').innerHTML = '';
	
	// Get localStorage token
    token_shopify = window.localStorage.getItem('token_shopify');
    
    // If token is set then just make the request
    if(token_shopify) {
	    console.log('We have a token');	    
	    getShopInfo();
	    	   	    
	} else {
		// Authenticate to Shopify
		console.log('We need to get an OAuth token');
		ipcRenderer.send('auth-to-shopify', shopifyID);
	}

}

function getShopInfo() {
	// Retrieve Shopify Shop info for location, currency, etc.
	// Ex: https://brianob1.myshopify.com/admin/shop.json	
	
	token_shopify = window.localStorage.getItem('token_shopify');	
	
	if(shopifyID == "") {
		document.getElementById('shopify-results').innerHTML += 'Please enter a Shopify storefront ID.<BR>';
		return;
	}
	console.log(token_shopify);
	
	var options = {
		url: 'https://'+shopifyID+'.myshopify.com/admin/shop.json',
		headers: {
			"X-Shopify-Access-Token": token_shopify
		}
	}
	
	request(options, function(error, response, body) {
		shopInfo = JSON.parse(body);
		console.log(shopInfo);
		getShippingInfo();
	});
	
}

function getShippingInfo() {
	// Retrieve Shopify shipping info for shipping options
	// Ex: https://brianob1.myshopify.com/admin/shipping_zones.json
	
	var options = {
		url: 'https://'+shopifyID+'.myshopify.com/admin/shipping_zones.json',
		headers: {
			"X-Shopify-Access-Token": token_shopify
		}
	}
	
	request(options, function(error, response, body) {
		console.log(body);
		if(error) {
			console.log(error);
			return;
		}
		shippingInfo = JSON.parse(body);
		shippingInfo = shippingInfo.shipping_zones;
		retrieveShopifyListings();		
	});

}

function getShippingOptions() {
	var options = new Array();
	var countries = new Array();
	console.log(shippingInfo);
	
	options['name'] = shippingInfo[0].name;
	shippingInfo[0].countries.forEach(function(country) {
		countries.push(COUNTRY_CODES[country.code]);
	})
	options['countries'] = countries.join(",");
	options['service_name'] = shippingInfo[0]['weight_based_shipping_rates'][0]['name'];
	options['price'] = shippingInfo[0]['weight_based_shipping_rates'][0]['price'];
	options['delivery'] = shippingInfo[0]['weight_based_shipping_rates'][0]['name'];
	
	return options;
}

function retrieveShopifyListings() {
	// Retrieve listings
	var options = {
		url: 'https://'+shopifyID+'.myshopify.com/admin/product_listings.json',
		headers: {
			"X-Shopify-Access-Token": token_shopify
		}
	}
	
	request(options, function(error, response, body) {
		var listings_to_import = new Array();
		var listings = JSON.parse(body);
		var listings_pretty = JSON.stringify(listings,null,2); 		
		var columns = new Array(
			'contract_type',
			'pricing_currency',
			'language',
			'title',
			'description',
			'processing_time',
			'price',
			'nsfw',
			'image_urls',
			'categories',
			'condition',
			'quantity',
			'sku_number',
			'shipping_option1_name',
			'shipping_option1_countries',
			'shipping_option1_service1_name',
			'shipping_option1_service1_estimated_delivery',
			'shipping_option1_service1_estimated_price'
		)		
		var timestamp = Math.floor(Date.now() / 1000);
		var shippingOptions = getShippingOptions();
		

		// Check if no listings
		if(listings.product_listings.length < 1) {
			document.getElementById('shopify-results').innerHTML += 'No listings were found.<BR>Make sure that your listings in Shopify are published to the OpenBazaar sales channel before exporting.<BR>';
			return;
		}

		document.getElementById('shopify-results').innerHTML += 'Listings pulled from Shopify...<BR>';
		
		
		createProcessDir('shopify'); // Create processed folder if not already
		
		document.getElementById('shopify-results').innerHTML += 'Export folder created...<BR>';
		
		var exportFilename = path.join(processed_dir, "shopify", timestamp+".csv");
		
		fs.writeFile(exportFilename, columns.join(",") + '\n', function(err) {
		    if(err) {
			    document.getElementById('shopify-results').innerHTML += err;
		        return console.log(err);
		    }
				    
		    Array.from(listings.product_listings).forEach(function(listing) {

				document.getElementById('shopify-results').innerHTML += "Exporting "+listing.title+"...<BR>";

				var images_array = new Array();
				listing.images.forEach(function(image) {
					images_array.push(image.src);
				});							

				var data = new Array(
					Array('string','PHYSICAL_GOOD'),
					Array('string', shopInfo.shop.currency),
					Array('string', 'EN'),
					Array('string', listing.title),
					Array('string', listing.body_html),
					Array('string', ''),
					Array('float', listing.variants[0].price),
					Array('bool', 'False'),
					Array('string', images_array.join(",")),
					Array('string', listing.product_type),
					Array('string', 'New'),
					Array('float', listing.variants[0].inventory_quantity),
					Array('string', listing.variants[0].sku),
					Array('string', shippingOptions['name']),
					Array('string', shippingOptions['countries']),
					Array('string', shippingOptions['service_name']),
					Array('string', shippingOptions['delivery']),
					Array('float', shippingOptions['price'])				
				);				
			
				var quoted_data = new Array();
				Array.from(data).forEach(function (item) {
					if(item[0] == "string") {
						quoted_data.push("\""+item[1]+"\"");				    				    
					} else {
						quoted_data.push(item[1]);
					}
				});				
				
				fs.appendFile(exportFilename, quoted_data.join(",") + '\n', function(err) {
				    if(err) {
				        return console.log(err);
				    }									    
				}); 
				
			});
						
			var currentFolder = window.location.pathname.replace(/[^\\\/]*$/, '');	
			var filePath = path.join(currentFolder, "../../", exportFilename);					
			
			document.getElementById('shopify-results').innerHTML += "<strong>SUCCESS!</strong> Your file has been created and stored in " + filePath;
			
			importCSV(filePath, "shopify");		    
		    
		}); 
					
		
		
	});
}




ipcRenderer.on('shopify-results', function (event, oauthToken) {

	window.localStorage.setItem('token_shopify', oauthToken);
	token = oauthToken;
	
	getShopInfo();
	  
	
});


function enableImportButton() {
    document.getElementById('js-import-listings').disabled = false;
    document.getElementById('js-import-listings').style.opacity = 1;
}


const COUNTRY_CODES = {
	"AF": "AFGHANISTAN",
	"AX": "ALAND_ISLANDS",
	"AL": "ALBANIA",
	"DZ": "ALGERIA",
	"AS": "AMERICAN_SAMOA",
	"AD": "ANDORRA",
	"AO": "ANGOLA",
	"AI": "ANGUILLA",
	"AG": "ANTIGUA",
	"AR": "ARGENTINA",
	"AM": "ARMENIA",
	"AW": "ARUBA",
	"AU": "AUSTRALIA",
	"AT": "AUSTRIA",
	"AZ": "AZERBAIJAN",
	"BS": "BAHAMAS",
	"BH": "BAHRAIN",
	"BD": "BANGLADESH",
	"BB": "BARBADOS",
	"BY": "BELARUS",
	"BE": "BELGIUM",
	"BZ": "BELIZE",
	"BJ": "BENIN",
	"BM": "BERMUDA",
	"BT": "BHUTAN",
	"BO": "BOLIVIA",
	"BA": "BOSNIA",
	"BW": "BOTSWANA",
	"BV": "BOUVET_ISLAND",
	"BR": "BRAZIL",
	"IO": "BRITISH_INDIAN_OCEAN_TERRITORY",
	"BN": "BRUNEI_DARUSSALAM",
	"BG": "BULGARIA",
	"BF": "BURKINA_FASO",
	"BI": "BURUNDI",
	"CV": "CABO_VERDE",
	"KH": "CAMBODIA",
	"CM": "CAMEROON",
	"CA": "CANADA",
	"KY": "CAYMAN_ISLANDS",
	"CF": "CENTRAL_AFRICAN_REPUBLIC",
	"TD": "CHAD",
	"CL": "CHILE",
	"CN": "CHINA",
	"CX": "CHRISTMAS_ISLAND",
	"CC": "COCOS_ISLANDS",
	"CO": "COLOMBIA",
	"KM": "COMOROS",
	"CD": "CONGO_REPUBLIC",
	"CG": "CONGO",
	"CK": "COOK_ISLANDS",
	"CR": "COSTA_RICA",
	"CI": "COTE_DIVOIRE",
	"HR": "CROATIA",
	"CU": "CUBA",
	"CW": "CURACAO",
	"CY": "CYPRUS",
	"CZ": "CZECH_REPUBLIC",
	"DK": "DENMARK",
	"DJ": "DJIBOUTI",
	"DM": "DOMINICA",
	"DO": "DOMINICAN_REPUBLIC",
	"EC": "ECUADOR",
	"EG": "EGYPT",
	"SV": "EL_SALVADOR",
	"GQ": "EQUATORIAL_GUINEA",
	"ER": "ERITREA",
	"EE": "ESTONIA",
	"ET": "ETHIOPIA",
	"FK": "FALKLAND_ISLANDS",
	"FO": "FAROE_ISLANDS",
	"FJ": "FIJI",
	"FI": "FINLAND",
	"FR": "FRANCE",
	"GF": "FRENCH_GUIANA",
	"PF": "FRENCH_POLYNESIA",
	"TF": "FRENCH_SOUTHERN_TERRITORIES",
	"GA": "GABON",
	"GM": "GAMBIA",
	"GE": "GEORGIA",
	"DE": "GERMANY",
	"GH": "GHANA",
	"GI": "GIBRALTAR",
	"GR": "GREECE",
	"GL": "GREENLAND",
	"GD": "GRENADA",
	"GP": "GUADELOUPE",
	"GU": "GUAM",
	"GT": "GUATEMALA",
	"GG": "GUERNSEY",
	"GN": "GUINEA",
	"GW": "GUINEA_BISSAU",
	"GY": "GUYANA",
	"HT": "HAITI",
	"VA": "HOLY_SEE",
	"HN": "HONDURAS",
	"HK": "HONG_KONG",
	"HU": "HUNGARY",
	"IS": "ICELAND",
	"IN": "INDIA",
	"ID": "INDONESIA",
	"IR": "IRAN",
	"IQ": "IRAQ",
	"IE": "IRELAND",
	"IM": "ISLE_OF_MAN",
	"IL": "ISRAEL",
	"IT": "ITALY",
	"JM": "JAMAICA",
	"JP": "JAPAN",
	"JE": "JERSEY",
	"JO": "JORDAN",
	"KZ": "KAZAKHSTAN",
	"KE": "KENYA",
	"KI": "KIRIBATI",
	"KP": "NORTH_KOREA",
	"KR": "SOUTH_KOREA",
	"KW": "KUWAIT",
	"KG": "KYRGYZSTAN",
	"LA": "LAO",
	"LV": "LATVIA",
	"LB": "LEBANON",
	"LS": "LESOTHO",
	"LR": "LIBERIA",
	"LY": "LIBYA",
	"LI": "LIECHTENSTEIN",
	"LT": "LITHUANIA",
	"LU": "LUXEMBOURG",
	"MO": "MACAO",
	"MK": "MACEDONIA",
	"MG": "MADAGASCAR",
	"MW": "MALAWI",
	"MY": "MALAYSIA",
	"MV": "MALDIVES",
	"ML": "MALI",
	"MT": "MALTA",
	"MH": "MARSHALL_ISLANDS",
	"MQ": "MARTINIQUE",
	"MR": "MAURITANIA",
	"MU": "MAURITIUS",
	"YT": "MAYOTTE",
	"MX": "MEXICO",
	"FM": "MICRONESIA",
	"MD": "MOLDOVA",
	"MC": "MONACO",
	"MN": "MONGOLIA",
	"ME": "MONTENEGRO",
	"MS": "MONTSERRAT",
	"MA": "MOROCCO",
	"MZ": "MOZAMBIQUE",
	"MM": "MYANMAR",
	"NA": "NAMIBIA",
	"NR": "NAURU",
	"NP": "NEPAL",
	"NL": "NETHERLANDS",
	"NC": "NEW_CALEDONIA",
	"NZ": "NEW_ZEALAND",
	"NI": "NICARAGUA",
	"NE": "NIGER",
	"NG": "NIGERIA",
	"NU": "NIUE",
	"NF": "NORFOLK_ISLAND",
	"MP": "NORTHERN_MARIANA_ISLANDS",
	"NO": "NORWAY",
	"OM": "OMAN",
	"PK": "PAKISTAN",
	"PW": "PALAU",
	"PA": "PANAMA",
	"PG": "PAPUA_NEW_GUINEA",
	"PY": "PARAGUAY",
	"PE": "PERU",
	"PH": "PHILIPPINES",
	"PN": "PITCAIRN",
	"PL": "POLAND",
	"PT": "PORTUGAL",
	"PR": "PUERTO_RICO",
	"QA": "QATAR",
	"RE": "REUNION",
	"RO": "ROMANIA",
	"RU": "RUSSIA",
	"RW": "RWANDA",
	"BL": "SAINT_BARTHELEMY",
	"SH": "SAINT_HELENA",
	"KN": "SAINT_KITTS",
	"LC": "SAINT_LUCIA",
	"MF": "SAINT_MARTIN",
	"PM": "SAINT_PIERRE",
	"VC": "SAINT_VINCENT",
	"WS": "SAMOA",
	"SM": "SAN_MARINO",
	"ST": "SAO_TOME",
	"SA": "SAUDI_ARABIA",
	"SN": "SENEGAL",
	"RS": "SERBIA",
	"SC": "SEYCHELLES",
	"SL": "SIERRA_LEONE",
	"SG": "SINGAPORE",
	"SX": "SINT_MAARTEN",
	"SK": "SLOVAKIA",
	"SI": "SLOVENIA",
	"SB": "SOLOMON_ISLANDS",
	"SO": "SOMALIA",
	"ZA": "SOUTH_AFRICA",
	"SD": "SOUTH_SUDAN",
	"ES": "SPAIN",
	"LK": "SRI_LANKA",
	"SD": "SUDAN",
	"SR": "SURINAME",
	"SJ": "SVALBARD",
	"SZ": "SWAZILAND",
	"SE": "SWEDEN",
	"CH": "SWITZERLAND",
	"SY": "SYRIAN_ARAB_REPUBLIC",
	"TW": "TAIWAN",
	"TJ": "TAJIKISTAN",
	"TZ": "TANZANIA",
	"TH": "THAILAND",
	"TL": "TIMOR_LESTE",
	"TG": "TOGO",
	"TK": "TOKELAU",
	"TO": "TONGA",
	"TT": "TRINIDAD",
	"TN": "TUNISIA",
	"TR": "TURKEY",
	"TM": "TURKMENISTAN",
	"TC": "TURKS_AND_CAICOS_ISLANDS",
	"TV": "TUVALU",
	"UG": "UGANDA",
	"UA": "UKRAINE",
	"AE": "UNITED_ARAB_EMIRATES",
	"UK": "UNITED_KINGDOM",
	"US": "UNITED_STATES",
	"UY": "URUGUAY",
	"UZ": "UZBEKISTAN",
	"VU": "VANUATU",
	"VE": "VENEZUELA",
	"VN": "VIETNAM",
	"VG": "VIRGIN_ISLANDS_BRITISH",
	"VI": "VIRGIN_ISLANDS_US",
	"WF": "WALLIS_AND_FUTUNA",
	"EH": "WESTERN_SAHARA",
	"YE": "YEMEN",
	"ZM": "ZAMBIA",
	"ZW": "ZIMBABWE"
}

function importCSV(csvfile, source) {
	
	switch(source) {
		case "openbazaar":
		    ip = document.querySelector('#ob2-ip-address').value || '127.0.0.1';
		    port = document.querySelector('#ob2-port').value || 4002;
		    authcookie = document.querySelector('#ob2-authcookie').value || '';
		    ssl = document.querySelector('#ob2-ssl').checked;
		    break;
		case "shopify":
			console.log('Shopify');
		    ip = document.querySelector('#shopify-ip-address').value || '127.0.0.1';
		    port = document.querySelector('#shopify-port').value || 4002;
		    authcookie = document.querySelector('#shopify-authcookie').value || '';
		    ssl = document.querySelector('#shopify-ssl').checked;
		    break;
	}
	
    
    processCSV(csvfile, ip, port, authcookie, ssl);
}

function processCSV(csvfile, ip, port, authcookie, ssl) {

	var protocol = (ssl) ? 'https://' : 'http://';

    // Check file type
    var re = /(\.csv)$/i;
    if(!re.exec(csvfile))
    {
      document.getElementById('error-listings-imported').innerHTML = 'Please only select CSV files.';
      enableImportButton();
      return;
    }


    function normalize_condition(condition) {
      switch(condition) {
        case "New":
          return "NEW";
        case "Used - excellent":
          return "USED_EXCELLENT";
        case "Used - good":
          return "USED_GOOD";
        case "Used - poor":
          return "USED_POOR";
        case "Refurbished":
          return "REFURBISHED";
        default:
          return condition;
      }
    }

    createProcessDir("openbazaar", true);

    var stream = fs.createReadStream(csvfile)
      .pipe(csv.parse({headers: true}))
      .pipe(csv.format({headers: true}))
      .transform(function(row) {
        return {
          contract_type: row["contract_type"],
          pricing_currency: row["pricing_currency"],
          language: row["language"],
          title: row["title"].substr(0,140),
          description: row["description"].replace(/(\r\n|\n|\r)/gm,""),
          processing_time: row["processing_time"],
          price: row["price"],
          nsfw: row["nsfw"],
          image_urls: row["image_urls"],
          categories: row["categories"].substr(0,40),
          condition: normalize_condition(row["condition"]),
          quantity: row["quantity"],
          sku_number: row["sku_number"],
          shipping_option1_name: row["shipping_option1_name"],
          shipping_option1_countries: row["shipping_option1_countries"],
          shipping_option1_service1_name: row["shipping_option1_service1_name"],
          shipping_option1_service1_estimated_delivery: row["shipping_option1_service1_estimated_delivery"],
          shipping_option1_service1_estimated_price: row["shipping_option1_service1_estimated_price"],
          shipping_option2_name: row["shipping_option2_name"],
          shipping_option2_countries: row["shipping_option2_countries"],
          shipping_option2_service1_name: row["shipping_option2_service1_name"],
          shipping_option2_service1_estimated_delivery: row["shipping_option2_service1_estimated_delivery"],
          shipping_option2_service1_estimated_price: row["shipping_option2_service1_estimated_price"]
        }
      })
      .on("data", function(data){
        active_line++;
        document.getElementById('listings-imported').innerHTML = active_line + " listings processed";
      })
      .on("end", function() {
        
        fs.readdir("processed/openbazaar", function(err, files) {

          var csv_files = [];
          files.forEach( function(file, index) {
            console.log('File: '+file);
            csv_files.push(file);
          });

          function importFiles(file) {

            document.getElementById('listings-imported').innerHTML = "Importing listings...";

            var formData = {
              file: fs.createReadStream("processed/openbazaar/" + file)
            };

            
            var headers = {};
            if(authcookie != "") {
	            headers = {
		            'content-type' : 'multipart/form-data',
		            'Cookie': 'OpenBazaar_Auth_Cookie='+authcookie
	            }
            } else {
	            headers = {
	               'content-type' : 'multipart/form-data'
	           };
            }                      

            request.post({
               headers: headers,
               url: protocol + ip + ':' + port + '/ob/importlistings',
               formData: formData
             }, function(error, response, body){
               // Handle errors
               if(error) {
                 console.log(error);
                 document.getElementById('listings-imported').innerHTML = "";
                 document.getElementById('error-listings-imported').innerHTML = error;
               } else {
                 if(csv_files.length > 0) {
                   importFiles(csv_files.pop());
                 } else {
	                 console.log(response, body);
                   document.getElementById('listings-imported').innerHTML = "Listings import completed";
                   enableImportButton();
                 }
               }

             });
          }
          importFiles(csv_files.pop());

         });
      })
      .pipe(fs.createWriteStream("processed/openbazaar/listings.processed.csv"))

  }
