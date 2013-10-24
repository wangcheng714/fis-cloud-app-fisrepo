var Component = require("../../lib/component.js"),
    render_helper = require("../../lib/render.js"),
    md5 = require('MD5');

module.exports = function(req, res, app){

    render_helper.setRender(app);

    if(req.query.name){
        Component.getComponentByName(req.query.name, function(error, component){
            if(error){
                res.send(500, error);
            }else if(component == null){
                res.send(200, "Not find the component");
            }else{
                component.maintainers.forEach(function(item){
                    if(item.email){
                        item.emailhash = md5(item.email);
                    }
                });
                var currentVersion = req.query.version || component.version,
                    currentVersionKey = currentVersion.replace(/\./g, '__'),
                    versions = getVersions(component);
                if(component.versions[currentVersionKey].readmeFile){
                    Component.getReadmeContent(component.name, currentVersion, function(error, content){
                        if(error){
                            res.send(500, error);
                        }else{
                            var readmeContent = render_helper.parseMarkdown(content);
                            res.render("component_detail", {
                                component : component.versions[currentVersionKey],
                                appName : app.get("appName"),
                                readmeContent : readmeContent,
                                username : app.get("userName") ? app.get("userName") : null,
                                versions : versions,
                                currentVersion : currentVersion,
                                maintainers: component.maintainers
                            });
                        }
                    });
                }else{
                    res.render("component_detail", {
                        appName : app.get("appName"),
                        redirectUrl : req.originalUrl,
                        component : component.versions[currentVersionKey],
                        username : app.get("userName") ? app.get("userName") : null,
                        versions : versions,
                        currentVersion: currentVersion,
                        maintainers: component.maintainers
                    });
                }
            }
        });
    }else{
        res.send(500, "missing component name");
    }

};

function getVersions(component){
    var result = [];
    if(component.versions){
        for(var i in component.versions){
            result.push(i.replace(/__/g, '.'));
        }
    }
    return result.sort(sortNumber);
};

function sortNumber(a, b){
    return b.replace(/\./g, '') - a.replace(/\./g, '');
};
