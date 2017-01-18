module.exports = {
  add: function(db,subscriptionID,paypalID,callback){
    var payments = db.get('payments')
    payments.insert({
      subscription_id: subscriptionID,
      paypal_id: paypalID,
      created_at: new Date(),
      status: 'received'
    },function(err,payment){
      callback(err,payment)
    })
  }
}
