module.exports = {
  getPrice: function(membersCount,repo){
    var ret;
    if(membersCount <= 10){
      ret = repo.pricing.team.price;
    }else if(membersCount <= 50){
      ret = repo.pricing.business.price;
    }else{
      ret = repo.pricing.enterprise.price;
    }
    return ret;
  },
  getPaypalID: function(membersCount,repo){
    var ret;
    if(membersCount <= 10){
      ret = repo.pricing.team.paypal_id;
    }else if(membersCount <= 50){
      ret = repo.pricing.business.paypal_id;
    }else{
      ret = repo.pricing.enterprise.paypal_id;
    }
    return ret;
  },
  getPlan: function(membersCount){
    var ret;
    if(membersCount <= 10){
      ret = 'team';
    }else if(membersCount <= 50){
      ret = 'business';
    }else{
      ret = 'enterprise';
    }
    return ret;
  }
}
