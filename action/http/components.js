var Component = require("../../lib/component.js"),
    render_helper = require("../../lib/render.js"),
    async = require('async');

module.exports = function(req, res, app){
    render_helper.setRender(app);

    async.parallel({
        updateComponents : function(callback){
            Component.getComponentByTime({}, 10, function(error, updateComponents){
                if(error){
                    callback(error);
                }else{
                    for(var i=0; i<updateComponents.length; i++){
                        updateComponents[i].updateTime = Math.ceil(((new Date()).getTime()-updateComponents[i].updateStamp) / (1000 * 60 * 60));
                        updateComponents[i].componentUrl = "/fisrepo/component_detail?name=" + updateComponents[i].name;
                    }
                    callback(error, updateComponents);
                }
            });
        },
        downloadComponents : function(callback){
            Component.getComponentByDownloads({}, 10, function(error, downloadComponents){
                if(error){
                    callback(error);
                }else{
                    for(var i=0; i<downloadComponents.length; i++){
                        downloadComponents[i].componentUrl = "/fisrepo/component_detail?name=" + downloadComponents[i].name;
                    }
                    callback(error, downloadComponents);
                }
            })
        }
    },function(error, results){
        if(error){
            res.send(500, error);
        }else{
            res.render("components", {
                data : results,
                searchUrl : "/fisrepo/component_search"
            });
        }
    });

};
