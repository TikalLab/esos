var config = require('config');
var request = require('request');
var util = require('util');
var paypal = require('paypal-rest-sdk')
var async = require('async')

paypal.configure({
  mode: config.get('paypal.mode'),
  client_id: config.get('paypal.client_id'),
  client_secret: config.get('paypal.client_secret'),
})

module.exports = {
  createBillingPlan: function(client,repo,callback){

    var billingPlanAttributes = {
      name: util.format('plan for %s for %s',client,repo.full_name),
      description: util.format('plan for %s for %s',client,repo.full_name),
      type: 'INFINITE',
      payment_definitions: [
        {
          id: 'a',
          name: 'a',
          type: 'REGULAR',
          frequency: 'MONTH',
          frequency_interval: '1',
          cycles: '0',
          amount: {
            currency: 'USD',
            value: repo.price
          },
          charge_models: []
        }
      ],
      merchant_preferences: {
        // "setup_fee": {
        //     "currency": "USD",
        //     "value": "1"
        // },
        cancel_url: util.format('http://%s/clients/paypal/cancelled/%s',config.get('app.domain'),repo._id),
        return_url: util.format('http://%s/clients/paypal/paid/%s',config.get('app.domain'),repo._id),
        // "max_fail_attempts": "0",
        // "auto_bill_amount": "YES",
        // "initial_fail_amount_action": "CONTINUE"
      }
    }

    console.log('attr are %s',util.inspect(billingPlanAttributes))

    paypal.billingPlan.create(billingPlanAttributes, function (error, billingPlan) {
      callback(error,billingPlan)
    });
  },

  activateBillingPlan: function(planID,callback){
    var billingPlanUpdateAttributes = [{
      op: 'replace',
      path: '/',
      value: {
          state: 'ACTIVE'
      }
    }];

    paypal.billingPlan.update(planID,billingPlanUpdateAttributes,function(err){
      callback(err)
    })
  },

  createBillingAgreement: function(planID,repo,callback){
    var isoDate = new Date();
    isoDate.setSeconds(isoDate.getSeconds() + 4);
    isoDate.toISOString().slice(0, 19) + 'Z';

    var billingAgreementAttributes = {
        name: util.format('subscription to enterprise support of %s',repo.full_name),
        description: util.format('subscription to enterprise support of %s',repo.full_name),
        start_date: isoDate,
        plan: {
            id: planID
        },
        payer: {
            payment_method: 'paypal'
        },
    };

    paypal.billingAgreement.create(billingAgreementAttributes, function (error, billingAgreement){
      callback(error,billingAgreement)
    });
  },

  getApprovalUrl: function(client,repo,callback){
    var thisObject = this;
    async.waterfall([
      function(callback){
console.log('here')
        thisObject.createBillingPlan(client,repo,function(err,billingPlan){
          callback(err,billingPlan)
        })
      },
      function(billingPlan,callback){
        console.log('here2')
        thisObject.activateBillingPlan(billingPlan.id,function(err){
          callback(err,billingPlan)
        })
      },
      function(billingPlan,callback){
        console.log('here3')
        thisObject.createBillingAgreement(billingPlan.id,repo,function(err,billingAgreement){
          callback(err,billingAgreement)
        })
      }
    ],function(err,billingAgreement){
      callback(err,billingAgreement)
    })
  }

}
