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

var pushScans = require('../models/push-scans');

var alertTemplate = fs.readFileSync(path.join(__dirname,'../views/emails/alert.ejs'), 'utf8');

router.get('/authorize',function(req,res,next){
	req.session.afterGithubRedirectTo = req.query.next;
	var redirect = {
		protocol: 'https',
		host: 'github.com',
		pathname: '/login/oauth/authorize',
		query: {
			client_id: config.get('github.client_id'),
			redirect_uri: config.get('github.redirect_domain') + '/github/authorized',
			scope: 'user:email,write:repo_hook'

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
			var headers = github.getAPIHeaders(accessToken);
			request('https://api.github.com/user',{headers: headers},function(error,response,body){
				if(error){
					callback(error);
				}else if(response.statusCode > 300){
					callback(response.statusCode + ' : ' + body);
				}else{
					callback(null,accessToken,JSON.parse(body));
				}
			});
		},
		// get the email
		function(accessToken,githubUser,callback){
			var headers = github.getAPIHeaders(accessToken);
			request('https://api.github.com/user/emails',{headers: headers},function(error,response,body){
				if(error){
					callback(error);
				}else if(response.statusCode > 300){
					callback(response.statusCode + ' : ' + body);
				}else{
					var githubUserEmails = JSON.parse(body);
					var email = _.find(githubUserEmails,function(email){
						return email.primary;
					}).email;
					callback(null,accessToken,githubUser,email);
				}
			});
		},
		function(accessToken,githubUser,email,callback){
			var users = req.db.get('users');
			users.findAndModify({
				_id: req.session.user._id.toString()
			},{
				$set: {
					github: {
						access_token: accessToken
					},
					name: githubUser.name ? githubUser.name : githubUser.login,
					email: email
				}
			},{
				new: true
			},function(err,user){
				callback(err,user)
			})

		}
 	],function(err,user){
 		if(err){
 			errorHandler.error(req,res,next,err);
 		}else{
 			req.session.user = user;
			res.redirect('/')
 		}
 	});
})

router.post('/org-webhook',function(req, res, next) {
	console.log('received a ORG webhook notification from github!');
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
		// find the user that signed the organization and use their access_token
		var users = req.db.get('users');
		users.find({'hooks.orgs.org_name':{$in: [req.body.organization.login]}},function(err,docs){
			if(err){
				console.log('error finding an org-user match: %s',err);
			}else{
				if(docs.length > 0){
					var user = docs[0]; // the first user will do...
//					processHook(user,req.body);

					// what happened in github that caused us to receive this hook?
					console.log('headres are : %s',util.inspect(req.headers));
					switch(req.headers['x-github-event']){
					case 'push':
						console.log('this is a push!');
						processPush(user,req.body,req.db);
						break;
					default:
						console.log('header is : %s',req.headers['x-github-event']);
						break;
					}


				}else{
					console.log('find zero matches org-user!!!');
				}
			}
		})
	}



	res.sendStatus(200);

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
		// find the user that signed the organization and use their access_token
		var users = req.db.get('users');
		users.find({'hooks.repos.repo.owner': req.body.repository.owner.name,'hooks.repos.repo.name': req.body.repository.name},function(err,docs){
			if(err){
				console.log('error finding an repo-user match: %s',err);
			}else{
				if(docs.length > 0){
					var user = docs[0]; // the first user will do...
//					processHook(user,req.body);

					// what happened in github that caused us to receive this hook?
					console.log('headres are : %s',util.inspect(req.headers));
					switch(req.headers['x-github-event']){
					case 'push':
						console.log('this is a push!');
						processPush(user,req.body,req.db);
						break;
					default:
						console.log('header is : %s',req.headers['x-github-event']);
						break;
					}


				}else{
					console.log('find zero matches repo-user!!!');
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
