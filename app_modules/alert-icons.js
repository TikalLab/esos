module.exports = {
	getIcon: function(type){
		var ret;
		switch(type){
		case 'danger':
			ret = 'icon-cancel-circle';
			break;
		case 'success':
			ret = 'icon-checkmark-circle';
			break;
		case 'warning':
			ret = 'icon-warning';
			break;
		case 'info':
			ret = 'icon-info';
			break;
		}
		return ret;
	}	
}