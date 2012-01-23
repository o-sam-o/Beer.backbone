$(function(){

  var API_KEY = "ef9ad4ef689af505cde45ec1dc31120f";
  var BASE_FLICKR_URL = "http://api.flickr.com/services/rest/?"

  window.Photo = Backbone.Model.extend({

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
      this.set({
        details_loaded: true,
        description: response.photo.description._content,
        taken: new Date(response.photo.dates.taken)
      });

      if (response.photo.location) {
        var raw_loc = response.photo.location;
        this.set({
          location: raw_loc.locality._content + ", " + raw_loc.country._content,
          latitude: raw_loc.latitude,
          longitude: raw_loc.longitude
        });
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
    }

  });

  window.PhotoSet = Backbone.Collection.extend({
    model: Photo,

    initialize: function() {
      this._meta = {
         sortBy: 'date',
         sortOrder: 'desc'
      };

      this.setComparator(this.meta('sortBy'), this.meta('sortOrder'));
    },

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

    meta: function(prop, value) {
        if (value === undefined) {
            return this._meta[prop]
        } else {
            this._meta[prop] = value;
        }
    },

    parse: function(response){
      return response.photoset.photo;
    },

    comparatorConfigurable: function(photo, sortField, sortOrder){
      if (sortField == 'date'){
        var sortValue = Date.parse(photo.get('datetaken'))*1000;
      } else if(sortField == 'alpha') {
        var sortValue = $.trim(photo.get("title").toLowerCase());
      }else{
        throw "Unknown sort field " + sortField;
      }


      if (sortOrder === 'asc') {
        return sortValue;
      } else {
        if (typeof sortValue === 'string'){
          return String.fromCharCode.apply(String,
              _.map(sortValue.split(""), function (c) {
                  return 0xffff - c.charCodeAt();
              })
          );
        }else{
          return -sortValue;
        }
      }
    },


    setComparator: function(sortField, sortOrder) {
      console.log("Setting sort order " + sortField + " " + sortOrder);
      var collection = this;
      this.comparator = function(photo) {
        return collection.comparatorConfigurable(photo, sortField, sortOrder);
      };
    },

    setSortBy: function(sortBy){
      this.meta('sortBy', sortBy);
      this.setComparator(this.meta('sortBy'), this.meta('sortOrder'));
      this.sort();
    }

  });

  window.Photos = new PhotoSet();

  window.PhotoModalView = Backbone.View.extend({
    el: $("#show-photo-modal"),

    photoModelBodyTemplate: _.template($('#show-photo-modal-body-template').html()),

    initialize: function(photo){
      this.photo = photo;
    },

    render: function(){
      this.$('.modal-body').html(this.photoModelBodyTemplate({ 'photo':this.photo }));
      this.$('.modal-body .tabs').pills();
      this.$('h3').html(this.photo.get('title'));
      this.$('#show-photo-modal-f-button').attr('href',
            'http://www.flickr.com/photos/cavenagh/' + this.photo.get('id'));

      if (this.photo.get('latitude')) { 
        var myLatlng = new google.maps.LatLng(this.photo.get('latitude'), this.photo.get('longitude'));
        var myOptions = {
          zoom: 5,
          center: myLatlng,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        var map = new google.maps.Map(document.getElementById(this.photo.get('id') + "-map-container"), myOptions);

        var marker = new google.maps.Marker({
          position: myLatlng,
          title:"Collected"
        });
        marker.setMap(map);

        //Map seems to bug out when inited in a tab
        this.$('.modal-body .tabs').bind('change', function(e){
          if($(e.target).attr('href') == '#map-tab'){
            google.maps.event.trigger(map, 'resize');
            map.setZoom( map.getZoom() );
            map.setCenter(myLatlng);
          }
        });
      }

      $('#show-photo-modal').modal('show');
    }

  });

  window.PhotoPopoverView = Backbone.View.extend({

    photoPopoverTemplate: _.template($('#photo-popover-content').html()),
    spinnerTemplate: _.template($('#spinner-template').html()),

    initialize: function(photo){
      this.photo = photo;
    },

    render: function(){
      var photoPopoverTemplate = this.photoPopoverTemplate;
      var photo = this.photo;
      if(photo.get('details_loaded')){
        return photoPopoverTemplate({ 'photo': photo });
      }

      console.log("Loading " + photo.id + " details");
      photo.fetch({
        success: function(){
          $('#spinner' + photo.id).replaceWith(photoPopoverTemplate({ 'photo': photo }));
        }
      });

      return this.spinnerTemplate({ 'spinnerId': 'spinner' + photo.id })
    }
  });

  window.PhotoWallView = Backbone.View.extend({

    el: $("#gateway-content"),

    initialize: function() {
      console.log("Init PhotoWall View");
      Photos.bind('reset', this.render, this);
      Photos.fetch();
    },

    events: {
      "click a[rel='photoPopover']": "photoClick"
    },

    render: function() {
      console.log("Render PhotoWall View");
      var template = _.template($('#photo-gateway-template').html());
      // FIXME change this to construct all HTML and then swap it out
      this.$('#gateway-photos').html('');
      Photos.each(function(photo, index){
        this.$('#gateway-photos').append(template({
          photo: photo,
          index: index
        }));
      });

      $('#bottle-count').html(Photos.size());

      // Add popover to photos
      // TODO try to configure this with events
      this.$("a[rel=photoPopover]")
        .popover({
          offset: 10,
          html: true,
          content: function() {
            var photo = Photos.get($(this).data('photo-id'));
            var popoverView = new PhotoPopoverView(photo);
            return popoverView.render();
          }
      });

      return this;
    },

    photoClick: function(e) {
        e.preventDefault();

        var photo = Photos.get($(e.currentTarget).data('photo-id'));
        var modalView = new PhotoModalView(photo);
        modalView.render();
    }

  });

  window.GatewayView = Backbone.View.extend({

    el: $("#backbone-beer-app"),

    initialize: function() {
      this.photoWall = new PhotoWallView;
      this.render();
    },

    render: function() {
      console.log("Render Gateway View");

      $('.topbar').dropdown();

      this.updateSortMenu();

      $('#show-photo-modal').modal({
        keyboard: true,
        backdrop: true
      });

      $('#about-modal').modal({
        keyboard: true,
        backdrop: true
      });
    },

    updateSortMenu: function() {
      console.log("Update sort order");
      $('#sort-order-menu-title').html(this.sortOrderByDescription());
      var reverseSortBy = Photos.meta('sortOrder') === 'asc' ? 'desc' : 'asc';
      $('#sort-order-menu-order-item').attr('href', '#sort/' + Photos.meta('sortBy') + '/' + reverseSortBy);
    },

    sortOrderByDescription: function(){
      return $("a[data-sort-order='" + Photos.meta('sortBy') + "']").html();
    }

  });

  window.App = new GatewayView;

  var BeerRouter = Backbone.Router.extend({

    routes: {
      "sort/:sortBy/:sortOrder": "sort"
    },

    sort: function(sortBy, sortOrder) {
      Photos.meta('sortOrder', sortOrder);
      Photos.setSortBy(sortBy);
      App.updateSortMenu();
    }

  });

  var appRouter = new BeerRouter;
  Backbone.history.start();

});
