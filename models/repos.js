module.exports = {
  add: function(db,userID,repo,price,hook,callback){
    var repos = db.get('repos');
    repos.insert({
      user_id: userID,
      full_name: repo,
      price: price,
      hook_id: hook.id,
      created_at: new Date()
    },function(err,repo){
      callback(err,repo)
    })
  },
  remove: function(db,userID,fullName,callback){
    var repos = db.get('repos');
    repos.remove({
      user_id: userID,
      full_name: fullName
    },function(err){
      callback(err)
    })
  },
  getUserRepos: function(db,userID,callback){
    var repos = db.get('repos');
    repos.find({user_id: userID},function(err,repos){
      callback(err,repos)
    })
  },
  get: function(db,userID,fullName,callback){
    var repos = db.get('repos');
    repos.findOne({user_id: userID, full_name: fullName},function(err,repo){
      callback(err,repo)
    })
  }

}
