var async = require('async')
var repos = require('../models/repos')
module.exports = {
  add: function(db,userID,repoID,fullName,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.insert({
      user_id: userID,
      repo_id: repoID,
      full_name: fullName,
      created_at: new Date()
    },function(err,subscription){
      callback(err,subscription)
    })
  },
  getForUser: function(db,userID,callback){
    async.waterfall([
      function(callback){
        var subscriptions = db.get('subscriptions');
        subscriptions.find({user_id: userID},function(err,subscriptions){
          callback(err,subscriptions)
        })
      },
      function(subscriptions,callback){
        var ret = [];
        async.each(subscriptions,function(subscription,callback){
          repos.get(db,subscription.repo_id,function(err,repo){
            if(err){
              callback(err)
            }else{
              subscription.repo = repo;
              ret.push(subscription);
              callback()
            }
          })
        },function(err){
          callback(err,ret)
        })
      }
    ],function(err,subscriptions){
      callback(err,subscriptions)
    })
  }
}
