var express = require('express');
var router = express.Router();
var util = require('util');
var config = require('config');
var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var moment = require('moment')
var github = require('../app_modules/github');
var alertIcons = require('../app_modules/alert-icons');
// var users = require('../models/users');

var errorHandler = require('../app_modules/error');
var users = require('../models/users');
var subscriptions = require('../models/subscriptions');
var repos = require('../models/repos');

router.get('/choose-org/:owner/:name',function(req,res,next){
	async.parallel([
		function(callback){
			github.getUserOrgs(req.session.user.github.access_token,function(err,orgs){
				callback(err,orgs)
			})
		},
	],function(err,results){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'clients/choose-org',{
				orgs: results[0],
				owner: req.params.owner,
				name: req.params.name
			})
		}
	})
})

router.get('/pay/:owner/:name',function(req,res,next){
	req.session.subscription = {
		org: req.query.org
	}
	res.redirect(util.format('/clients/paid/%s/%s',req.params.owner,req.params.name))
})

router.get('/paid/:owner/:name',function(req,res,next){
	var fullName = util.format('%s/%s',req.params.owner,req.params.name)
	async.waterfall([
		function(callback){
			repos.getByFullName(req.db,fullName,function(err,repo){
				callback(err,repo)
			})
		},
		function(repo,callback){
			subscriptions.add(req.db,req.session.user,repo,req.session.subscription.org,function(err,subscription){
				callback(err,subscription)
			})
		}
	],function(err,subscription){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			req.session.alert = {
				type: 'success',
				message: util.format('You successfuly subscribed to %s support',fullName)
			}
			res.redirect('/clients/subscriptions')
		}
	})
})

router.get('/subscriptions',function(req,res,next){
	async.parallel([
		function(callback){
			subscriptions.getForUser(req.db,req.session.user._id.toString(),function(err,subscriptions){
				callback(err,subscriptions)
			})
		}
	],function(err,results){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'clients/subscriptions',{
				subscriptions: results[0]
			})
		}
	})
})

function render(req,res,template,params){

	// params.user = req.session.user;
//	params.alert = req.session.alert;
//	delete req.session.alert;

	params.app = req.app;
	params._ = _;
	// params.us = us;
	params.moment = moment;
	params.config = config;
	params.util = util;

	params.alertIcons = alertIcons;
	params.alert = req.session.alert;
	delete req.session.alert;

	params.user = req.session.user;

	if(!('active_page' in params)){
		params.active_page = false;
	}

	if(!('isHomepage' in params)){
		params.isHomepage = false;
	}

	res.render(template,params);
}
module.exports = router;
