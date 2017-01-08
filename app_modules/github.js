var config = require('config');
var request = require('request');
var _ = require('underscore');
var async = require('async');
var parseLinkHeader = require('parse-link-header');
var util = require('util');
var atob = require('atob')
// var simpleGit = require('simple-git')()
var fs = require('fs')
var fse = require('fs-extra')
var url = require('url');
var slug = require('slug')
var exec = require('child_process').exec;

var keysFinder = require('../app_modules/keys-finder')

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
	getRepoBranches: function(accessToken,repo,callback){
		// console.log('getting repo branches for %s',repo.full_name)
		var headers = this.getAPIHeaders(accessToken);
		var branches = [];
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
				request('https://api.github.com/repos/' + repo.full_name + '/branches',{headers: headers,qs: qs},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						// console.log('error in getRepoBranches for %s',repo.full_name)
						callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
					}else{
						var data = JSON.parse(body)
						branches = branches.concat(data);
						linkHeader = parseLinkHeader(response.headers.link);
						page = (linkHeader? ('next' in linkHeader ? linkHeader.next.page : false) : false);
						callback(null,branches);
					}
				});
			},
			function(err,branches){
				callback(err,branches)
			}
		);

	},
	scanRepo: function(accessToken,repo,callback){
		// console.log('scanning repo %s',repo.full_name)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getRepoBranches(accessToken,repo,function(err,branches){
					callback(err,branches)
				})
			},
			function(branches,callback){
				var results = [];
				async.each(branches,function(branch,callback){
					thisObject.scanBranch(accessToken,repo,branch,function(err,branchResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(branchResults)
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
			callback(err,results)
		})
	},
	startRepoScan: function(accessToken,user,repoOwner,repoName,callback){
		var headers = this.getAPIHeaders(accessToken);
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getUser(accessToken,function(err,user){
					callback(err,user)
				})
			},
			function(user,callback){
				var u = util.format('https://api.github.com/repos/%s/%s',repoOwner,repoName)
				request(u,{headers: headers},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						// console.log('error in getRepoBranches for %s',repo.full_name)
						callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
					}else{
						var repo = JSON.parse(body)
						callback(null,user,repo)
					}
				});
			}
		],function(err,user,repo){
			if(err){
				callback(err)
			}else{
				thisObject.scanRepoLocally(accessToken,user,repo,callback)
			}
		})


	},
	scanRepoLocally: function(accessToken,user,repo,callback){
		// console.log('scanning repo %s',repo.full_name)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getRepoBranches(accessToken,repo,function(err,branches){
					callback(err,branches)
				})
			},
			function(branches,callback){
				var results = [];
				async.eachLimit(branches,Number(config.get('app.async_limits.branches')),function(branch,callback){
					thisObject.scanBranchLocally(accessToken,user,repo,branch,function(err,branchResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(branchResults)
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
			callback(err,results)
		})
	},


	buildRepoScan: function(accessToken,repo,callback){
		// console.log('scanning repo %s',repo.full_name)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getRepoBranches(accessToken,repo,function(err,branches){
					callback(err,branches)
				})
			},
			function(branches,callback){
				var results = [];
				async.each(branches,function(branch,callback){
					thisObject.buildBranchScan(accessToken,repo,branch,function(err,branchResults){
						if(err){
							callback(err)
						}else{
							var extendedBranchResults = _.map(branchResults,function(result){
								result['repo'] = repo.full_name;
								result['branch'] = branch.name;
								return result;
							})
							results = results.concat(extendedBranchResults)
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
			callback(err,results)
		})
	},
	scanOrg: function(accessToken,orgName,callback){
		// console.log('scanning org %s',orgName)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getOrgRepos(accessToken,orgName,function(err,repos){
					callback(err,repos)
				})
			},
			function(repos,callback){
				var results = [];
				async.each(repos,function(repo,callback){
					thisObject.scanRepo(accessToken,repo,function(err,repoResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(repoResults);
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
			callback(err,results)
		})
	},

	scanOrgLocally: function(accessToken,orgName,callback){
		// console.log('scanning org %s locally',orgName)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getUser(accessToken,function(err,user){
					callback(err,user)
				})
			},
			function(user,callback){
				thisObject.getOrgRepos(accessToken,orgName,function(err,repos){
					_.each(repos,function(repo){
						// console.log('found repo: %s',repo.full_name)
					})
					callback(err,user,repos)
				})
			},
			function(user,repos,callback){
				var results = [];
				async.eachLimit(repos,Number(config.get('app.async_limits.repos')),function(repo,callback){
					thisObject.scanRepoLocally(accessToken,user,repo,function(err,repoResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(repoResults);
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
console.log('FINISHED scanning org locally!!!')
console.log('results count: %s',results.length)
			// callback(null,results)
			callback(err,results)
		})
	},
	scanAccountLocally: function(accessToken,callback){
		// console.log('scanning org %s locally',orgName)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getUser(accessToken,function(err,user){
					callback(err,user)
				})
			},
			function(user,callback){
				thisObject.getUserRepos(accessToken,function(err,repos){
					callback(err,user,repos)
				})
			},
			function(user,repos,callback){
				var results = [];
				async.eachLimit(repos,Number(config.get('app.async_limits.repos')),function(repo,callback){
					thisObject.scanRepoLocally(accessToken,user,repo,function(err,repoResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(repoResults);
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
console.log('FINISHED scanning account locally!!!')
console.log('results count: %s',results.length)
console.log('err is: %s',err)
			// callback(null,results)
			callback(err,results)
		})
	},

	buildOrgScan: function(accessToken,orgName,callback){
		// console.log('scanning org %s',orgName)
		var thisObject = this;
		async.waterfall([
			function(callback){
				thisObject.getOrgRepos(accessToken,orgName,function(err,repos){
					callback(err,repos)
				})
			},
			function(repos,callback){
				var results = [];
				async.each(repos,function(repo,callback){
					thisObject.buildRepoScan(accessToken,repo,function(err,repoResults){
						if(err){
							callback(err)
						}else{
							results = results.concat(repoResults);
							callback()
						}
					})
				},function(err){
					callback(err,results)
				})
			}
		],function(err,results){
			callback(err,results)
		})
	},
	getRepo: function(accessToken,repoName,callback){
		var headers = this.getAPIHeaders(accessToken)
		request('https://api.github.com/repos/' + repo,{headers: headers},function(error,response,body){
      if(error){
        callback(error);
      }else if(response.statusCode > 300){
        callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
      }else{
        var repo = JSON.parse(body)
        callback(null,repo);
      }
    });
	},
	getBranch: function(accessToken,repo,branchName,callback){
		// console.log('getting barnch %s:%s',repo.full_name,branchName)

		var headers = this.getAPIHeaders(accessToken)
		request('https://api.github.com/repos/' + repo.full_name + '/branches/' + branchName,{headers: headers},function(error,response,body){
      if(error){
        callback(error);
      }else if(response.statusCode > 300){
        callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
      }else{
        var branch = JSON.parse(body)
        callback(null,branch);
      }
    });
	},
	getTree: function(accessToken,repo,branch,callback){
		// console.log('getting tree for %s:%s',repo.full_name,branch.name)

	  var headers = this.getAPIHeaders(accessToken);

    var qs = {
      recursive: '1'
    }
    request('https://api.github.com/repos/' + repo.full_name + '/git/trees/' + branch.commit.sha,{headers: headers, qs: qs},function(error,response,body){
      if(error){
        callback(error);
      }else if(response.statusCode > 300){
        callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
      }else{
        var data = JSON.parse(body)
        callback(null,data.tree);
      }
    });

	},
	scanBranch: function(accessToken,repo,branch,callback){
		// console.log('scanning branch %s:%s',repo.full_name,branch.name)
		var thisObject = this;
		var headers = this.getAPIHeaders(accessToken);
		async.waterfall([
			function(callback){
				thisObject.getTree(accessToken,repo,branch,function(err,tree){
					callback(err,tree)
				})
			},
			function(tree,callback){
				var filesWithKeys = [];
				async.each(tree,function(item,callback){
					request(item.url,{headers: headers},function(error,response,body){
		        if(error){
		          callback(error);
		        }else if(response.statusCode > 300){
		          callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
		        }else{
		          var data = JSON.parse(body);
		// // console.log('data is %s',util.inspect(data))
		          if('content' in data){
		            var content = atob(data.content)
								var matches = keysFinder.find(content);
								if(matches){
									// console.log('scan result for %s:%s:%s: affected',repo.full_name,branch.name,item.path)
									filesWithKeys.push({
										repo: repo,
										branch: branch,
										file: item,
										matches: matches
									})
								}else{
									// console.log('scan result for %s:%s:%s: not affected',repo.full_name,branch.name,item.path)
								}
		          }
		          callback()
		        }
		      })
				},function(err){
					callback(err,filesWithKeys)
				})
			}
		],function(err,results){
			callback(err,results)
		})

	},

	scanBranchLocally: function(accessToken,user,repo,branch,callback){
		// console.log('scanning branch %s:%s locally',repo.full_name,branch.name)
		var thisObject = this;
		var dir = '/tmp/' + repo.owner.login + '-' + repo.name + '-' + slug(branch.name);
// console.log('dir is %s',dir)
		var parsedUrl = url.parse(repo.clone_url);
		parsedUrl.auth = user.login + ':' + accessToken;
		var cloneUrl = url.format(parsedUrl);
// console.log('url is %s',cloneUrl)

		// var simpleGit = require('simple-git')(dir);

		// TBD
		// remoce the *
		// exclude .git
		// var grepCommand = util.format("grep -rE '[0-9a-f]{40}' %s/*",dir);
		// var grepCommand = util.format("grep -rE '[a-zA-Z0-9]{16,}' %s/*",dir);
		var grepCommand = util.format("grep -rE '[a-zA-Z0-9]{16,}' %s/*",dir);

		async.waterfall([
			// create a dir specifically for this branch
			function(callback){
				fs.mkdir(dir,function(err){
					callback(err)
				})
			},
			// clone the git
			function(callback){
				var simpleGit = require('simple-git')(dir);
				simpleGit.clone(cloneUrl,dir,function(err){
					callback(err)
				})
			},
			// do a "fetch" (whatever thats good for...)
			function(callback){
				var simpleGit = require('simple-git')(dir);
				simpleGit.fetch(function(err){
					callback(err)
				})
			},
			// checkout the branch
			function(callback){
				var simpleGit = require('simple-git')(dir);
				simpleGit.checkout(branch.name,function(err){
					callback(err)
				})
			},
			// scan the branch
			function(callback){
				exec(grepCommand, function(err, stdin, stdout){
					if(err){
						// console.log('grep failed in %s/%s. err: %s',repo.full_name,branch.name,util.inspect(err))
						// console.log('grep command: %s',grepCommand)
						// console.log('grep failed stdin: %s',util.inspect(stdin))
						// console.log('grep failed stdout: %s',util.inspect(stdout))
						// callback(err)
						callback(null,[])
					}else{
						var lines = stdin.split('\n');
// console.log('grep result: %s',util.inspect(lines))
						var filesWithKeys = [];
						_.each(lines,function(line){
							if(line){
								var fileWithKeys = thisObject.processGrepLine(line);
								if(fileWithKeys.matches){
									fileWithKeys['repo'] = repo.full_name;
									fileWithKeys['branch'] = branch.name;
	console.log('new find: %s',util.inspect(fileWithKeys))
									filesWithKeys.push(fileWithKeys)

								}

							}
						})
						callback(null,filesWithKeys)
					}

				})
			},
			// cleanup
			function(filesWithKeys,callback){
				fse.remove(dir,function(err){
					callback(err,filesWithKeys)
				})
			}
		],function(err,results){
			if(err){
				console.log('errpr scanning local branch %s: %s',branch.name,err)
			}
			// callback(err,results)
			callback(null,results)
		})


	},


	buildBranchScan: function(accessToken,repo,branch,callback){
		// console.log('scanning branch %s:%s',repo.full_name,branch.name)
		var thisObject = this;
		var headers = this.getAPIHeaders(accessToken);
		async.waterfall([
			function(callback){
				thisObject.getTree(accessToken,repo,branch,function(err,tree){
					callback(err,tree)
				})
			},
		],function(err,results){
			callback(err,results)
		})

	},
	hookOrg: function(accessToken,orgName,callback){
		var headers = this.getAPIHeaders(accessToken);

		var form = {
			"name": "web",
			"active": true,
			"events": ["push"],
			"config": {
				"url": "https://" + config.get('github.webhook_domain') + "/github/org-webhook",
				"content_type": "json",
				"secret": config.get('github.hook_secret')
			}
		};
		request.post('https://api.github.com/orgs/' + orgName + '/hooks',{headers: headers, body: JSON.stringify(form)},function(error,response,body){
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
	hookRepo: function(accessToken,repoOwner,repoName,callback){
		var headers = this.getAPIHeaders(accessToken);

		var form = {
			"name": "web",
			"active": true,
			"events": ["push"],
			"config": {
				"url": "https://" + config.get('github.webhook_domain') + "/github/repo-webhook",
				"content_type": "json",
				"secret": config.get('github.hook_secret')
			}
		};
		request.post('https://api.github.com/repos/' + repoOwner + '/' + repoName + '/hooks',{headers: headers, body: JSON.stringify(form)},function(error,response,body){
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
	scanPush: function(accessToken,push,callback){
		var headers = this.getAPIHeaders(accessToken);
		var filesWithKeys =[];
		async.each(push.commits,function(commit,callback){
				var url = 'https://api.github.com/repos/' + push.repository.owner.name + '/' + push.repository.name + '/commits/' + commit.id;
				request(url,{headers: headers},function(error,response,body){
					if(error){
						callback(error);
					}else if(response.statusCode > 300){
						callback(response.statusCode + ' : ' + body);
					}else{
						var commit = JSON.parse(body);
						_.each(commit.files,function(file){
							var matches = keysFinder.find(file.patch);
							if(matches){
								var refParts = push.ref.split('/');
								var branchName = refParts[refParts.length -1]
								filesWithKeys.push({
									repo: push.repository.full_name,
									branch: branchName,
									file: file.filename,
									severity: matches.severity,
									matches: matches.matches
								})
							}
						})
						callback();
					}
				});
		},function(err){
			callback(err,filesWithKeys)
		})
	},
	scanItem: function(accessToken,item,callback){
		var headers = this.getAPIHeaders(accessToken);
		request(item.url,{headers: headers},function(error,response,body){
			if(error){
				callback(error);
			}else if(response.statusCode > 300){
				if(response.headers['x-ratelimit-remaining'] == '0'){
					callback('ratelimit');
				}else{
					callback(response.statusCode + ' : ' + arguments.callee.toString() + ' : ' + body);
				}
			}else{


				var data = JSON.parse(body);
// // console.log('data is %s',util.inspect(data))
				var matches;
				if('content' in data){
					var content = atob(data.content)
					matches = keysFinder.find(content);
				}
				callback(null,matches)
			}
		})
	},
	processGrepLine: function(line){
		// a line looks like:
		// '/tmp/pubsublab-tlvdemo-test/index.js:var s = \'c9a70467770469462ad05d88df987e1e0aefc750\';'
		var parts = line.split(':');
// console.log('parts are %s',util.inspect(parts))
		var filePart = parts[0];
		var codePart = parts[1] || '';

		var fileParts = filePart.split('/');
		fileParts = fileParts.slice(3);
		var file = fileParts.join('/');

		// var allMatches = codePart.match(/\b([a-zA-Z0-9]{16,})\b/g);
		// var highRiskMatches = codePart.match(/(secret|token|key).+\b([a-zA-Z0-9]{16,})\b/g);
		var allMatches = codePart.match(/\b(?=[a-zA-Z0-9]{12,}).*\d+.*\b/g);
		var highRiskMatches = codePart.match(/(secret|token|key).+\b(?=[a-zA-Z0-9]{12,}).*\d+.*\b/g);
		var lowRiskMatches = _.difference(highRiskMatches,allMatches);

		return {
			file: file,
			matches: allMatches,
			severity: highRiskMatches ? 'high' : 'low'
		}

	}


}
