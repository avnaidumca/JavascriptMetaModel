let MultiJsParser = require("./core/multiJsParser.js");
let config = {
    baseDir: "./../../riskq/web-4.0/src/main/webapp", // your folder to parse all js files.  
    excludedFileList : ["easyResponsiveTabs.js", "splashscreen.js", "jquery.selectMe.js"] // excluded js files names. 
}

var app = MultiJsParser.newInstance(config);
app.load();