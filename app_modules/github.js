var config = require('config');
var request = require('request');
var _ = require('underscore');
var async = require('async');
var parseLinkHeader = require('parse-link-header');
var util = require('util');
// var simpleGit = require('simple-git')()
var url = require('url');
var atob = require('atob');
var btoa = require('btoa');
var fs = require('fs')
var path = require('path')

var slaTemplate = fs.readFileSync(path.join(__dirname,'../views/sla-template.md'), 'utf8');
console.log('sla template is %s',slaTemplate)

module.exports = {
	getAPIHeaders: function(accessToken){
		return {
			Authorization: 'token ' + accessToken,
			Accept: 'application/vnd.github.v3+json',
			'User-Agent': config.get('app.name')
		};
	},
	getUser: function(accessToken,callback){
		var headers = this.getAPIHeaders(accessToken);
		// console.log('headers are %s',util.inspect(headers))
		request('https://api.github.com/user',{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				// console.log('error in getUser')
				callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
			}else{
				var data = JSON.parse(body);
				callback(null,data)
			}
		})
	},
	getUserEmail: function(accessToken,callback){
		var headers = this.getAPIHeaders(accessToken);
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
				callback(null,email);
			}
		});
	},
	getUserOrgs: function(accessToken,callback){
		var headers = this.getAPIHeaders(accessToken);
		var orgs = [];
		var page = 1;
		var linkHeader;

		async.whilst(
			function(){
				return page;
			},
			function(callback){
				var qs = {
					page: page
				}
				request('https://api.github.com/user/orgs',{headers: headers, qs: qs},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
					}else{
						var data = JSON.parse(body)
						orgs = orgs.concat(data);
						linkHeader = parseLinkHeader(response.headers.link);
						page = (linkHeader? ('next' in linkHeader ? linkHeader.next.page : false) : false);
						callback(null,orgs);
					}
				});
			},
			function(err,orgs){
				callback(err,orgs)
			}
		);

	},
	getOrgRepos: function(accessToken,orgName,callback){
		// console.log('getting org repos for %s',orgName)
		var headers = this.getAPIHeaders(accessToken);
		var repos = [];
		var page = 1;
		var linkHeader;

		async.whilst(
			function(){
				return page;
			},
			function(callback){
				var qs = {
					page: page
				}
				request('https://api.github.com/orgs/' + orgName + '/repos',{headers: headers, qs: qs},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
					}else{
						var data = JSON.parse(body)
						repos = repos.concat(data);
						linkHeader = parseLinkHeader(response.headers.link);
						page = (linkHeader? ('next' in linkHeader ? linkHeader.next.page : false) : false);
						callback(null,repos);
					}
				});
			},
			function(err,repos){
				callback(err,repos)
			}
		);

	},
	getUserRepos: function(accessToken,callback){
		var headers = this.getAPIHeaders(accessToken);
		var repos = [];
		var page = 1;
		var linkHeader;

		async.whilst(
			function(){
				return page;
			},
			function(callback){
				var qs = {
					page: page,
					type: 'owner'
				}
				request('https://api.github.com/user/repos',{headers: headers, qs: qs},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
					}else{
						var data = JSON.parse(body)
						repos = repos.concat(data);
						linkHeader = parseLinkHeader(response.headers.link);
						page = (linkHeader? ('next' in linkHeader ? linkHeader.next.page : false) : false);
						callback(null,repos);
					}
				});
			},
			function(err,repos){
				callback(err,repos)
			}
		);

	},
	hookRepo: function(accessToken,repoFullName,callback){
		var headers = this.getAPIHeaders(accessToken);

		var form = {
			"name": "web",
			"active": true,
			"events": ["pull_request","issue_comment","issues"],
			"config": {
				"url": "https://" + config.get('github.webhook_domain') + "/github/repo-webhook",
				"content_type": "json",
				"secret": config.get('github.hook_secret')
			}
		};
		request.post('https://api.github.com/repos/' + repoFullName + '/hooks',{headers: headers, body: JSON.stringify(form)},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				var hook = JSON.parse(body);
				callback(null,hook);
			}
		});
	},

	unhookRepo: function(accessToken,repoFullName,hookID,callback){
		var headers = this.getAPIHeaders(accessToken);
		request.del('https://api.github.com/repos/' + repoFullName + '/hooks/' + hookID,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null);
			}
		})
	},

	getRepo: function(accessToken,fullName,callback){
		var headers = this.getAPIHeaders(accessToken);
		request('https://api.github.com/repos/' + fullName,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null,JSON.parse(body));
			}
		})

	},

	labelIssue: function(accessToken,repoFullName,issueNumber,callback){
		var headers = this.getAPIHeaders(accessToken);

		var labels = [config.get('github.label.name')];
		var url = util.format('https://api.github.com/repos/%s/issues/%s/labels',repoFullName,issueNumber)
		request.post(url,{headers: headers, body: JSON.stringify(labels)},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				var label = JSON.parse(body);
				callback(null,label);
			}
		});

	},

	createLabel: function(accessToken,repoFullName,callback){
		var headers = this.getAPIHeaders(accessToken);

		var form = {
				name: config.get('github.label.name'),
				color: config.get('github.label.color'),
		};
		var url = util.format('https://api.github.com/repos/%s/labels',repoFullName)
		request.post(url,{headers: headers, body: JSON.stringify(form)},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null,JSON.parse(body));
			}
		});

	},

	removeLabel: function(accessToken,repoFullName,callback){
		var headers = this.getAPIHeaders(accessToken);

		var url = util.format('https://api.github.com/repos/%s/labels/%s',repoFullName,config.get('github.label.name'))
		request.del(url,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null);
			}
		});

	},

	addSLA: function(accessToken,repoFullName,callback){
		var headers = this.getAPIHeaders(accessToken);
console.log('slaTemplate is %s',slaTemplate)
		var form = {
			path: 'SLA.md',
			message: util.format('added %s SLA',config.get('app.name')),
			content: btoa(slaTemplate),
		}
console.log('form is %s',util.inspect(form))
		var url = util.format('https://api.github.com/repos/%s/contents/%s',repoFullName,'SLA.md');
		request.put(url,{headers: headers, body: JSON.stringify(form)},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				var data = JSON.parse(body);
console.log('SLA is %s',util.inspect(data))
				callback(null,data);
			}
		});
	},

	addBadge: function(accessToken,repoFullName,price,callback){
		var headers = this.getAPIHeaders(accessToken);
		async.waterfall([
			// get the readme
			function(callback){
				var url = util.format('https://api.github.com/repos/%s/readme',repoFullName);
				request(url,{headers: headers},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + body);
					}else{
						callback(null,JSON.parse(body));
					}
				});
			},
			// add our badge
			function(readme,callback){
				var text = atob(readme.content);
				text = util.format('[![%s](https://img.shields.io/badge/Enterprise%20Support%20Available-%24%s%2Fm-green.svg)](%s://%s/subscribe/%s)\n',config.get('app.name'),price,config.get('app.protocol'),config.get('app.domain'),repoFullName) + text;
				var form = {
					path: readme.path,
					message: util.format('added %s badge',config.get('app.name')),
					content: btoa(text),
					sha: readme.sha
				}
				var url = util.format('https://api.github.com/repos/%s/contents/%s',repoFullName,readme.path);
				request.put(url,{headers: headers, body: JSON.stringify(form)},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + body);
					}else{
						callback(null,JSON.parse(body));
					}
				});
			}
		],function(err){
			callback(err)
		})
	},
	isOrgMember: function(accessToken,org,login,callback){
		var headers = this.getAPIHeaders(accessToken);
		var url = util.format('https://api.github.com/orgs/%s/members/%s',org,login);
		request(url,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode != 404 && response.statusCode != 204){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null,response.statusCode == 204);
			}
		});
	},
	getUserOrgs: function(accessToken,callback){
		var headers = this.getAPIHeaders(accessToken);
// 		var thisObject = this;
// 		async.waterfall([
// 			function(callback){
// 				thisObject.getUser(accessToken,function(err,user){
// 					callback(err,user)
// 				})
// 			},
// 			function(user,callback){
// 				var url = util.format('https://api.github.com/users/%s/orgs',user.login)
// 				request(url,{headers: headers},function(error,response,body){
// 					if(error){
// 						callback(error);
// 					}else if(response.statusCode > 300){
// 						callback(response.statusCode + ' : ' + body);
// 					}else{
// 						callback(null,JSON.parse(body));
// 					}
// 				});
// 			}
// 		],function(err,orgs){
// console.log()
// 			callback(err,orgs)
// 		})

		request('https://api.github.com/user/orgs',{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null,JSON.parse(body));
			}
		});
	},
	getSLA: function(accessToken,repoFullName,callback){
		var headers = this.getAPIHeaders(accessToken);
		var url = util.format('https://api.github.com/repos/%s/contents/SLA.md',repoFullName);
		request(url,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				callback(response.statusCode + ' : ' + body);
			}else{
				callback(null,JSON.parse(body));
			}
		});
	}



}
