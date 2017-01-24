module.exports = {
  add: function(db,subscriptionID,paypalID,amount,developerID,callback){
    var payments = db.get('payments')
    payments.insert({
      subscription_id: subscriptionID,
      paypal_id: paypalID,
      status: 'received',
      amount: amount,
      developer_id: developerID,
      created_at: new Date()
    },function(err,payment){
      callback(err,payment)
    })
  },
  getPerDeveloper: function(db,developerID,callback){
    var payments = db.get('payments')
    payments.find({developer_id: developerID},function(err,payments){
      callback(err,payments)
    })
  }
}
