var async = require('async')
var util = require('util')
var repos = require('../models/repos')
module.exports = {
  add: function(db,user,repo,plan,org,team,billingAgreement,callback){
    var subscriptions = db.get('subscriptions');
    var subscription = {
      user_id: user._id.toString(),
      github_login: user.github.login,
      repo_id: repo._id.toString(),
      full_name: repo.full_name,
      plan: plan,
      paypal_billing_agreement_id: billingAgreement.id,
      status: 'active',
      created_at: new Date()
    };
    if(org){
      subscription.org = org;
    }
    if(team){
      subscription.team = team;
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
    subscriptions.findOne({repo_id: repoID, github_login: githubLogin, status: 'active'},function(err,subscription){
      callback(err,subscription)
    })
  },
  getRepoOrgSubscriptions: function(db,repoID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.find({repo_id: repoID, org:{$exists: true}, status: 'active'},function(err,repoOrgSubscriptions){
      callback(err,repoOrgSubscriptions)
    })
  },
  cancel: function(db,billingAgreementID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.udpate({
      paypal_billing_agreement_id: billingAgreementID
    },{
      $set: {
        status: 'cancelled',
        canclled_at: new Date()
      }
    },function(err){
      callback(err)
    })
  },
  suspend: function(db,billingAgreementID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.udpate({
      paypal_billing_agreement_id: billingAgreementID
    },{
      $set: {
        status: 'suspended',
        suspended_at: new Date()
      }
    },function(err){
      callback(err)
    })
  },
  reactivate: function(db,billingAgreementID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.udpate({
      paypal_billing_agreement_id: billingAgreementID
    },{
      $set: {
        status: 'active',
        reactivated_at: new Date()
      }
    },function(err){
      callback(err)
    })
  },
  getByAgreementID: function(db,agreementID,callback){
    var subscriptions = db.get('subscriptions');
    subscriptions.findOne({paypal_billing_agreement_id: agreementID},function(err,subscription){
      callback(err,subscription)
    })
  },
  countPerRepo: function(db,repoID,callback){
    var counts = {};
    var subscriptions = db.get('subscriptions');
    async.each(['personal','team','business','enterprise'],function(plan,callback){
      subscriptions.count({repo_id: repoID, status: 'active', plan: plan},function(err,count){
        if(err){
          callback(err)
        }else{
          counts[plan] = count;
          callback()
        }
      })
    },function(err){
      callback(err,counts)
    })
  }

}
