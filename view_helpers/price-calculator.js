module.exports = {
  calc: function(membersCount,repo){
    var ret;
    if(membersCount <= 10){
      ret = repo.pricing.team.price;
    }else if(membersCount <= 50){
      ret = repo.pricing.business.price;
    }else{
      ret = repo.pricing.enterprise.price;
    }
    return ret;
  }
}
