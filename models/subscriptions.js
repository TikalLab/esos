var async = require('async')
var util = require('util')
var repos = require('../models/repos')
module.exports = {
  add: function(db,user,repo,org,billingAgreement,callback){
    var subscriptions = db.get('subscriptions');
    var subscription = {
      user_id: user._id.toString(),
      github_login: user.github.login,
      repo_id: repo._id.toString(),
      full_name: repo.full_name,
      paypal_billing_agreement_id: billingAgreement.id,
      created_at: new Date()
    };
    if(org){
      subscription.org = org;
    }
    subscriptions.insert(subscription,function(err,subscription){
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
  },
  getRepoOrgSubscriptions: function(db,repoID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.find({repo_id: repoID, org:{$exists: true}},function(err,repoOrgSubscriptions){
      callback(err,repoOrgSubscriptions)
    })
  }
}
