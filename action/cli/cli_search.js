
module.exports = function(req, res, app){
    var db = fis.db.getConnection();
    
    var query = {},
        queryObj = {};
    if(req.query.q){
        query = req.query.q;
        var reg = new RegExp(query, 'g');
console.log(reg);
        queryObj = {
            $or: [
                {name: reg},
                {description: reg},
                {author:reg},
                {keywords:reg},
                {"repository.url": reg}
            ]
        };
    }

    var options = {
        name:true,
        description:true,
        keywords: true,
        author:true,
        repository:true,
        version:true,
        license:true,
        maintainers:true
    };

    fis.db.find(fis.db.COLLECTION_LIST.pkg, 'root', queryObj, options, {}, function(err, result){
        if(err){
            res.json(500, {error : err});
        }else{
            if(result === null){
                res.json(500, {error : 'sorry, no components found'});
            }else{
                //��ѯmaintainers���������飬merge�󷵻�
                result.toArray(function(err, r){
                    if(err){
                        res.json(500, {error : err});
                    }else{
                        res.json(200, r);
                    }
                });
            }
        }
    });
};
