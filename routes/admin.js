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
var basicAuth = require('basic-auth');

// var users = require('../models/users');
var repos = require('../models/repos');
var users = require('../models/users');
var subscriptions = require('../models/subscriptions');
var payments = require('../models/payments');

var unsubscriber = require('../app_modules/unsubscriber');
var alertIcons = require('../app_modules/alert-icons');

var auth = function (req, res, next) {
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.sendStatus(401);
	};

	var user = basicAuth(req);

	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	};

	if (user.name === config.get('auth.username') && user.pass === config.get('auth.password')) {
		return next();
	}else{
		return unauthorized(res);
	};
};

router.get('/',auth,function(req,res,next){
	render(req,res,'admin/index',{})
})

router.get('/developers',auth,function(req,res,next){
	async.waterfall([
		function(callback){
			repos.getAllDevelopers(req.db,function(err,developerIDs){
				callback(err,developerIDs)
			})
		},
		function(developerIDs,callback){
			users.getByIDs(req.db,developerIDs,function(err,developers){
				callback(err,developers)
			})
		}
	],function(err,developers){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'admin/developers',{
				developers: developers,
				active_page: 'developers'
			})
		}
	})

})

router.get('/clients',auth,function(req,res,next){
	async.waterfall([
		function(callback){
			repos.getAllDevelopers(req.db,function(err,developerIDs){
				callback(err,developerIDs)
			})
		},
		function(developerIDs,callback){
			users.getByIDsNegative(req.db,developerIDs,function(err,clients){
				callback(err,clients)
			})
		}
	],function(err,clients){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'admin/clients',{
				clients: clients,
				active_page: 'clients'
			})
		}
	})

})

router.get('/repos',auth,function(req,res,next){
	async.waterfall([
		function(callback){
			repos.getAll(req.db,function(err,repos){
				callback(err,repos)
			})
		},
		function(repos,callback){
			var reposWithCounts = [];
			async.each(repos,function(repo,callback){
				subscriptions.countPerRepo(req.db,repo._id.toString(),function(err,counts){
					if(err){
						callback(err)
					}else{
						_.each(['personal','team','business','enterprise'],function(plan){
							repo.plans[plan].subscribers_count = counts[plan]
						})
						reposWithCounts.push(repo)
						callback()
					}
				})
			},function(err){
				callback(err,reposWithCounts)
			})
		}
	],function(err,repos){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'admin/repos',{
				repos: repos,
				active_page: 'repos'
			})
		}
	})
})

router.get('/repo/:repo_id',auth,function(req,res,next){
	async.waterfall([
		function(callback){
			repos.get(req.db,req.params.repo_id,function(err,repo){
				callback(err,repo)
			})
		},
		function(repo,callback){
			users.get(req.db,repo.user_id,function(err,developer){
				callback(err,repo,developer)
			})
		},
		function(repo,developer,callback){
			subscriptions.getPerRepo(req.db,req.params.repo_id,function(err,subscriptions){
				callback(err,repo,developer,subscriptions)
			})
		}
	],function(err,repo,developer,subscriptions){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'admin/repo',{
				developer: developer,
				repo: repo,
				subscriptions: subscriptions,
				active_page: 'repos'
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
