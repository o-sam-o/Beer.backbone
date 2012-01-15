$(function(){

  var API_KEY = "ef9ad4ef689af505cde45ec1dc31120f";
  var BASE_FLICKR_URL = "http://api.flickr.com/services/rest/?"

  window.Photo = Backbone.Model.extend({

    photoPopoverTemplate: _.template($('#photo-popover-content').html()),
    spinnerTemplate: _.template($('#spinner-template').html()),
    photoModelBodyTemplate: _.template($('#show-photo-modal-body-template').html()),

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
    },

    //FIXME this is view code and shouldnt be in a model
    setupPhotoModal: function(){
      $('#show-photo-modal .modal-body').html(this.photoModelBodyTemplate({ 'photo':this }));
      $('#show-photo-modal .modal-body .tabs').pills();
      $('#show-photo-modal h3').html(this.get('title'));
      $('#show-photo-modal-f-button').attr('href',
            'http://www.flickr.com/photos/cavenagh/' + this.get('id'));

      if (this.get('latitude')) { 
        var myLatlng = new google.maps.LatLng(this.get('latitude'), this.get('longitude'));
        var myOptions = {
          zoom: 5,
          center: myLatlng,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        var map = new google.maps.Map(document.getElementById(this.get('id') + "-map-container"), myOptions);

        var marker = new google.maps.Marker({
          position: myLatlng,
          title:"Collected"
        });
        marker.setMap(map);

        //Map seems to bug out when inited in a tab
        $('#show-photo-modal .modal-body .tabs').bind('change', function(e){
          if($(e.target).attr('href') == '#map-tab'){
            google.maps.event.trigger(map, 'resize');
            map.setZoom( map.getZoom() );
            map.setCenter(myLatlng);
          }
        });
      }
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

    //Source: http://stackoverflow.com/questions/5930656/setting-attributes-on-a-collection-backbone-js
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
        return -sortValue;
      }
    },


    setComparator: function(sortField, sortOrder) {
      console.log("Setting sort order " + sortField + " " + sortOrder);
      var collection = this;
      this.comparator = function(photo) {
        return collection.comparatorConfigurable(photo, sortField, sortOrder);
      };
    },

    refreshSort: function() {
      this.setComparator(this.meta('sortBy'), this.meta('sortOrder'));
      this.sort();
    },

    toggleSortOrder: function(){
      this.meta('sortOrder', this.meta('sortOrder') === 'asc' ? 'desc' : 'asc');
      this.refreshSort();
    },

    setSortBy: function(sortBy){
      if(this.meta('sortBy') === sortBy){
        this.toggleSortOrder();
        return;
      }

      if(sortBy === 'date'){
        this.meta('sortOrder', 'desc');
      } else {
        this.meta('sortOrder', 'asc');
      }

      this.meta('sortBy', sortBy);
      this.refreshSort();
    }

  });

  window.Photos = new PhotoSet();

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

      // Add popover to photos
      // TODO try to configure this with events
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
    },

    photoClick: function(e) {
        e.preventDefault();

        var photo = Photos.get($(e.currentTarget).data('photo-id'));
        photo.setupPhotoModal();
        $('#show-photo-modal').modal('show');
    }

  });

  window.GatewayView = Backbone.View.extend({

    el: $("#backbone-beer-app"),

    initialize: function() {
      this.photoWall = new PhotoWallView;
      this.render();
    },

    events: {
      "click #sort-order-menu-order-item": "handleOrderMenuClick",
      "click .sort-order-menu-item": "handleSortMenuClick"
    },

    render: function() {
      console.log("Render Gateway View");

      $('.topbar').dropdown();

      $('#show-photo-modal').modal({
        keyboard: true,
        backdrop: true
      });

      $('#about-modal').modal({
        keyboard: true,
        backdrop: true
      });
    },

    handleOrderMenuClick: function(e) {
      e.preventDefault();
      window.Photos.toggleSortOrder();
    },

    handleSortMenuClick: function(e) {
      e.preventDefault();
      Photos.setSortBy($(e.currentTarget).data('sort-order'));
    }

  });

  window.App = new GatewayView;

});
