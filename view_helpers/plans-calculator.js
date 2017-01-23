module.exports = {
  getPrice: function(membersCount,repo){
    var ret;
    if(membersCount <= 10){
      ret = repo.plans.team.price;
    }else if(membersCount <= 50){
      ret = repo.plans.business.price;
    }else{
      ret = repo.plans.enterprise.price;
    }
    return ret;
  },
  getPaypalID: function(membersCount,repo){
    var ret;
    if(membersCount <= 10){
      ret = repo.plans.team.paypal_id;
    }else if(membersCount <= 50){
      ret = repo.plans.business.paypal_id;
    }else{
      ret = repo.plans.enterprise.paypal_id;
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
