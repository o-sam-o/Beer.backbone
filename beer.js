$(function(){

  var API_KEY = "ef9ad4ef689af505cde45ec1dc31120f";
  var BASE_FLICKR_URL = "http://api.flickr.com/services/rest/?"

  window.Photo = Backbone.Model.extend({

    photoPopoverTemplate: _.template($('#photo-popover-content').html()),
    spinnerTemplate: _.template($('#spinner-template').html()),

    url: function(){
      var params = {
        "method"         : 'flickr.photos.getInfo',
        "api_key"        : API_KEY,
        "photo_id"       : this.id,
        "format"         : 'json',
        "nojsoncallback" : 1
      }
      return _.reduce(
        params,
        function(url, value, key) { return url + key + '=' + value + '&' },
        BASE_FLICKR_URL
      );
    },

    parse: function(response) {
      this.set({details_loaded: true});
      this.attributes.description = response.photo.description._content;
      this.attributes.taken = new Date(response.photo.dates.taken);

      if (response.photo.location) {
        var raw_loc = response.photo.location;
        this.attributes.location = raw_loc.locality._content + " " + raw_loc.country._content;
      }

      // Based on naming convention of photo title
      if (this.get('title').match(/\-/)){
        var split_title = this.get('title').split(/\-/);
        this.set({
          brewer: split_title[0],
          beer_type: split_title[1]
        });
      }

      return this.attributes
    },

    popoverContents: function(){
      if(this.get('details_loaded')){
        return this.photoPopoverTemplate({ 'photo':this });
      }

      console.log("Loading " + this.id + " details");
      var photo = this;
      this.fetch({
        success: function(){
          $('#spinner' + photo.id).replaceWith(photo.popoverContents());
        }
      });

      return this.spinnerTemplate({ 'spinnerId': 'spinner' + this.id })
    }

  });

  window.PhotoSet = Backbone.Collection.extend({
    model: Photo,

    url: function(){
      var params = {
        "method"         : 'flickr.photosets.getPhotos',
        "api_key"        : API_KEY,
        "photoset_id"    : '72157625277593652',
        "extras"         : 'date_taken%2Curl_t%2Curl_m%2Curl_s%2Ctags',
        "format"         : 'json',
        "nojsoncallback" : 1
      }
      return _.reduce(
        params,
        function(url, value, key) { return url + key + '=' + value + '&' },
        BASE_FLICKR_URL
      );
    },

    parse: function(response){
      return response.photoset.photo;
    },

  });

  window.Photos = new PhotoSet();

  window.GatewayView = Backbone.View.extend({

    el: $("#backbone-beer-app"),

    initialize: function() {
      console.log("Init Gateway View");
      Photos.fetch({
        success: this.render
      });
    },

    render: function() {
      console.log("Render Gateway View");
      var template = _.template($('#photo-gateway-template').html());
      Photos.each(function(photo, index){
        this.$('#gateway-photos').append(template({
          photo: photo,
          index: index
        }));
      });

      // Add popover to photos
      this.$("a[rel=photoPopover]")
        .popover({
          offset: 10,
          html: true,
          content: function() {
            var photo = Photos.get($(this).data('photo-id'));
            return photo.popoverContents();
          }
      });

      return this;
    }

  });

  window.App = new GatewayView;

});
