var paypal = require('../../app_modules/paypal')
var util = require('util')
paypal.createBillingPlan('AOL','tikalk-multijob','50',function(err,billingPlan){
  console.log('err is %s',util.inspect(err))
  console.log('billingPlan  is %s',util.inspect(billingPlan))

})
