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
  }

}
