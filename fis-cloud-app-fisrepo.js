
module.exports.exist = function(req, res, app, process){
    if(req.query.username && req.query.auth){
        var username = req.query.username,
            auth = req.query.auth;
        console.log(username);
        console.log(auth);
        fis.db.findOne("user", {}, {username:username, _auth:auth}, function(err, result){
            if(!err){
                res.json(200, {msg:"Find the user!"});
            }else{
                console.log(err);
                res.json(500, {error:"Not found, username or password is wrong!"})
            }
        });
    }else{
        res.json(500, {error:"must have username and auth!"})
    }
};

module.exports.test = function(req, res, app){

    res.send("jflkdsjf");
    res.send("ok");
};