var db_component = fis.db.COLLECTION_LIST.pkg,
    async = require('async');

module.exports.getComponentByName = function(name, callback){
    fis.db.findOne(db_component, "root", {name : name}, callback);
};

function getMaintainerIndex(component, username){
    var maintainers = component.maintainers;
    if(maintainers){
        for(var i=0; i<maintainers.length; i++){
            if(username == maintainers[i].name){
                return i;
            }
        }
    }
    return false;
}

module.exports.isMaintainer = function(component, username){
    var maintainers = component.maintainers;
    if(maintainers && maintainers.length > 0){
        for(var i=0; i<maintainers.length; i++){
            if(username == maintainers[i].name){
                return true;
            }
        }
    }
    return false;
};

module.exports.addMaintainer = function(component, user, callback){

    if(component.maintainers){
        var index = getMaintainerIndex(component, user.name);
        if(index !== false){
            component.maintainers[index] = {
                name : user.name,
                email : user.email
            }
        }else{
            component.maintainers.push({
                name : user.name,
                email : user.email
            });
        }
    }else{
        component.maintainers = [];
        component.maintainers.push({
            name : user.name,
            email : user.email
        });
    }

    fis.db.update(db_component, user.name, {name : component.name}, component, {}, function(error){
        callback(error);
    });
};

module.exports.removeMaintainer = function(component, username, callback){
    var index = getMaintainerIndex(component, username);
    if(index !== false){
        component.maintainers.splice(index, 1);
        fis.db.update(db_component, username, {name : component.name}, component, {}, function(error){
            callback(error);
        });
    }else{
        callback("User [" + username + "] is not maintainer");
    }
};

/**
 * mongodb中key之不能含有"."
 * @param key
 */
function fixMongoDBKey(key){
    return key.replace(/\./g, "__");
}

module.exports.hasVersion = function(component, version){
    if(version == "latest" || version == "all"){
        return true;
    }
    return fis.util.in_array(version, component.versionHistory);
};

function updateVersionHistory(version, historyVersion){
    var pos = fis.util.array_search(version, historyVersion);
    if(pos === false){
        historyVersion.push(version);
    }else{
        historyVersion = historyVersion.splice(pos, 1);
        historyVersion.push(version);
    }
    return historyVersion;
}

function getPackageFile(pkg_name, version){
    return pkg_name + "-" + version + ".zip";
}

module.exports.addTotaldowns = function(name, callback){
    fis.db.update(db_component, "root", {name : name}, {$inc : {"totaldowns" : 1}}, {}, callback);
};

//需要维护一下字段 ： latest、time、attachments、versions、versionHistory
module.exports.updateComponent = function(component, config, username, callback){
    config.latest = config.version;
    config['update-time'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");

    var historyConfig = fis.util.clone(config),
        fixVersion = fixMongoDBKey(config.version);

    config.versions = component.versions;
    config.versions[fixVersion] = historyConfig;
    config.versionHistory = updateVersionHistory(config.version, component.versionHistory);

    component = fis.util.merge(component, config);
    fis.db.update(db_component, username, {name : config.name}, component, {}, callback);
};


module.exports.addComponent = function(config, username, callback){
    config.latest = config.version;
    config['create-time'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
    config['update-time'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
    config.totaldowns = 0;
    var historyConfig = fis.util.clone(config),
        fixVersion = fixMongoDBKey(config.version);

    config._id = config.name;
    config.versions = {};
    config.versions[fixVersion] = historyConfig;
    config.maintainers = [
        {
            name : username
        }
    ];
    config.versionHistory = [config.version];
    config.permission = {
        mode : 777
    };
    fis.db.insert(db_component, username, config, {}, callback);
};

module.exports.removeComponent = function(name, version, username, callback){
    exports.getComponentByName(name, function(error, component){
        if(error){
            callback(error);
        }else if(component == null){
            callback("Not found component [" + name + "]");
        }else{
            if(version == "all"){
                var files = [];
                for(var i=0; i<component.versionHistory.length; i++){
                    var file = getPackageFile(component.name, component.versionHistory[i]);
                    files.push(file);
                }
                async.each(files, fis.db.unlink, function(error){
                    if(error){
                        callback(error);
                    }else{
                        fis.db.remove(db_component, username, {name : component.name}, {}, function(error){
                            if(!error){
                                callback(null, "Unpublish component [" + name + "@" + version + "] success!");
                            }else{
                                callback(error);
                            }
                        });
                    }
                });
            }else{
                if(fis.util.in_array(version, component.versionHistory, false)){
                    if(component.versionHistory.length == 1){
                        var filename = getPackageFile(name, version);
                        fis.db.unlink(filename, function(error){
                            if(!error){
                                fis.db.remove(db_component, username, {name : name}, {}, function(error, result){
                                    if(!error){
                                        callback(null, "Unpublish component [" + name + "@" + version + "] success!");
                                    }else{
                                        callback(error);
                                    }
                                });
                            }else{
                                callback(error);
                            }
                        });
                    }else{
                        if(version == component.latest){
                            component.versionHistory.pop();
                            delete(component.versions[fixMongoDBKey(version)]);

                            var latest = fixMongoDBKey(component.versionHistory[component.versionHistory.length - 1]),
                                pkgInfo = component.versions[latest];

                            component = fis.util.merge(component, pkgInfo);
                        }else{
                            var versionHistory = component.versionHistory,
                                pos = fis.util.array_search(version, versionHistory);
                            if(pos !== false){
                                versionHistory = versionHistory.splice(pos, 1);
                            }
                            component.versionHistory = versionHistory;
                            delete component.versions[fixMongoDBKey(version)];
                        }
                        fis.db.update(db_component, username, {name : name}, component, {}, function(error, result){
                            if(!error){
                                var pkgFile = getPackageFile(name, version);
                                fis.db.unlink(pkgFile, function(error, result){
                                    callback(null, "Unpublish component [" + name + "@" + version + "] success!");
                                });
                            }else{
                                callback(error);
                            }
                        });
                    }
                }else{
                    callback("Unpublish component [" + name + "@" + version + "] not exist!");
                }
            }
        }
    });
};

module.exports.getComponentAttachment = function(name, version, callback){
    fis.db.findOne(db_component, "root", {name : name}, function(error, component){
        if(!error){
            if(component){
                if(version == "latest"){
                    version = component.version;
                }
                var fixVersion = fixMongoDBKey(version),
                    versionComponent = component.versions[fixVersion];
                if(versionComponent){
                    var filename = versionComponent._attachments.name,
                        filetype = versionComponent._attachments["content-type"];
                    callback(null, filename, filetype);
                }else{
                    callback("Component [" + name + "@" + version + "] not found!");
                }
            }else{
                callback("Component [" + name + "] not found!");
            }
        }else{
            callback(error);
        }
    });
};