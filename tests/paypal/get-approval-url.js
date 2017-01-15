var paypal = require('../../app_modules/paypal')
var util = require('util')
paypal.getApprovalUrl('AOL','tikalk-multijob','50',function(err,billingAgreement){
  console.log('err is %s',util.inspect(err))
  console.log('billingAgreement is %s',util.inspect(billingAgreement))

})
