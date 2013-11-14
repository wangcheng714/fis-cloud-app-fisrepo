var db_component = fis.db.COLLECTION_LIST.pkg,
    db_pkgKeyword = fis.db.COLLECTION_LIST.pkgKeyword,
    async = require('async'),
    moment = require('moment'),
    ROOT_USER = "root",
    Q = require('q');

module.exports.getComponentByName = function(name, callback){
    fis.db.findOne(db_component, ROOT_USER, {name : name}, callback);
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
    delete component._id;
    fis.db.update(db_component, user.name, {name : component.name}, component, {}, function(error){
        callback(error);
    });
};

module.exports.removeMaintainer = function(component, username, callback){
    var index = getMaintainerIndex(component, username);
    if(index !== false){
        component.maintainers.splice(index, 1);
        delete component._id;
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

function addVersionHistory(version, historyVersion){
    var pos = fis.util.array_search(version, historyVersion);
    if(pos === false){
        historyVersion.push(version);
    }else{
        historyVersion.splice(pos, 1);
        historyVersion.push(version);
    }
    return historyVersion;
}

function deleteVersionHistory(version, historyVersion){
    var pos = fis.util.array_search(version, historyVersion);
    if(pos !== false){
        historyVersion.splice(pos, 1);
    }
    return historyVersion;
}

function getPackageFile(pkg_name, version){
    return pkg_name + "-" + version + ".zip";
}

module.exports.addTotaldowns = function(name, callback){
    fis.db.update(db_component, ROOT_USER, {name : name}, {$inc : {"totaldowns" : 1}}, {}, callback);
};

//需要维护一下字段 ： latest、time、attachments、versions、versionHistory
module.exports.updateComponent = function(component, config, username, email, callback){
    config.latest = config.version;
    config['updateTime'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
    config['updateStamp'] = (new Date()).getTime();
    config['updateAuthor'] = username;
    var historyConfig = fis.util.clone(config),
        fixVersion = fixMongoDBKey(config.version);

    config.versions = component.versions;
    config.versions[fixVersion] = historyConfig;
    config.versionHistory = addVersionHistory(config.version, component.versionHistory);

    component = fis.util.merge(component, config);
    delete component._id;
    UpdatePkgKeyword(config, username, 'add')
        .then(
            function(){
                fis.db.update(db_component, username, {name : config.name}, component, {}, callback);
            }, function(err){
                callback(err);
            })
        .fail(function(err){ callback(err); })
        .done();
};

function UpdatePkgKeyword(config, username, option){
    var defer = Q.defer();
    if(!config.keywords){
        config.keywords = [];
    }
    config.keywords.push('all');
    config.keywords.forEach(function(key){
        //collection, userid, query, callback
        key = key.toLowerCase();
        switch(option){
            case 'add':
                _UpdatePkgKeyword(key, config.name, username)
                    .then(
                    function(result){
                        defer.resolve(result);
                    },
                    function(err){
                        defer.reject(err);
                    });
                break;
            case 'remove':
                _RemovePkgKeyword(key, config.name, username)
                    .then(
                    function(result){
                        defer.resolve(result);
                    },
                    function(err){
                        defer.reject(err);
                    });
                break;
            default :
                defer.reject('invalid keywords process');
                break;
        }
    });
    return defer.promise;
};
function _UpdatePkgKeyword(keyword, pkgname, username){
    var deferred = Q.defer();
    fis.db.findOne(db_pkgKeyword, username, {_id: keyword}, function(err, result){
        if(err){
            deferred.rejected("find keyword failed");
        }else if(result == null){
            //新增keyword
            var doc = {
                _id : keyword,
                pkgs: [pkgname],
                permission : {mode : 777}
            };
            //collection, userid, docs, options, callback
            fis.db.insert(db_pkgKeyword, username, doc, {}, function(err, result){
                if(err){
                    deferred.reject('insert keyword failed');
                }else{
                    deferred.resolve(result);
                }
            });
        }else{
            //更新已经有的keyword表
            if(!fis.util.in_array(pkgname, result.pkgs, false)){
                result.pkgs.push(pkgname);
                delete result._id;
                //collection, userid, query, update, options, callback
                fis.db.update(db_pkgKeyword, username, {_id: keyword}, result, {}, function(err, result){
                    if(err){
                        deferred.reject('update keyword failed');
                    }else{
                        deferred.resolve(result);
                    }
                });
            }else{
                deferred.resolve(result);
            }
        }
    });
    return deferred.promise;
};

function _RemovePkgKeyword(keyword, pkgname, username){
    var deferred = Q.defer();
    fis.db.findOne(db_pkgKeyword, username, {_id: keyword}, function(err, result){
        if(err){
            deferred.rejected("find keyword failed");
        }else if(result !== null){
            //更新已经有的keyword表,删掉这个包
            var doc = result;
            if(fis.util.in_array(pkgname, doc.pkgs, false)){
                for(var i=0;i<doc.pkgs.length;i++){
                    if(doc.pkgs[i] == pkgname){
                        doc.pkgs.splice(i, 1);
                    }
                }
                if(doc.pkgs.length == 0){
                    //keyword已经没有pkg，直接删除这个关键字
                    //collection, userid, query, options, callback
                    fis.db.remove(db_pkgKeyword, username, {_id: keyword}, {}, function(err, result){
                        if(err){
                            deferred.reject('remove keyword failed');
                        }else{
                            deferred.resolve(result);
                        }
                    });
                }else{
                    delete doc._id;
                    //collection, userid, query, update, options, callback
                    fis.db.update(db_pkgKeyword, username, {_id: keyword}, doc, {}, function(err, result){
                        if(err){
                            deferred.reject('update keyword failed');
                        }else{
                            deferred.resolve(result);
                        }
                    });
                }
            }else{
                deferred.resolve(result);
            }
        }else{
            deferred.resolve(result);
        }
    });
    return deferred.promise;
};

module.exports.addComponent = function(config, username, email, callback){
    config.latest = config.version;
    config['createTime'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
    config['updateTime'] = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
    config['updateStamp'] = (new Date()).getTime();
    config['updateAuthor'] = username;
    config.totaldowns = 0;
    var historyConfig = fis.util.clone(config),
        fixVersion = fixMongoDBKey(config.version);

    config._id = config.name;
    config.versions = {};
    config.versions[fixVersion] = historyConfig;
    config.maintainers = [
        {
            name : username,
            email : email
        }
    ];
    config.versionHistory = [config.version];
    config.permission = {
        mode : 777
    };
    UpdatePkgKeyword(config, username, 'add')
        .then(
        function(){
            fis.db.insert(db_component, username, config, {}, callback);
        }, function(err){
            callback(err);
        })
        .fail(function(err){ callback(err); })
        .done();
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
                        var config = {};
                        config.keywords = component.keywords;
                        config.name = component.name;
                        UpdatePkgKeyword(config, username, 'remove')
                            .then(function(){
                                    fis.db.remove(db_component, username, {name : component.name}, {}, function(error){
                                        if(!error){
                                            callback(null, "Unpublish component [" + name + "@" + version + "] success!");
                                        }else{
                                            callback(error);
                                        }
                                    });
                                },function(err){
                                    callback(err);
                                }
                            )
                            .fail(function(err){callback(err);})
                            .done();
                    }
                });
            }else{
                if(fis.util.in_array(version, component.versionHistory, false)){
                    if(component.versionHistory.length == 1){
                        var filename = getPackageFile(name, version);
                        fis.db.unlink(filename, function(error){
                            if(!error){
                                var config = {};
                                config.keywords = component.keywords;
                                config.name = component.name;
                                UpdatePkgKeyword(config, username, 'remove')
                                    .then(
                                        function(){
                                            fis.db.remove(db_component, username, {name : name}, {}, function(error, result){
                                                if(!error){
                                                    callback(null, "Unpublish component [" + name + "@" + version + "] success!");
                                                }else{
                                                    callback(error);
                                                }
                                            });
                                        },
                                        function(err){callback(err);}
                                    )
                                    .fail(function(err){callback(err)})
                                    .done();
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
                            var versionHistory = component.versionHistory;
                            versionHistory = deleteVersionHistory(version, versionHistory);
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
    fis.db.findOne(db_component, ROOT_USER, {name : name}, function(error, component){
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

module.exports.getReadmeFile = function(name, version){
    return name + "-" + version + ".README.md";
};

module.exports.getReadmeContent = function(name, version, callback){
    var readme = exports.getReadmeFile(name, version);
    fis.db.read(readme, {}, function(error, stream){
        callback(error, stream.toString());
    });
};

module.exports.getComponentByTime = function(query, limit, callback){
    fis.db.find(db_component, ROOT_USER, query, {"name":true, "updateAuthor":true, "updateStamp":true, "version":true}, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(cursor == null){
            callback(null, null);
        }else{
            cursor.sort({"updateTime" : -1}).limit(limit).toArray(function(error, components){
                if(!error){
                    callback(null, components);
                }else{
                    callback(error);
                }
            });
        }
    });
};

module.exports.getComponentByDownloads = function(query, limit, callback){
    fis.db.find(db_component, ROOT_USER, query, {"name":true, "totaldowns":true}, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(cursor == null){
            callback(null, null);
        }else{
            cursor.sort({"totaldowns" : -1}).limit(limit).toArray(function(error, components){
                if(!error){
                    callback(null, components);
                }else{
                    callback(error);
                }
            });
        }
    });
};

module.exports.getComponentsByUser = function(username, callback){
    var queryObj = {
            "maintainers.name" : username
        },
        fields = {
            name : true,
            description : true,
            updateStamp : true
        };
    fis.db.find(db_component, ROOT_USER, queryObj, fields, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(cursor == null){
            callback(error, null);
        }else{
            cursor.sort({"updateTime" : -1}).toArray(function(error, components){
                if(error){
                    callback(error);
                }else{
                    callback(null, components);
                }
            });
        }
    });
};

module.exports.search = function(query, callback){
    var reg = new RegExp(query, 'g'),
        queryObj = {
            $or: [
                {name: reg},
                {description: reg},
                {author:reg},
                {keywords:reg}
            ]
        },
        fields = {
            name : true,
            description : true
        };
    fis.db.find(db_component, ROOT_USER, queryObj, fields, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(!cursor){
            callback("Not found components!");
        }else{
            cursor.toArray(function(error, components){
                if(error){
                    callback(error);
                }else{
                    callback(null, components);
                }
            });
        }
    });
};

module.exports.getUserPackageNum = function(callback){
    fis.db.find(db_component, ROOT_USER, {}, {}, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(cursor == null){
            callback(error, null);
        }else{
            cursor.toArray(function(error, components){
                var countResult = {};
                for(var i=0; i<components.length; i++){
                    var component = components[i];
                    for(var j=0; j<component.maintainers.length; j++){
                        var maintainer = component.maintainers[j];
                        if(countResult[maintainer.name]){
                            countResult[maintainer.name]++;
                        }else{
                            countResult[maintainer.name] = 1;
                        }
                    }
                }
                var countArray = [];
                for(var name in countResult){
                    if(countResult.hasOwnProperty(name)){
                        countArray.push({
                            name : name,
                            value : countResult[name]
                        });
                    }
                }
                countArray.sort(function(a, b){
                    return a.value < b.value
                });
                callback(null, countArray);
            });
        }
    });
};

module.exports.getCategories = function(callback){
    fis.db.find(db_pkgKeyword, ROOT_USER, {}, {}, {}, function(err, cursor){
        if(err){
            callback(err);
        }else{
            cursor.toArray(function(error, result){
                if(error){
                    callback(error);
                }else{
                    var categories = [];
                    result.forEach(function(item){
                        categories.push({
                            name : item._id,
                            number : item.pkgs.length
                        });
                    });
                    callback(null, categories.sort(sortNumber).slice(0, 10));
                }
            });
        }
    });

    function sortNumber(a ,b){
        if(a.name == 'all'){
            return -1;
        }else if(b.name == 'all'){
            return 1;
        }else{
            return b.number - a.number;
        }
    };
};

module.exports.getComponentByPage = function(query, limit, page, callback){
    var perpage = 10;
    fis.db.find(db_component, ROOT_USER, query, {"name":true, "totaldowns":true, "description" : true}, {}, function(error, cursor){
        if(error){
            callback(error);
        }else if(cursor == null){
            callback(null, null);
        }else{
            cursor.sort({"totaldowns" : -1}).skip((page - 1) * perpage).limit(limit).toArray(function(error, components){
                if(!error){
                    callback(null, components);
                }else{
                    callback(error);
                }
            });
        }
    });
};

