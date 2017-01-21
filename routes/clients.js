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
var github = require('../app_modules/github');
var paypal = require('../app_modules/paypal');
var alertIcons = require('../app_modules/alert-icons');
// var users = require('../models/users');

var errorHandler = require('../app_modules/error');
var users = require('../models/users');
var subscriptions = require('../models/subscriptions');
var repos = require('../models/repos');
var atob = require('atob')


var plansCalculator = require('../view_helpers/plans-calculator')

router.get('/choose-org/:owner/:name',function(req,res,next){
	async.parallel([
		function(callback){
			github.getUserOrgs(req.session.user.github.access_token,function(err,orgs){
				callback(err,orgs)
			})
		},
		function(callback){
			var repoFullName = util.format('%s/%s',req.params.owner,req.params.name);
			async.waterfall([
				function(callback){
					repos.getByFullName(req.db,repoFullName,function(err,repo){
						callback(err,repo)
					})
				},
				function(repo,callback){
					users.get(req.db,repo.user_id,function(err,user){
						callback(err,user)
					})
				},
				function(user,callback){
					github.getSLA(user.github.access_token,repoFullName,function(err,sla){
						callback(err,sla)
					})
				}
			],function(err,sla){
				callback(err,sla)
			})
		}
	],function(err,results){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			render(req,res,'clients/choose-org',{
				orgs: results[0],
				sla: atob(results[1].content),
				owner: req.params.owner,
				name: req.params.name
			})
		}
	})
})

router.get('/choose-org/:repo_id',function(req,res,next){
	async.parallel([
		function(callback){
			async.waterfall([
				function(callback){
					github.getUserOrgs(req.session.user.github.access_token,function(err,orgs){
						callback(err,orgs)
					})
				},
				function(orgs,callback){
					var orgsWithMembersCount = [];
					async.each(orgs,function(org,callback){
						github.getOrgMembersCount(req.session.user.github.access_token,org.login,function(err,count){
							if(err){
								callback(err)
							}else{
								org.members_count = count;
								orgsWithMembersCount.push(org)
								callback()
							}
						})
					},function(err){
						callback(err,orgsWithMembersCount)
					})
				}
			],function(err,orgs){
				callback(err,orgs)
			})
		},
		function(callback){
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
					github.getSLA(developer.github.access_token,repo.full_name,function(err,sla){
						callback(err,repo,developer,sla)
					})
				}
			],function(err,repo,developer,sla){
				callback(err,{
					repo: repo,
					developer: developer,
					sla: sla
				})
			})
		},
		function(callback){
			github.getUserTeams(req.session.user.github.access_token,function(err,teams){
				callback(err,teams)
			})
		}
	],function(err,results){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
console.log('teams are %s',util.inspect(results[2]))
			render(req,res,'index/choose-org',{
				orgs: results[0],
				sla: atob(results[1].sla.content),
				repo: results[1].repo,
				developer: results[1].developer,
				teams: results[2],
				plans_calculator: plansCalculator
			})
		}
	})
})


router.get('/pay/:repo_id',function(req,res,next){

	req.session.subscription = {
		plan: 'personal'
	}
	if(req.query.team_or_org){
		var parts = req.query.team_or_org.split(':')
		if(parts[0] == 'org'){
			req.session.subscription = {
				org: parts[2],
				plan: parts[1]
			}
		}else if(parts[0] == 'team'){
			req.session.subscription = {
				team: {
					id: parts[2],
					org: parts[3],
					name: parts[4]
				},
				plan: parts[1]
			}
		}
	}

	async.waterfall([
		function(callback){
			repos.get(req.db,req.params.repo_id,function(err,repo){
				callback(err,repo)
			})
		},
		function(repo,callback){
			paypal.createBillingAgreement(repo,req.session.subscription.plan,function(err,billingAgreement){
				callback(err,billingAgreement)
			})
		}
	],function(err,billingAgreement){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			var redirectUrl = _.find(billingAgreement.links,function(link){
				return link.rel == 'approval_url'
			}).href;
			res.redirect(redirectUrl)

		}
	})
})

router.get('/paypal/cancelled/:repo_id',function(req,res,next){

})

router.get('/paypal/paid/:repo_id',function(req,res,next){
	async.waterfall([
		function(callback){
			paypal.executeAgreement(req.query.token,function(err,billingAgreement){
				callback(err,billingAgreement)
			})
		},
		function(billingAgreement,callback){
			repos.get(req.db,req.params.repo_id,function(err,repo){
				callback(err,billingAgreement,repo)
			})
		},
		function(billingAgreement,repo,callback){
			subscriptions.add(req.db,req.session.user,repo,req.session.subscription.plan,req.session.subscription.org,req.session.subscription.team,billingAgreement,function(err,subscription){
				callback(err,repo,subscription)
			})
		}
	],function(err,repo,subscription){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			delete req.session.subscription;
			// req.session.alert = {
			// 	type: 'success',
			// 	message: util.format('You successfuly subscribed to %s support',repo.full_name)
			// }
			// res.redirect('/clients/subscriptions')
			render(req,res,'index/thank-you',{
				repo: repo,
				subscription: subscription
			})
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
	params.marked = marked;

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
