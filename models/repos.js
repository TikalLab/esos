var util = require('util')
module.exports = {
  add: function(db,userID,repo,pricing_perosnal,pricing_team,pricing_business,pricing_enterprise,hook,callback){
    var repos = db.get('repos');
    repos.insert({
      user_id: userID,
      full_name: repo.full_name,
      html_url: repo.html_url,
      pricing: {
        personal: {
          price: pricing_perosnal,
        },
        team: {
          price: pricing_team,
        },
        business: {
          price: pricing_business,
        },
        enterprise: {
          price: pricing_enterprise
        }
      },
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
  getByUserAndFullName: function(db,userID,fullName,callback){
    var repos = db.get('repos');
    repos.findOne({user_id: userID, full_name: fullName},function(err,repo){
      callback(err,repo)
    })
  },
  getByFullName: function(db,fullName,callback){
    var repos = db.get('repos');
    repos.findOne({full_name: fullName},function(err,repo){
      callback(err,repo)
    })
  },
  get: function(db,repoID,callback){
    var repos = db.get('repos');
    repos.findOne({_id: repoID},function(err,repo){
      callback(err,repo)
    })
  },
  setPaypalBillingPlan: function(db,repoID,plan,planID,callback){
    var repos = db.get('repos');
    var field = util.format('pricing.%s.paypal_id',plan)
    var updateSet = {}
    updateSet[field] = planID
    repos.findOneAndUpdate({
      _id: repoID
    },{
      $set: updateSet
    },{
      new: true
    }, function(err,repo){
      callback(err,repo)
    })
  }


}
