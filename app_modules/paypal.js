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
  createBillingPlan: function(repo,plan,price,callback){

    var billingPlanAttributes = {
      name: util.format('Enterprise Support For %s, %s Level',repo.full_name,plan),
      description: util.format('Enterprise Support For %s, % Level',repo.full_name,plan),
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
            value: price
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

  createBillingAgreement: function(repo,plan,callback){
    var isoDate = new Date();
    isoDate.setSeconds(isoDate.getSeconds() + 4);
    isoDate.toISOString().slice(0, 19) + 'Z';

    var billingAgreementAttributes = {
        name: util.format('Enterprise Support for %s, %s Plan',repo.full_name,capitalizeFirstLetter(plan)),
        description: util.format('Enterprise Support for %s, %s Plan, $%s/month ',repo.full_name,capitalizeFirstLetter(plan),repo.pricing[plan].price),
        start_date: isoDate,
        plan: {
            id: repo.pricing[plan].paypal_id
        },
        payer: {
            payment_method: 'paypal'
        },
    };

    paypal.billingAgreement.create(billingAgreementAttributes, function (error, billingAgreement){
      callback(error,billingAgreement)
    });
  },

  executeAgreement: function(token,callback){
    paypal.billingAgreement.execute(token, {}, function (error, billingAgreement){
      callback(error, billingAgreement)
    })
  },

  createAndActivatePlan: function(repo,plan,price,callback){
    var thisObject = this;
    async.waterfall([
      function(callback){
        thisObject.createBillingPlan(repo,plan,price,function(err,billingPlan){
          callback(err,billingPlan)
        })
      },
      function(billingPlan,callback){
        thisObject.activateBillingPlan(billingPlan.id,function(err){
          callback(err,billingPlan)
        })
      },
    ],function(err,billingPlan){
      callback(err,billingPlan)
    })
  },

  verifyWebhook: function(req,callback){
    paypal.notification.webhookEvent.verify(req.headers, req.body, config.get('paypal.webhook_id'), function (error, response) {
      if(error){
        callback(error)
      }else{
        console.log('response is %s',util.inspect(response))
        callback(response.verification_status !== "SUCCESS")
      }
    })
  }

}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
