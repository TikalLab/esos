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
var paypal = require('../app_modules/paypal');
var alertIcons = require('../app_modules/alert-icons');
// var users = require('../models/users');

var errorHandler = require('../app_modules/error');
var users = require('../models/users');
var repos = require('../models/repos');
var subscriptions = require('../models/subscriptions');


router.get('/dashboard',function(req,res,next){
	if(!('paypal_email' in req.session.user)){
		res.redirect('/developers/confirm-paypal-email')
	}else{
		render(req,res,'developers/dashboard',{
			active_page: 'dashboard'
		})
	}
})

router.get('/confirm-paypal-email',function(req,res,next){
	render(req,res,'index/confirm-paypal-email',{})
})

router.post('/confirm-paypal-email',function(req,res,next){
	users.setPaypalEmail(req.db,req.session.user._id.toString(),req.body.paypal_email,function(err,user){
		if(err){
			errorHandler.error(req,res,next,err);
		}else{
			req.session.user = user;
			res.redirect('/developers/dashboard')
		}
	})
})

// router.get('/repos',function(req,res,next){
// 	async.parallel([
// 		function(callback){
// 			github.getUserRepos(req.session.user.github.access_token,function(err,repos){
// 				callback(err,repos)
// 			})
// 		},
// 		function(callback){
// 			repos.getUserRepos(req.db,req.session.user._id.toString(),function(err,repos){
// 				callback(err,repos)
// 			})
// 		}
// 	],function(err,results){
// 		if(err){
//  			errorHandler.error(req,res,next,err);
//  		}else{
//  			render(req,res,'developers/repos',{
// 				user_repos: results[0],
// 				supporting_repos: results[1]
// 			})
//  		}
// 	})
//
// })

router.get('/repos/unsupported',function(req,res,next){
	async.parallel([
		function(callback){
			github.getUserRepos(req.session.user.github.access_tokens.developer,function(err,repos){
				callback(err,repos)
			})
		},
		function(callback){
			repos.getUserRepos(req.db,req.session.user._id.toString(),function(err,repos){
				callback(err,repos)
			})
		}
	],function(err,results){
		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{

			var allRepos = results[0]
			var supportedRepos = results[1]


			// filter
			var unsupportedRepos = _.filter(allRepos,function(repo){
				var alreadySupported = _.find(supportedRepos,function(supportedRepo){
					return repo.full_name == supportedRepo.full_name
				})
				return alreadySupported ? false : true;

			})

 			render(req,res,'developers/unsupported-repos',{
				unsupported_repos: unsupportedRepos,
				active_page: 'unsupported_repos'
			})
 		}
	})

})

router.get('/repos/supported',function(req,res,next){
	async.waterfall([
		// function(callback){
		// 	github.getUserRepos(req.session.user.github.access_token,function(err,repos){
		// 		callback(err,repos)
		// 	})
		// },
		function(callback){
			repos.getUserRepos(req.db,req.session.user._id.toString(),function(err,repos){
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
 			render(req,res,'developers/supported-repos',{
				supported_repos: repos,
				active_page: 'supported_repos'
			})
 		}
	})

})

router.get('/support-repo',function(req,res,next){
	render(req,res,'developers/define-support',{
		repo: req.query.repo
	})
})

router.post('/support-repo',function(req,res,next){

	async.waterfall([
		function(callback){
			github.addBadge(req.session.user.github.access_tokens.developer,req.body.repo,req.body.pricing_personal,function(err){
				callback(err)
			})
		},
		function(callback){
			github.addSLA(req.session.user.github.access_tokens.developer,req.body.repo,function(err,sla){
				callback(err,sla)
			})
		},
		function(sla,callback){
			github.hookRepo(req.session.user.github.access_tokens.developer,req.body.repo,function(err,hook){
				callback(err,sla,hook)
			})
		},
		function(sla,hook,callback){
			github.createLabel(req.session.user.github.access_tokens.developer,req.body.repo,function(err,label){
				callback(err,sla,hook)
			})
		},
		function(sla,hook,callback){
			github.getRepo(req.session.user.github.access_tokens.developer,req.body.repo,function(err,repo){
				callback(err,sla,hook,repo)
			})
		},
		function(sla,hook,repo,callback){
			repos.add(req.db,req.session.user._id.toString(),repo,req.body.pricing_personal,req.body.pricing_team,req.body.pricing_business,req.body.pricing_enterprise,hook,function(err,repo){
				callback(err,sla,repo)
			})
		},
		function(sla,repo,callback){
			async.each(['personal','team','business','enterprise'],function(plan,callback){
				async.waterfall([
					function(callback){
						paypal.createAndActivatePlan(repo,plan,repo.plans[plan].price,function(err,billingPlan){
							callback(err,billingPlan)
						})
					},
					function(billingPlan,callback){
						repos.setPaypalBillingPlan(req.db,repo._id.toString(),plan,billingPlan.id,function(err,repo){
							callback(err,repo)
						})
					}
				],function(err,repo){
					callback(err)
				})
			},function(err){
				callback(err,sla,repo)
			})
		},

		/*
		1. create the web hook so we be notified to comments and pull requests coming from paying users
		2. save it in the db along with the price and other definitions of the developer
		3. add a badge to the readme file of the repo? or at least send a pull request, the way gitter did
		4. also let the user know the permalink for this, i.e. http://esos.io/subscribe/shaharsol/commandcar
		*/
	],function(err,sla,repo){
		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
			req.session.alert = {
				type: 'success',
				message: util.format('Repository %s can now accept subscriptions. We\'ve created a SLA file in your repository which will be presented to any potential subscriber before purchase. Please <a href="%s">review it and edit it</a> if you wish.',req.body.repo,sla.content.html_url)
			};
 			res.redirect('/developers/repos/unsupported')
 		}
	})




})


router.post('/remove-repo-support',function(req,res,next){

	/*
	TBD instead of remove from db.repos maybe set status:cancelled?
	TBD remove the badge from the readme
	TBD remove the SLA file
	TBD remove the billing plan?
	TBD cancel all billing agreements
	TBD remove from db all subscriptions
	*/

	async.waterfall([
		function(callback){
			repos.getByUserAndFullName(req.db,req.session.user._id.toString(),req.body.repo,function(err,repo){
				callback(err,repo)
			})
		},
		function(repo,callback){
			github.unhookRepo(req.session.user.github.access_tokens.developer,req.body.repo,repo.hook_id,function(err){
				callback(err)
			})
		},
		function(callback){
			github.removeLabel(req.session.user.github.access_tokens.developer,req.body.repo,function(err){
				callback(err)
			})
		},
		/*
		TBD remove SLA as well
		*/
		function(callback){
			repos.remove(req.db,req.session.user._id.toString(),req.body.repo,function(err,user){
				callback(err)
			})
		}
/*
TBD TBD
need to stop payments from all clients

*/
	],function(err){
		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
			req.session.alert = {
				type: 'success',
				message: util.format('Repository %s is no longer supported',req.body.repo)
			};
 			res.redirect('/developers/repos/supported')
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
