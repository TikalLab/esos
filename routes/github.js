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
var mailer = require('../app_modules/mailer');

var repos = require('../models/repos');
var subscriptions = require('../models/subscriptions');
var users = require('../models/users');


var developerEmailTemplate = fs.readFileSync(path.join(__dirname,'../views/emails/developer.ejs'), 'utf8');
var clientEmailTemplate = fs.readFileSync(path.join(__dirname,'../views/emails/client.ejs'), 'utf8');


router.get('/authorize-developer',function(req,res,next){
	req.session.afterGithubRedirectTo = req.query.next;
	var redirect = {
		protocol: 'https',
		host: 'github.com',
		pathname: '/login/oauth/authorize',
		query: {
			client_id: config.get('github.client_id'),
			redirect_uri: 'http://' + config.get('github.redirect_domain') + '/github/authorized',
			scope: 'user:email,admin:repo_hook,public_repo'

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
			scope: 'user:email,read:org'
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
				users.get(req.db,repo.user_id,function(err,developer){
					callback(err,repo,developer)
				})
			},
			function(repo,developer,callback){
				subscriptions.getByGithubLoginAndRepoID(req.db,req.body.sender.login,repo._id.toString(),function(err,subscription){
					callback(err,repo,developer,subscription)
				})
			},
			function(repo,developer,subscription,callback){
				if(subscription){
					callback(null,repo,developer,subscription)
				}else{
					getUserOrgSubscription(req.db,req.body.sender.login,repo,function(err,subscription){
						callback(null,repo,developer,subscription)
					})
				}
			},
			function(repo,developer,subscription,callback){
				if(!subscription){
					callback(null,repo,developer,subscription,null)
				}else{
					users.get(req.db,subscription.user_id,function(err,client){
						callback(err,repo,developer,subscription,client)
					})
				}
			},
		],function(err,repo,developer,subscription,client){
			if(err){
				console.log('err in processing hook: %s',err)
			}else{
				if(subscription){
					switch(req.headers['x-github-event']){
					case 'pull_request':
						if(req.body.action == 'opened'){
							console.log('this is a pull request!');
							processPullRequest(developer,client,req.body);
						}else{
							console.log('his is a pull request event but action is not "opened"')
						}
						break;
					case 'issue_comment':
						if(req.body.action == 'created'){
							console.log('this is a issue_comment!');
							processIssueComment(developer,client,req.body);
						}else{
							console.log('his is a issue_comment event but action is not "created"')
						}
						break;
					case 'issues':
						if(req.body.action == 'opened'){
							console.log('this is a issues!');
							processIssue(developer,client,req.body);
						}else{
							console.log('his is a issues event but action is not "opened"')
						}
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

function getUserOrgSubscription(db,login,repo,callback){
	async.waterfall([
		function(callback){
			subscriptions.getRepoOrgSubscriptions(db,repo._id.toString(),function(err,repoOrgSubscriptions){
				callback(err,repoOrgSubscriptions)
			})
		},
		function(repoOrgSubscriptions,callback){
			async.detect(repoOrgSubscriptions,function(repoOrgSubscription,callback){
				async.waterfall([
					function(callback){
						users.get(db,repoOrgSubscription.user_id,function(err,user){
							callback(err,user)
						})
					},
					function(user,callback){
						github.isOrgMember(user.github.access_token,repoOrgSubscription.org,login,function(err,isOrgMember){
							callback(err,isOrgMember)
						})
					}
				],function(err,isOrgMember){
					callback(err,isOrgMember)
				})
			},function(err,subscription){
				callback(err,subscription)
			})
		}
	],function(err,subscription){
		callback(err,subscription)
	})
}


function processIssue(developer,client,event){

	async.waterfall([
		function(callback){
			github.labelIssue(developer.github.access_token,event.repository.full_name,event.issue.number,function(err,label){
				callback(err)
			})
		},
		function(callback){
			// notify developer
			mailer.sendMulti(
				[developer], //recipients
				'[' + config.get('app.name') + '] A new issue that requires your attention',
				developerEmailTemplate,
				{
					event_type: 'issue',
					repo: event.repository.full_name,
					event_url: event.issue.html_url
				},
				'developer-alert-issue',
				function(err){
					callback(err)
				}

			);
		},
		function(callback){
			// notify client
			mailer.sendMulti(
				[client], //recipients
				'[' + config.get('app.name') + '] Acknowleding a new issue on ' + event.repository.full_name,
				clientEmailTemplate,
				{
					event_type: 'issue',
					repo: event.repository.full_name,
					event_url: event.issue.html_url
				},
				'client-acknowledge-issue',
				function(err){
					callback(err)
				}

			);
		}

	],function(err){
		if(err){
			console.log('err in processIssue: %s',err)
		}
	})


}

function processIssueComment(developer,client,event){
	async.waterfall([
		function(callback){
			github.labelIssue(developer.github.access_token,event.repository.full_name,event.issue.number,function(err,label){
				callback(err)
			})
		},
		function(callback){
			// notify developer
			mailer.sendMulti(
				[developer], //recipients
				'[' + config.get('app.name') + '] A new issue comment that requires your attention',
				developerEmailTemplate,
				{
					event_type: 'issue comment',
					repo: event.repository.full_name,
					event_url: event.comment.html_url
				},
				'developer-alert-issue-comment',
				function(err){
					callback(err)
				}

			);
		},
		function(callback){
			// notify client
			mailer.sendMulti(
				[client], //recipients
				'[' + config.get('app.name') + '] Acknowleding a new issue comment on ' + event.repository.full_name,
				clientEmailTemplate,
				{
					event_type: 'issue comment',
					repo: event.repository.full_name,
					event_url: event.comment.html_url
				},
				'client-acknowledge-issue-comment',
				function(err){
					callback(err)
				}

			);
		}

	],function(err){
		if(err){
			console.log('err in processIssueComment: %s',err)
		}
	})


}

function processPullRequest(developer,client,event){
	async.waterfall([
		function(callback){
			github.labelIssue(developer.github.access_token,event.repository.full_name,event.pull_request.number,function(err,label){
				callback(err)
			})
		},
		function(callback){
			// notify developer
			mailer.sendMulti(
				[developer], //recipients
				'[' + config.get('app.name') + '] A new pull request that requires your attention',
				developerEmailTemplate,
				{
					event_type: 'pull request',
					repo: event.repository.full_name,
					event_url: event.pull_request.html_url
				},
				'developer-alert-pull-request',
				function(err){
					callback(err)
				}

			);
		},
		function(callback){
			// notify client
			mailer.sendMulti(
				[client], //recipients
				'[' + config.get('app.name') + '] Acknowleding a new pull request on ' + event.repository.full_name,
				clientEmailTemplate,
				{
					event_type: 'pull request',
					repo: event.repository.full_name,
					event_url: event.pull_request.html_url
				},
				'client-acknowledge-pull-request',
				function(err){
					callback(err)
				}

			);
		}

	],function(err){
		if(err){
			console.log('err in processIssueComment: %s',err)
		}
	})


}

module.exports = router;
