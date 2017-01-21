module.exports = {
  add: function(db,subscriptionID,paypalID,amount,callback){
    var payments = db.get('payments')
    payments.insert({
      subscription_id: subscriptionID,
      paypal_id: paypalID,
      status: 'received',
      amount: amount,
      created_at: new Date()
    },function(err,payment){
      callback(err,payment)
    })
  }
}
