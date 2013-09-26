var Component = require("../../lib/component.js"),
    render_helper = require("../../lib/render.js");

module.exports = function(req, res, app){
    render_helper.setRender(app);
    res.render("components");
};
