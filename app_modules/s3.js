var request = require('request')
var util = require('util')
var config = require('config')
var async = require('async')

var AWS = require('aws-sdk');
AWS.config.update({
	accessKeyId: config.get('aws.access_key_id'),
	secretAccessKey: config.get('aws.secret_access_key')
});

var s3 = new AWS.S3();
module.exports = {
  isExist: function(key,callback){
    s3.headObject({
      Bucket: config.get('aws.svg_bucket'),
      Key: key
    },function(err,data){
      if(err){
        if(err.code === 'NotFound'){
          callback(null,false)
        }else{
          callback(err)
        }
      }else{
        callback(null,true)
      }
    })
  },
  putObjectFromUrl: function(key,url,callback){

    async.waterfall([
      function(callback){
        var options = {
          uri: url,
          encoding: null
        };
        request(options, function(error, response, body) {
          if(error){
            callback(error);
          }else if(response.statusCode >= 300){
            callback(response.statusCode + ' : ' + body);
          }else{
            callback(null,body)
          }
        })
      },
      function(body,callback){
        s3.putObject({
            Body: body,
            Key: key,
            Bucket: config.get('aws.svg_bucket'),
            ContentType: 'image/svg+xml',
            ACL: 'public-read'
        },function(err,object){
          callback(err,object)
        })
      }
    ],function(err,object){
      callback(err,object)
    })
  },
	getBadgeUrl: function(price,callback){
		var thisObject = this;
		var badgeUrl = util.format('https://s3.amazonaws.com/%s/%s.svg',config.get('aws.svg_bucket'),price) // needs bucket and price
		var shieldsUrl = util.format('https://img.shields.io/badge/Enterprise%20Support%20Available-starting%20at%20%24%s%2Fm-green.svg',price)
		var key = util.format('%s.svg',price)
		async.waterfall([
			function(callback){
				thisObject.isExist(key,function(err,isExist){
					callback(err,isExist)
				})
			},
			function(isExist,callback){
				if(isExist){
					callback(null)
				}else{
					thisObject.putObjectFromUrl(key,shieldsUrl,function(err){
						callback(err)
					})
				}
			}
		],function(err){
			callback(err,badgeUrl)
		})
	}
}
