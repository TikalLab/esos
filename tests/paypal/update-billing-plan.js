var paypal = require('../../app_modules/paypal')
var util = require('util')
paypal.activateBillingPlan('P-6LA954605U854615CUJHA4EQ',function(err,billingPlan){
  console.log('err is %s',util.inspect(err,{depth:8}))
  console.log('billingPlan  is %s',util.inspect(billingPlan,{depth:8}))

})
