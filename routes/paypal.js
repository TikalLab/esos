var express = require('express');
var router = express.Router();
var util = require('util');
var config = require('config');
var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var moment = require('moment')
// var github = require('../app_modules/github');

// var users = require('../models/users');
var repos = require('../models/repos');
var subscriptions = require('../models/subscriptions');

var paypal = require('../app_modules/paypal');


router.post('/webhook',function(req,res,next){
	// console.log(util.inspect(req.body))
console.log('paypal event is %s',req.body.event_type)
	paypal.verifyWebhook(req,function(err){
		if(err){
			res.sendStatus(503);
			console.log('error verifing paypal webbhoook: %s',err)
		}else{
			switch(req.body.event_type){
				case 'BILLING.SUBSCRIPTION.CANCELLED':
					processBillingSubscriptionCancelled(req.db,req.body,function(err){
						if(err){
							console.log('err in processBillingSubscriptionCancelled: %s',util.inspect(err))
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;
				case 'BILLING.SUBSCRIPTION.SUSPENDED':
					processBillingSubscriptionSuspended(req.db,req.body,function(err){
						if(err){
							console.log('err in processBillingSubscriptionSuspended: %s',util.inspect(err))
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;
				case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
					processBillingSubscriptionReactivated(req.db,req.body,function(err){
						if(err){
							console.log('err in processBillingSubscriptionReactivated: %s',util.inspect(err))
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;
				case 'PAYMENT.SALE.COMPLETED':
					processPaymentSaleCompleted(req.db,req.body,function(err){
						if(err){
							console.log('err in processPaymentSaleCompleted: %s',util.inspect(err))
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;
				default:
					res.sendStatus(200)
			}
		}
	})

})

function processBillingSubscriptionCancelled(db,event,callback){
	subscriptions.cancel(db,event.resource.id,function(err){
		callback(err)
	})
}

function processBillingSubscriptionSuspended(db,event,callback){
	subscriptions.suspend(db,event.resource.id,function(err){
		callback(err)
	})
}

function processBillingSubscriptionReactivated(db,event,callback){
	subscriptions.reactivate(db,event.resource.id,function(err){
		callback(err)
	})
}

function processPaymentSaleCompleted(db,event,callback){
	async.waterfall([
		// find subscription
		function(callback){
			subscriptions.getByAgreementID(db,event.resource.billing_agreement.id,function(err,subscription){
				callback(err,subscription)
			})
		},
		function(subscription,callback){
			payments.add(db,subscription._id.toString(),event.resource.id,function(err,payment){
				callback(err,payment)
			})
		}
	],function(err){
		callback(err)
	})
}

module.exports = router;
