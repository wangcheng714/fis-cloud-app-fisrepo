var Component = require("../../lib/component.js"),
    render_helper = require("../../lib/render.js");

module.exports = function(req, res, app){
    render_helper.setRender(app);
    var key = req.query.key;
    if(key){
        Component.search(key, function(error, components){
            if(error){
                res.send(500, "search error " + error);
            }else{
                for(var i=0; i<components.length; i++){
                    components[i].componentUrl = "/fisrepo/component_detail?name=" + components[i].name;
                }
                res.render("component_search", {
                    key : key,
                    components : components
                });
            }
        });
    }else{
        res.send(500, "input the component you want to search");
    }
};
