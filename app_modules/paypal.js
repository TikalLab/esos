var config = require('config');
var request = require('request');
var util = require('util');
var paypal = require('paypal-rest-sdk')

paypal.configure({
  mode: config.get('paypal.mode'),
  client_id: config.get('paypal.client_id'),
  client_secret: config.get('paypal.client_secret'),
})
module.exports = {
  createBillingPlan: function(client,repo,amount,callback){

    var billingPlanAttributes = {
      name: util.format('plan for %s for %s',client,repo),
      description: util.format('plan for %s for %s',client,repo),
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
            value: amount
          },
          charge_models: []
        }
      ],
      merchant_preferences: {
        // "setup_fee": {
        //     "currency": "USD",
        //     "value": "1"
        // },
        "cancel_url": "http://localhost:3000/cancel",
        "return_url": "http://localhost:3000/processagreement",
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
  getAccessToken: function(callback){
    // var url = util.format('https://%s:%s@%s/v1/oauth2/token',config.get('paypal.client_id'),config.get('paypal.client_secret'),config.get('paypal.domain'));
    // console.log('url is %s',url)
    // var form = {
    //   grant_type: 'client_credentials'
    // }
    // var auth = {
    //   user: config.get('paypal.client_id'),
    //   pass: config.get('paypal.client_secret'),
    // }
    // var headers = {
    //   Accept: 'application/json',
    //   Authorization: util.format('%s:%s',config.get('paypal.client_id'),config.get('paypal.client_secret'))
    // }
    // console.log('auth is %s',util.inspect(auth))
    // request(url,{/*headers: headers,*/ /*auth: auth,*/ form: form},function(error,response,body){
    //   if(error){
    //     callback(error);
    //   }else if(response.statusCode > 300){
    //     callback(response.statusCode + ' : ' + body);
    //   }else{
    //     var data = JSON.parse(body);
    //     callback(null,data.access_token);
    //   }
    // })
    paypal.configure({
      mode: config.get('paypal.mode'),
      client_id: config.get('paypal.client_id'),
      client_secret: config.get('paypal.client_secret'),
    });

    var billingPlanAttributes = {
    "description": "Create Plan for Regular",
    "merchant_preferences": {
        "auto_bill_amount": "yes",
        "cancel_url": "http://www.cancel.com",
        "initial_fail_amount_action": "continue",
        "max_fail_attempts": "1",
        "return_url": "http://www.success.com",
        "setup_fee": {
            "currency": "USD",
            "value": "25"
        }
    },
    "name": "Testing1-Regular1",
    "payment_definitions": [
        {
            "amount": {
                "currency": "USD",
                "value": "100"
            },
            "charge_models": [
                {
                    "amount": {
                        "currency": "USD",
                        "value": "10.60"
                    },
                    "type": "SHIPPING"
                },
                {
                    "amount": {
                        "currency": "USD",
                        "value": "20"
                    },
                    "type": "TAX"
                }
            ],
            "cycles": "0",
            "frequency": "MONTH",
            "frequency_interval": "1",
            "name": "Regular 1",
            "type": "REGULAR"
        },
        {
            "amount": {
                "currency": "USD",
                "value": "20"
            },
            "charge_models": [
                {
                    "amount": {
                        "currency": "USD",
                        "value": "10.60"
                    },
                    "type": "SHIPPING"
                },
                {
                    "amount": {
                        "currency": "USD",
                        "value": "20"
                    },
                    "type": "TAX"
                }
            ],
            "cycles": "4",
            "frequency": "MONTH",
            "frequency_interval": "1",
            "name": "Trial 1",
            "type": "TRIAL"
        }
    ],
    "type": "INFINITE"
};

paypal.billingPlan.create(billingPlanAttributes, function (error, billingPlan) {
    if (error) {
        console.log(error);
        throw error;
    } else {
        console.log("Create Billing Plan Response");
        console.log(billingPlan);
    }
});
  }
}
