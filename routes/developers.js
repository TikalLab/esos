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

router.get('/repos',function(req,res,next){
	async.parallel([
		function(callback){
			github.getUserRepos(req.session.user.github.access_token,function(err,repos){
				callback(err,repos)
			})
		}
	],function(err,results){
		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
 			render(req,res,'developers/repos',{
				repos: results[0]
			})
 		}
	})

})


router.post('/support-repo',function(req,res,next){

	async.waterfall([
		function(callback){
			github.hookRepo(req.session.user.github.access_token,req.body.repo,function(err,hook){
				callback(err,hook)
			})
		},
		function(hook,callback){
			users.addSupportingRepo(req.db,req.session.user._id.toString(),req.body.repo,req.body.price,hook,function(err,user){
				callback(err,user)
			})
		}
	],function(err,user){
		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
			req.session.user = user;
			req.session.alert = {
				type: 'success',
				message: util.format('Repository %s has been hooked successfuly',req.body.repo)
			};
 			res.redirect('/developers/repos')
 		}
	})

/*
1. create the web hook so we be notified to comments and pull requests coming from paying users
2. save it in the db along with the price and other definitions of the developer
3. add a badge to the readme file of the repo? or at least send a pull request, the way gitter did
4. also let the user know the permalink for this, i.e. http://esos.io/subscribe/shaharsol/commandcar
*/


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
