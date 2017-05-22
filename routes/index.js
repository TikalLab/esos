var express = require('express');
var router = express.Router();
var util = require('util');
var config = require('config');
var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var moment = require('moment')
var marked = require('marked')
var atob = require('atob')
// var github = require('../app_modules/github');

// var users = require('../models/users');
var repos = require('../models/repos');
var users = require('../models/users');

var github = require('../app_modules/github');
var unsubscriber = require('../app_modules/unsubscriber');
var errorHandler = require('../app_modules/error');

router.get('/',function(req,res,next){
	if(!req.session.user){
		render(req,res,'index/homepage',{
			isHomepage: true
		})
	}else{
		res.redirect('/developers/dashboard')
	}
})

router.get('/dashboard',function(req,res,next){
	render(req,res,'index/dashboard',{})
})

router.get('/tos',function(req, res, next) {
		render(req,res,'index/tos',{

		})
})


router.get('/logout',function(req,res,next){
	delete req.session.user;
	res.redirect('/')
})

router.get('/subscribe/:owner/:name',function(req,res,next){
	async.waterfall([
		function(callback){
			var fullName = util.format('%s/%s',req.params.owner,req.params.name)
			repos.getByFullName(req.db,fullName,function(err,repo){
				callback(err,repo)
			})
		},
		function(repo,callback){
			users.get(req.db,repo.user_id,function(err,developer){
				callback(err,repo,developer)
			})
		},
		function(repo,developer,callback){
			github.getSLA(developer.github.access_tokens.developer,repo.full_name,function(err,sla){
				callback(err,repo,developer,sla)
			})
		}

	],function(err,repo,developer,sla){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'index/subscribe',{
				repo: repo,
				developer: developer,
				sla: atob(sla.content)
			})
		}
	})
})

router.get('/subscribe/:repo_id',function(req,res,next){
	async.parallel([
		function(callback){
			repos.get(req.db,req.params.repo_id,function(err,repo){
				callback(err,repo)
			})
		}
	],function(err,results){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'index/subscribe',{
				repo: results[0]
			})
		}
	})
})

router.get('/unsubscribe/:email_type/:user_id/:code', function(req, res, next) {
	if(!unsubscriber.verify(req.params.user_id,req.params.code)){
		// now what?
	}else{
		var users = req.db.get('users');
		var updateSet = {};
		updateSet['unsubscribes.' + req.params.email_type] = true;
		users.update({_id: req.params.user_id},{$set:updateSet},function(err,ok){
			if(err){
				errorHandler.error(req,res,next,err);
			}else{
				render(req,res,'index/unsubscribed',{
					email_type: req.params.email_type
				})
			}
		})
	}
});

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
	params.marked = marked;

	// params.alertIcons = alertIcons;
	// params.alert = req.session.alert;
	// delete req.session.alert;

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
