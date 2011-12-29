$(function(){

  window.Photo = Backbone.Model.extend({

  });

  window.PhotoSet = Backbone.Collection.extend({
    model: Photo,

    url: function(){
      var params = {
        "method"         : "flickr.photosets.getPhotos",
        "api_key"        : 'ef9ad4ef689af505cde45ec1dc31120f',
        "photoset_id"    : '72157625277593652',
        "extras"         : 'date_taken%2Curl_t%2Curl_m%2Curl_s',
        "format"         : 'json',
        "nojsoncallback" : 1
      }
      return _.reduce(
        params,
        function(url, value, key) { return url + key + '=' + value + '&' },
        "http://api.flickr.com/services/rest/?"
      );
    },

    parse: function(response){
      return response.photoset.photo;
    }
  });

  window.Photos = new PhotoSet();

  window.GatewayView = Backbone.View.extend({

    el: $("#backbone-beer-app"),

    photoGatewayTemplate: _.template($('#photo-gateway-template').html()),

    initialize: function() {
      console.log("Init Gateway View");
      Photos.fetch({
        success: this.render
      });
    },

    render: function() {
      console.log("Render Gateway View");
      var template = _.template($('#photo-gateway-template').html());
      Photos.each(function(photo){
        this.$('#gateway-photos').append(template({
          photo: photo
        }));
      });

      return this;
    }

  });

  window.App = new GatewayView;

});
