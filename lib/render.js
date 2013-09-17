var path = require("path");

module.exports.setRender = function(app){
    app.engine('.jade', require('jade').__express);
    app.set('views', path.dirname(__dirname) + "/template");
    app.set('view engine', 'jade');
};
