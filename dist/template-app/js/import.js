var http = require('http');
var https = require('https');
var csv = require('fast-csv');
var os = require('os');
var fs = require('fs');
var csvSplitStream = require('csv-split-stream');
var mkdirp = require('mkdirp');
var request = require('request');


document.addEventListener('DOMContentLoaded', function () {

  var platform = os.platform(); // So we can detect where the data directory is
  var active_line = 0;
  var header = "";

  switch(platform) {
    case 'darwin':
      var csv_directory = os.homedir() + "/Library/Application Support/OpenBazaar";
      break;
  }

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

  function processCSV() {

    rmdirSyncForce = function(path) {
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

    // Create processing directory
    var processed_dir = csv_directory + "/processed";
    rmdirSyncForce(processed_dir);
    mkdirp(processed_dir, function (err) {
        if (err) {
          console.error(err);
        } else {
          console.log('Processed folder created');
        }
    });


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

    //var stream = fs.createReadStream(csv_directory + "/listings.csv")
    var stream = fs.createReadStream(os.homedir() + "/Desktop/.openbazaar/listings.csv")
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
        document.getElementById('listings-processed').innerHTML = active_line + " listings processed";
      })
      .on("end", function(){

           // Split listings file into chunked files
           csvSplitStream.split(
             fs.createReadStream(csv_directory + "/listings.processed.csv"),
             {
               lineLimit: 50000
             },
             (index) => fs.createWriteStream(csv_directory + `/processed/processed-${index}.csv`)
           )
           .then(csvSplitResponse => {
             console.log('Splitting files succeeded', csvSplitResponse);
           }).catch(csvSplitError => {
             console.log('Splitting files failed!', csvSplitError);
           });

      })
      .pipe(fs.createWriteStream(csv_directory + "/listings.processed.csv"))
  }

  document.querySelector('#js-import-listings').addEventListener('click', function (event) {

    document.getElementById('listings-processed').innerHTML = "";

    // Move on to process the CSV
    processCSV();

    // Import into OpenBazaar 2.0
    var ob2_ip = document.querySelector('#ob2-ip-address').value || '127.0.0.1';
    var ob2_port = document.querySelector('#ob2-port').value || 4002;

    fs.readdir(csv_directory + "/processed", function(err, files) {

      var csv_files = [];
      files.forEach( function(file, index) {
        console.log('File: '+file);
        csv_files.push(file);
      });

      function importFiles(file) {

        var formData = {
          file: fs.createReadStream(csv_directory + "/processed/" + file)
        }

        request.post({
           headers: {'content-type' : 'multipart/form-data'},
           url:     'http://'+ob2_ip+':'+ob2_port+'/ob/importlistings',
           formData: formData
         }, function(error, response, body){
           if(csv_files.length > 0)
            importFiles(csv_files.pop());
         });
      }
      importFiles(csv_files.pop());

      document.getElementById('listings-imported').innerHTML = "Listings import completed";

     });

  });

});
