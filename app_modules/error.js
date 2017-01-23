module.exports = {
	error: function(req,res,next,error){
		console.log('ERROR in %s: %s',req.originalUrl,error)
		res.render('err',{error: error});
	}
}
