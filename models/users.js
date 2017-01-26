var _ = require('underscore')
module.exports = {
  get: function(db,userID,callback){
    var users = db.get('users');
    users.findOne({_id: userID},function(err,user){
      callback(err,user)
    })
  },
  setPaypalEmail: function(db,userID,paypalEmail,callback){
    var users = db.get('users');
    users.findOneAndUpdate({
      _id: userID
    },{
      $set: {
        paypal_email: paypalEmail
      }
    },{
      new: true
    },function(err,user){
      callback(err,user)
    })
  },
  getByIDs: function(db,list,callback){
    var users = db.get('users');

    var userIDs = [];
    _.each(list,function(item){
      userIDs.push(users.id(item))
    })

    users.find({_id: {$in: userIDs}},function(err,users){
      callback(err,users)
    })

  },
  getByIDsNegative: function(db,list,callback){
    var users = db.get('users');

    var userIDs = [];
    _.each(list,function(item){
      userIDs.push(users.id(item))
    })

    users.find({_id: {$nin: userIDs}},function(err,users){
      callback(err,users)
    })

  }

}
