/**
 * 验证用户是否存在，存在则返回200，不存在则返回500
 * @param req
 * @param res
 * @param app
 */
module.exports.exist = function(req, res, app){
    if(req.query.username && req.query.auth){
        var username = req.query.username,
            auth = req.query.auth;
        fis.db.findOne("user", username, {username:username, _auth:auth}, function(err, result){
            if(!err){
                res.json(200, {msg : "Find the user!"});
            }else{
                res.json(500, {error : "Not found, username or password is wrong!"});
            }
        });
    }else{
        res.json(500, {error : "must have username and auth!"});
    }
};

function isMaintainers(username, maintainers){
    for(var i=0; i<maintainers.length; i++){
        if(username == maintainers[i].name){
            return true;
        }
    }
    return false;
}


//todo hasAuth方法重构，整理逻辑思路
//todo 统一 __ 和 . 两个
module.exports.hasAuth = function(req, res, app){
    //todo 参数检查
    var req_user = req.body.user,
        req_pkg = req.body.pkg,
        op = req.body.op,
        params = req.body.params;
    /**
     *第一步 ： 权限验证
     *  验证用户是否存在
     *      没有 则报错用户不存在
     *      有则
     *          验证publish的包是否存在存在
     *              不存在  返回验证成功
     *              存在
     *                  验证验证用户是否有操作的权限
     *                    有  验证版本是否存在
     *                          不存在
     *                          存在 报错已经存在该版本，请修改version
     *                    没有  报错没有操作权限
     *第二步 : publish
     *   权限验证
     *      失败 : 显示失败原因
     *      成功 ： pkg打包上传，进行publish
     */
    fis.db.findOne("user", req_user.name, {name : req_user.name, _auth : req_user.auth}, function(error, user){
        if(!error){
            if(user){
                fis.db.findOne("pkgs", req_user.name, {name : req_pkg.name}, function(error, pkg){
                    if(!error){
                        if(pkg){
                            if(isMaintainers(user.name, pkg.maintainers)){
                                //todo 获取latest version
                                if(req_pkg.version == "latest"){
                                    req_pkg.version = pkg.latest;
                                }
                                fixVersion = fixPkgVersion(req_pkg.version);
                                switch(op){
                                    case "publish" :
                                        if(params.force){
                                            res.json(200, "Can publish, I sure hope you know what you are doing.");
                                        }else{
                                            if(pkg.versions[fixVersion]){
                                                res.json(500, "Cannot publish over existing version.");
                                            }else{
                                                res.json(200, "Can publish the package");
                                            }
                                        }
                                        break;
                                    case "unpublish":
                                        /**
                                         * 如果version为all
                                         *      直接删除掉所有的tar包和这个package
                                         * 检测version是否存在
                                         *      不存在 则报错 unpublish的version不存在
                                         *      存在
                                         *          是否为最新版本
                                         *              是最新搬 ：
                                         *                  是否还有version 没有整条记录删除
                                         *                  有则从versionHistory中获取上一个版本， versions从按到该版本信息覆盖当前版本， 删除对应信息
                                         *              不是最新版 ： 直接删除versions versionHistory等
                                         */
                                        if(req_pkg.version == "all"){
                                            for(var i=0; i<pkg.versionHistory.length; i++){
                                                var file = getPackageFile(pkg.name, pkg.versionHistory[i]);
                                                fis.db.unlink(file, function(error){
                                                    console.log(error);
                                                })
                                            }
                                            fis.db.remove("pkgs", user.name, {name : pkg.name}, {}, function(error, result){
                                                if(!error){
                                                    res.send(200, {message : "unpublish package [" + pkg.name + "] success!"});
                                                }else{
                                                    res.send(500, {error : error});
                                                }
                                            });
                                        }else{
                                            if(fis.util.in_array(req_pkg.version, pkg.versionHistory, false)){
                                                if(pkg.versionHistory.length == 1){
                                                    var filename = getPackageFile(pkg.name, req_pkg.version);
                                                    fis.db.unlink(filename, function(error){
                                                        console.log(error);
                                                    });
                                                    fis.db.remove("pkgs", user.name, {name : pkg.name}, {}, function(error, result){
                                                        if(!error){
                                                            res.send(200, {message : "unpublish package [" + pkg.name + "] success!"});
                                                        }else{
                                                            res.send(500, {error : error});
                                                        }
                                                    });
                                                }else{
                                                    if(req_pkg.version == pkg.latest){
                                                        pkg.versionHistory.pop();
                                                        delete(pkg.versions[fixPkgVersion(pkg.latest)]);

                                                        var latest = fixPkgVersion(pkg.versionHistory[pkg.versionHistory.length - 1]),
                                                            pkgInfo = pkg.versions[latest];

                                                        pkg = fis.util.merge(pkg, pkgInfo);
                                                    }else{
                                                        var versionHistory = pkg.versionHistory,
                                                            pos = fis.util.array_search(req_pkg.version, versionHistory);
                                                        if(pos !== false){
                                                            versionHistory = fis.util.removeByIndex(versionHistory, pos);
                                                        }
                                                        pkg.versionHistory = versionHistory;
                                                        delete pkg.versions[fixPkgVersion(req_pkg.version)];
                                                    }
                                                    fis.db.update("pkgs", req_user.name, {name : pkg.name}, pkg, {}, function(error, result){
                                                        if(!error){
                                                            var pkgFile = getPackageFile(pkg.name, req_pkg.version);
                                                            fis.db.unlink(pkgFile, function(error, result){
                                                                res.json(200, {message : "unpublish package [" + pkg.name + "] success!"});
                                                            });
                                                        }else{
                                                            res.json(500, {error : error});
                                                        }
                                                    });
                                                }
                                            }else{
                                                res.send(500, {error : "unpublish package [" + pkg.name + "] version [" + req_pkg.version + "] not exist!"});
                                            }
                                        }
                                        break;
                                    case "owner":
                                        /**
                                         *  add
                                         *      获取params的type
                                         *      获取params的username，
                                         *      查看用户是否存在
                                         *          用户不存在则报错
                                         *          用户存在 ：
                                         *              获取name和email， 修改pkg的maintainers
                                         *  rm
                                         *
                                         *
                                         *
                                         *  ls
                                         */
                                        switch(params.type){
                                            case 'add':
                                                fis.db.findOne("user", req_user.name, {name : params.username}, function(error, adduser){
                                                    if(!error){
                                                        if(adduser){
                                                            pkg.maintainers = updateMaintainers(adduser, pkg.maintainers, params.type);
                                                            fis.db.update("pkgs", req_user.name, {name : pkg.name}, pkg, {}, function(error){
                                                                if(!error){
                                                                    res.json(200, {message : "add user [" + adduser.name + "] success!"});
                                                                }else{
                                                                    res.json(500, {error: error});
                                                                }
                                                            });
                                                        }else{
                                                            res.json(500, {error : "user [" + params.username + "] not exist!"});
                                                        }
                                                    }else{
                                                        res.json(500, {error : error});
                                                    }
                                                });
                                                break;
                                            case 'rm':
                                                fis.db.findOne("user", req_user.name, {name : params.username}, function(error, removeuser){
                                                    if(!error){
                                                        if(removeuser){
                                                            pkg.maintainers = updateMaintainers(removeuser, pkg.maintainers, params.type);
                                                            fis.db.update("pkgs", req_user.name, {name : pkg.name}, pkg, {}, function(error){
                                                                if(!error){
                                                                    res.json(200, {message : "rm user [" + removeuser.name + "] success!"});
                                                                }else{
                                                                    res.json(500, {error: error});
                                                                }
                                                            });
                                                        }else{
                                                            res.json(500, {error : "user [" + params.username + "] not exist!"});
                                                        }
                                                    }else{
                                                        res.json(500, {error : error});
                                                    }
                                                });
                                                break;
                                            case 'ls':

                                                break;
                                            default :

                                                break;
                                        }
                                        break;
                                    default :

                                        break;
                                }
                            }else{
                                res.json(500, {error : "No permission to handle package [" + pkg.name + "]"});
                            }
                        }else{
                            switch(op){
                                case "publish":
                                    res.json(200, {msg : "No pkgs find, can " + op + " the pkg"});
                                    break;
                                case "unpublish":
                                    res.json(500, {msg : "No pkgs find, can not unpublish the pkg [" + req_pkg.name + "]"});
                                    break;
                                case "owner":
                                    res.json(500, {msg : "No pkgs find, can not add owner of the pkg [" + req_pkg.name + "]"});
                                    break;
                                default :

                                    break;
                            }
                        }
                    }else{
                        res.json(500, {error : error});
                    }
                });
            }else{
                res.json(500, {error : "Not found, username or password is wrong!"});
            }
        }else{
            res.json(500, {error : error});
        }
    });

};

module.exports.unpublish = function(req, res, app){
    module.exports.hasAuth(req, res, app);
};

module.exports.owner = function(req, res, app){
    module.exports.hasAuth(req, res, app);
};

module.exports.publish = function(req, res, app){

    var file_path = req.files.file.path,
        file_name = req.files.file.name,
        file_type = req.files.file.type,
        file_size = Math.ceil(req.files.file.size / 1024),
        user_name = req.body.user_name,
        config_str = req.body.config;

    var config = JSON.parse(config_str),
        pkg_name = config.name,
        pkg_version = fixPkgVersion(config.version);

    //todo 方法抽取称package.update , 修改versionHistory
    fis.db.findOne("pkgs", user_name, {name : pkg_name}, function(error, pkg){
        if(!error){
            //需要添加的内容 ： latest、time、attachments、versions
            fis.db.writeFile(file_name, {}, file_path, function(error, gs){
                if(!error){
                    config.latest = config.version;
                    config._attachments = {
                        name : file_name,
                        "content-type" : file_type,
                        length : file_size
                    };
                    config.time = fis.util.date_format("yyyy-MM-dd hh:mm:ss");
                    var historyConfig = fis.util.clone(config);
                    if(pkg){
                        config.versions = pkg.versions;
                        config.versions[pkg_version] = historyConfig;
                        config.versionHistory = updateVersionHistory(config.version, pkg.versionHistory);
                        pkg = fis.util.merge(pkg, config);
                        fis.db.update("pkgs", user_name, {name : config.name}, pkg, {}, function(error, result){
                            if(!error){
                                res.json(200, "publish package [" + config.name + "] success!");
                            }else{
                                res.json(500, "publish package [" + config.name + "] error!\n " + error);
                            }
                        });
                    }else{
                        config._id = config.name;
                        config.versions = {};
                        config.versions[pkg_version] = historyConfig;
                        config.maintainers = [
                            {
                                name : user_name
                            }
                        ];
                        config.versionHistory = [config.version];
                        fis.db.insert("pkgs", user_name, config, {}, function(error, result){
                            if(!error){
                                res.json(200, "publish package [" + config.name + "] success!");
                            }else{
                                res.json(500, "publish package [" + config.name + "] error!\n " + error);
                            }
                        })
                    }
                }else{
                    res.send(500, {error : error});
                }
            });
        }else{
            res.json(500, {error : error});
        }
    });

};

/**
 * mongodb中key之不能含有"."
 * @param version
 * @returns {XML|string|void}
 */
function fixPkgVersion(version){
    return version.replace(/\./g, "__");
}

function revertPkgVersion(str){
    return str.replace(/__/g, ".");
}

function getPackageFile(pkg_name, version){
    return pkg_name + "-" + version + ".zip";
}

function updateVersionHistory(version, historyVersion){
    var pos = fis.util.array_search(version, historyVersion);
    if(pos === false){
        historyVersion.push(version);
    }else{
        historyVersion = fis.util.removeByIndex(historyVersion, pos);
        historyVersion.push(version);
    }
    return historyVersion;
}

function updateMaintainers(user, maintainers, op){
    for(var i=0; i<maintainers.length; i++){
        if(maintainers[i].name == user.name){
            switch(op){
                case "add":
                    maintainers[i].email = user.email;
                    break;
                case "rm":
                    maintainers = fis.util.removeByIndex(maintainers, i);
                    break;
            }
            return maintainers;
        }
    }
    switch (op){
        case "add":
            maintainers.push({
                name : user.name,
                email : user.email
            });
            break;
    }
    return maintainers;
}