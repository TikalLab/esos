var express = require('express');
var router = express.Router();
var util = require('util');
var config = require('config');
var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var crypto = require('crypto');
var fs = require('fs')
var path = require('path')

var github = require('../app_modules/github');
var errorHandler = require('../app_modules/error');
// var mailer = require('../app_modules/mailer');

var repos = require('../models/repos');
var subscriptions = require('../models/subscriptions');

router.get('/authorize-developer',function(req,res,next){
	req.session.afterGithubRedirectTo = req.query.next;
	var redirect = {
		protocol: 'https',
		host: 'github.com',
		pathname: '/login/oauth/authorize',
		query: {
			client_id: config.get('github.client_id'),
			redirect_uri: 'http://' + config.get('github.redirect_domain') + '/github/authorized',
			scope: 'user:email,admin:repo_hook'

		}
	}
	res.redirect(url.format(redirect));
})

router.get('/authorize-client',function(req,res,next){
	req.session.afterGithubRedirectTo = req.query.next;
	var redirect = {
		protocol: 'https',
		host: 'github.com',
		pathname: '/login/oauth/authorize',
		query: {
			client_id: config.get('github.client_id'),
			redirect_uri: 'http://' + config.get('github.redirect_domain') + '/github/authorized',
			scope: 'user:email'
		}
	}
	res.redirect(url.format(redirect));
})

router.get('/authorized',function(req,res,next){
	async.waterfall([
 	    // switch the code for access token
 		function(callback){
 			var form = {
 				client_id: config.get('github.client_id'),
 				client_secret: config.get('github.client_secret'),
 				code: req.query.code,
 			}
 			var headers = {
 				Accept: 'application/json'
 			}
 			request.post('https://github.com/login/oauth/access_token',{form: form, headers: headers},function(error,response,body){
 				if(error){
 					callback(error);
 				}else if(response.statusCode > 300){
 					callback(response.statusCode + ' : ' + body);
 				}else{
 					var data = JSON.parse(body);
console.log('data from github: %s',util.inspect(data))
 					var accessToken = data.access_token;

 					callback(null,accessToken);
 				}
 			});
 		},
		// get the github user record
		function(accessToken,callback){
			github.getUser(accessToken,function(err,githubUser){
				callback(err,accessToken,githubUser)
			})
		},
		// get the email
		function(accessToken,githubUser,callback){
			github.getUserEmail(accessToken,function(err,email){
				callback(err,accessToken,githubUser,email)
			})
		},
		function(accessToken,githubUser,email,callback){
console.log('here %s,%s',githubUser.login,email)
			var users = req.db.get('users');
			users.findAndModify({
				'github.login': githubUser.login
			},{
				$set: {
					github: {
						access_token: accessToken,
						login: githubUser.login,
						avatar_url: githubUser.avatar_url
					},
					name: githubUser.name ? githubUser.name : githubUser.login,
					email: email
				},
				$setOnInsert: {
					created_at: new Date()
				}
			},{
				new: true,
				upsert: true
			},function(err,user){
				callback(err,user)
			})

		}
 	],function(err,user){
 		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
 			req.session.user = user;
			var next = req.session.afterGithubRedirectTo;
			delete req.session.afterGithubRedirectTo;
			if(!next){
				next = '/';
			}
			res.redirect(next)
 		}
 	});
})

router.post('/repo-webhook',function(req, res, next) {
	console.log('received a REPO webhook notification from github!');
	console.log('%s',util.inspect(req.body));

	// calc the signature according to X-Hub-Signature and verify the hook is valid
	var hmac = crypto.createHmac('sha1', config.get('github.hook_secret'));
	hmac.update(JSON.stringify(req.body));
	// hmac.update(req.rawBody);
	var calcedSignature = hmac.digest('hex');
	console.log('signature is %s',calcedSignature);

	var githubSignature = req.headers['x-hub-signature'].split('=')[1]; // header content is in format sha1={signature}, we need only the {signature} part
	if(githubSignature != calcedSignature){
		console.log('A SPOOFED HOOK RECEIVED!!! github sig: %s, calced sig: %s',githubSignature,calcedSignature);
	}else{

		console.log('verified signature')

		async.waterfall([
			function(callback){
				repos.getByFullName(req.db,req.body.repository.full_name,function(err,repo){
					callback(err,repo)
				})
			},
			function(repo,callback){
				subscriptions.getByGithubLoginAndRepoID(req.db,req.body.sender.login,repo._id.toString(),function(err,subscription){
					callback(err,repo,subscription)
				})
			}
		],function(err,repo,subscription){
			if(err){
				console.log('err in processing hook: %s',err)
			}else{
				if(subscription){
					switch(req.headers['x-github-event']){
					case 'pull_request':
						console.log('this is a push!');
						// processPullRequest(user,req.body,req.db);
						break;
					case 'issue_comment':
						console.log('this is a issue_comment!');
						// processIssueComment(user,req.body,req.db);
						break;
					case 'issues':
						console.log('this is a issues!');
						// processIssue(user,req.body,req.db);
						break;
					default:
						console.log('header is : %s',req.headers['x-github-event']);
						break;
					}

				}else{
					console.log('this event wasnt triggered by a subscriber to the repo...')
				}

			}
		})

	}



	res.sendStatus(200);

})


function processPush(user,push,db){
	async.waterfall([
		function(callback){
			github.scanPush(user.github.access_token,push,function(err,filesWithKeys){
				callback(err,filesWithKeys)
			})
		},
		function(filesWithKeys,callback){
			pushScans.create(user._id.toString(),push,filesWithKeys,db,function(err,pushScan){
				callback(err,filesWithKeys,pushScan)
			})
		},
		function(filesWithKeys,pushScan,callback){
			if(!filesWithKeys){
				callback()
			}else if(filesWithKeys.length == 0){
				callback()
			}else{
				// TBD notify user
				console.log('need to notify user about files with keys: %s',util.inspect(filesWithKeys,{depth:8}))

				mailer.sendMulti(
					[user], //recipients
					'[' + config.get('app.name') + '] Possible private key committed alert',
					alertTemplate,
					{
						push_scan: pushScan
					},
					'alert',
					function(err){
						callback(err)
					}

				);

			}
		}
	],function(err){
		if(err){
			console.log('error processing push: %s',err)
		}else{
			console.log('push processed succerssfully')
		}
	})

}

module.exports = router;
