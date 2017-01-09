var async = require('async')
var repos = require('../models/repos')
module.exports = {
  add: function(db,user,repo,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.insert({
      user_id: user._id.toString(),
      github_login: user.github.login,
      repo_id: repo._id.toString(),
      full_name: repo.full_name,
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
  },
  getByGithubLoginAndRepoID: function(db,githubLogin,repoID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.findOne({repo_id: repoID, github_login: githubLogin},function(err,subscription){
      callback(err,subscription)
    })
  }
}
