var Base64 = require('js-base64').Base64,
    User = require("./lib/user.js"),
    Component = require('./lib/component.js');

module.exports.adduser = function(req, res, app){
    if(req.query.username && req.query._auth && req.query.email){
        var username = req.query.username,
            _auth = req.query._auth,
            email = req.query.email;
        User.getUserByName(username, function(err, user){
            if(err){
                res.send(500, err);
            }else if(user == null){
                User.addUser(username, _auth, email, function(err, result){
                    if(err){
                        res.json(500, err);
                    }else{
                        res.json(200, "Add user successfully");
                    }
                });
            }else{
                //用户存在，验证_auth
                if(_auth != user._auth){
                    res.json(500, "sorry, username or password is wrong!");
                }else{
                    if(email != user.email){
                        user.email = email;
                        User.updateUser(user, function(error, result){
                            if(error){
                                res.send(500, "Update email error " + error);
                            }else{
                                res.json(200, "Find the user!");
                            }
                        });
                    }else{
                        res.json(200, "Find the user!");
                    }
                }
            }

        });     
    }else{
        res.json(500, "Must have username、auth and email!");
    }
};

module.exports.owner_ls = function(req, res, app){
    var req_component = req.body.component,
        name = req_component.name;
    if(name){
        Component.getComponentByName(name, function(error, component_result){
            if(error){
                res.send(500, "Owner ls error " + error);
            }else if(component_result == null){
                res.send(500, "Component [" + req_component.name + "]@" + req_component.version + " not found!");
            }else{
                var str = "\n";
                for(var i =0; i<component_result.maintainers.length; i++){
                    str += "username : " + component_result.maintainers[i].name + " email : " + component_result.maintainers[i].email + "\n";
                }
                res.send(200, str);
            }
        });
    }else{
        res.send(500, "Owner ls must have component name.");
    }
};

function owner_op(op, req, res, app){
    var req_user = req.body.user,
        req_component = req.body.component,
        options = req.body.options;

    User.getUserByName(options.username, function(error, opuser){
        if(error){
            res.send(500, "Owner " + op + " error " + error);
        }else if(opuser == null){
            res.send(500, "User [" + options.username + "] not exist, register first!");
        }else{
            User.getUserByAuth(req_user.name, req_user._auth, function(error, user){
                if(error){
                    res.send(500, "Owner " + op + " error " + error);
                }else if(user == null){
                    res.send(500, "Username or password is wrong!");
                }else{
                    Component.getComponentByName(req_component.name, function(error, component){
                        if(error){
                            res.send(500, "Owner " + op + " error " + error);
                        }else if(component == null){
                            res.send(500, "Component [" + req_component.name + "@" + req_component.version + "] not found!");
                        }else{
                            if(Component.isMaintainer(component, user.name)){
                                switch(op){
                                    case "add":
                                        Component.addMaintainer(component, opuser, function(error){
                                            if(error){
                                                res.send(500, "Owner " + op + " error " + error);
                                            }else{
                                                res.send(200, "Add user [" + opuser.name + "] success!");
                                            }
                                        });
                                        break;
                                    case "rm":
                                        Component.removeMaintainer(component, opuser.name, function(error){
                                            if(error){
                                                res.send(500, "Owner " + op + " error " + error);
                                            }else{
                                                res.send(200, "Remove user [" + opuser.name + "] success!");
                                            }
                                        });
                                        break;
                                }
                            }else{
                                res.send(500, "No permission " + op + " owner for component [" + component.name + "@" + component.version + "]");
                            }
                        }
                    });
                }
            });
        }
    });
}

module.exports.owner_add = function(req, res, app){
    owner_op("add", req, res, app)
};

module.exports.owner_rm = function(req, res, app){
    owner_op("rm", req, res, app)
};

function component_auth(op, req, res, app){
    var req_user = req.body.user,
        req_component = req.body.component,
        options = req.body.options;

    User.getUserByAuth(req_user.name, req_user._auth, function(error, user){
        if(error){
            res.send(500, op + " error " + error);
        }else if(user == null){
            res.send(500, "Username or password is wrong!");
        }else{
            Component.getComponentByName(req_component.name, function(error, component){
                if(error){
                    res.send(500, op + " error " + error);
                }else if(component == null){
                    switch(op){
                        case "publish":
                            res.send(200, "Have the permission publish!");
                            break;
                        case "unpublish":
                            res.send(500, "Unpublish component [" + req_component.name + "@" + req_component.version + "] not exist!");
                            break;
                    }
                }else{
                    if(Component.isMaintainer(component, user.name)){
                        var hasVersion = Component.hasVersion(component, req_component.version);
                        switch(op){
                            case "publish":
                                if(options.force){
                                    res.send(200, "Can publish, I sure hope you know what you are doing.");
                                }else{
                                    if(hasVersion){
                                        res.json(500, "Component [" + req_component.name + "@" + req_component.version + "] already exist.");
                                    }else{
                                        res.send(200, "Can publish component.");
                                    }
                                }
                                break;
                            case "unpublish":
                                if(hasVersion){
                                    res.send(200, "Can unpublish component [" + component.name + "]");
                                }else{
                                    res.send(500, "Unpublish component [" + req_component.name + "@" + req_component.version + "] not exist!");
                                }
                                break;
                        }
                    }else{
                        res.send(500, "No permission " + op + " component [" + component.name + "]");
                    }
                }
            });
        }
    });
}

module.exports.can_publish = function(req, res, app){
    component_auth("publish", req, res, app);
};

module.exports.publish = function(req, res, app){

    var file_path = req.files.file.path,
        file_name = req.files.file.name,
        file_type = req.files.file.type,
        file_size = Math.ceil(req.files.file.size / 1024),
        user_name = req.body.user_name,
        config_str = req.body.config;

    var config = JSON.parse(config_str),
        component_name = config.name;

    Component.getComponentByName(component_name, function(error, component){
        if(error){
            res.send(500, "Publish component " + error);
        }else{
            //需要添加的内容 ： latest、time、attachments、versions
            fis.db.writeFile(file_name, {}, file_path, function(error, gs){
                if(!error){
                    config._attachments = {
                        name : file_name,
                        "content-type" : file_type,
                        length : file_size
                    };
                    if(component){
                        Component.updateComponent(component, config, user_name, function(error, result){
                            if(!error){
                                res.json(200, "Publish component [" + component.name + "@" + component.version + "] success!");
                            }else{
                                res.json(500, "Publish component [" + component.name + "@" + component.version + "] error [" + error + "]");
                            }
                        });
                    }else{
                        Component.addComponent(config, user_name, function(error, result){
                            if(!error){
                                res.json(200, "Publish component [" + config.name + "@" + config.version + "] success!");
                            }else{
                                res.json(500, "Publish component [" + config.name + "@" + config.version + "] error!");
                            }
                        })
                    }
                }else{
                    res.send(500, error);
                }
            });
        }
    });
};

module.exports.can_unpublish = function(req, res, app){
    component_auth("unpublish", req, res, app);
};

module.exports.unpublish = function(req, res, app){
    var req_user = req.body.user,
        req_component = req.body.component;

    Component.removeComponent(req_component.name, req_component.version, req_user.name, function(error, message){
        if(error){
            res.send(500, error);
        }else{
            res.send(200, message);
        }
    })
};

module.exports.download = function(req, res, app){
    var req_component = req.body.component;
    Component.getComponentAttachment(req_component.name, req_component.version, function(error, file, type){
        if(!error){
            fis.db.read(file, {}, function(error, content){
                if(!error){
                    res.set("filename", file);
                    res.set("Content-Type", type);
                    res.send(content);
                }else{
                    res.send(500, error);
                }
            });
        }else{
            res.send(500, error);
        }
    });

};
