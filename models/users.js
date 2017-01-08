module.exports = {
  addSupportingRepo: function(db,userID,repo,price,hook,callback){
    var users = db.get('users');
    users.findOneAndUpdate({
      _id: userID
    },{
      $addToSet: {
        supporting_repos: {
          full_name: repo,
          price: price,
          hook_id: hook.id,
          created_at: new Date()
        }
      }
    },{
      new: true
    },function(err,user){
      callback(err,user)
    })
  },
  removeRepoSupport: function(db,userID,repo,callback){
    var users = db.get('users');
    users.findOneAndUpdate({
      _id: userID
    },{
      $pull: {
        supporting_repos: {
            full_name: repo
        }
      }
    },{
      new: true
    },function(err,user){
      callback(err,user)
    })
  }

}
