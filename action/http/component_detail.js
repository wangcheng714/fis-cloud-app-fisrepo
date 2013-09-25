var Component = require("../../lib/component.js"),
    render_helper = require("../../lib/render.js"),
    md = require("node-markdown").Markdown;

module.exports = function(req, res, app){

    render_helper.setRender(app);

    if(req.query.name){
        Component.getComponentByName(req.query.name, function(error, component){
            if(error){
                res.send(500, error);
            }else if(component == null){
                res.send(200, "Not find the component");
            }else{
                if(component.readmeFile){
                    Component.getReadmeContent(component.name, component.version, function(error, content){
                        if(error){
                            res.send(500, error);
                        }else{
                            var readmeContent = md(content);
                            res.render("component_detail", {
                                component : component,
                                readmeContent : readmeContent
                            });
                        }
                    });
                }else{
                    res.render("component_detail", {
                        component : component
                    });
                }
            }
        });
    }else{
        res.send(500, "missing component name");
    }

};
