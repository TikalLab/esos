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
var paypal = require('../app_modules/paypal');


router.post('/webhook',function(req,res,next){
	// console.log(util.inspect(req.body))

	paypal.verifyWebhook(req,function(err){
		if(err){
			res.sendStatus(503);
			console.log('error verifing paypal webbhoook: %s',err)
		}else{
			switch(req.body.event_type){
				case 'BILLING.SUBSCRIPTION.CANCELLED':
					processBillingSubscriptionCancelled(req.body,function(err){
						if(err){
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;
				case 'PAYMENT.CAPTURE.COMPLETED':
					processPaymentCaptureCompleted(req.body,function(err){
						if(err){
							res.sendStatus(503)
						}else{
							res.sendStatus(200)
						}
					})
					break;

			}
		}
	})

})

function processBillingSubscriptionCancelled(event,callback){

}

function processPaymentCaptureCompleted(event,callback){

}

module.exports = router;
