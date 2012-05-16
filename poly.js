var map = null;
document.addEvent('domready', function(){
  var Cluster = new Class({
    initialize: function(){
      this.data = []
      this.cache = []
    },
    add: function(data) {
      var total = $('judgments').get('text').replace(/,/g, "").toInt()
      total += data.judgments
      $('judgments').set('text', total.withCommas())
      this.data.unshift($merge(data, {fresh: true}))
    },
    compute: function(lm){
      this.impact = $H({})
      lm.data = []
      //this.cache.each(function(c){ c.destroy() })
      var cut = this.data.length - 1000
      if(cut > 0)
        this.data.splice(-cut,cut)
      this.data = this.data.map(function(payload){
        var id = ("mark_" + payload.ll.join("_")).replace(/[^0-9a-z_]/g, '');
        if(this.impact[id]) {
          this.impact[id].size += 10
          this.impact[id].fresh = this.impact[id].fresh || payload.fresh
        } else {
          this.impact[id] = {size: 10, coords: {lon: payload.ll[1], lat: payload.ll[0]}, fresh: payload.fresh}
        }
        payload.fresh = false
        return payload
      }, this)
      this.impact.each(function(payload, key){
        lm.data.push(payload)
      }, this)
    }
  })
  var LiveMap = new Class({
    initialize: function(element, graph){
      this.element = $(element);
      this.graph = graph;
      this.clusterCache = {};
      this.data = []
      this.setupMap();
      this.setupPusher();
      this.cluster = new Cluster();
      this.zooms = {};
    },
    setupPusher: function(){
      this.pusher = new Pusher('516d64731396194603ba');
      this.channel = this.pusher.subscribe('assignments');
      this.channel.bind('create', this.onMessage.bind(this))
    },
    cacheCluster: function(tile) {
      return this.clusterCache[tile.key] = this.clusterCache[tile.key] || new Cluster()
    },
    onMessage: function(data) {
      data = typeof(data) == "string" ? JSON.decode(data) : data
      data.each(function(d){
        this.cluster.add(d)
      }, this)
      this.cluster.compute(this)
      this.reload()
    },
    render: function(tile, tileProjection) {
      var g = tile.element = this.po.svg("g");
      var size = this.map.tileSize();
      this.data.each(function(data){
        var coords = tileProjection(tile).locationPoint(data.coords)
        //It blows, but polymaps makes us re-render everything anytime data comes in...
        if(coords.x > 0 && coords.x < size.x && coords.y > 0 && coords.y < size.y) {
          var c = this.po.svg("circle")
          c.set("r", Math.pow(2, tile.zoom - 3) * Math.sqrt(data.size));
          c.set("transform", "translate(" + coords.x + "," + coords.y + ")");
          if(data.fresh) {
            c.set("style", "fill-opacity:1;fill:#FFFFFF")
            //$(c).fade(0.5)//, "#70AFC4")
            //c.tween("fill", "#70AFC4")
            var fx = new Fx.Morph(c, {
              duration: 750,
              onComplete: function(){
                c.set("style", "fill-opacity:0.5;fill:#70AFC4")
              }
            });
            fx.start({"fill-opacity": 0})
          } else {
            c.set("style", "fill-opacity:0.5;fill:#70AFC4")
          }
          g.appendChild(c)
        }
      }, this)
    },
    reload: function(){
      this.map.resize()
      this.layer.reload()
    },
    geometry: function(data){
      return data.map(function(d){
        return { 
          geometry: {
            coordinates: d.ll,//.reverse(),
            type: "Point"
          }
        }
      })
    },
    setupMap: function(){
      this.po = org.polymaps;

      this.map = this.po.map()
        .container(this.element.appendChild(this.po.svg("svg")))
        .center({lat: 38.79, lon: -96.07})
        .zoom(4.17)
        .zoomRange([1, 9]);
        //.add(this.po.interact());

      this.map.add(this.po.image()
              .url(this.po.url("http://{S}tile.cloudmade.com"
                          + "/e5db7ff94b054de799146f983c9c4a70"
                          + "/26332/256/{Z}/{X}/{Y}.png")
                   .hosts(["a.", "b.", "c.", ""])));

      //this.map.add(this.po.fullscreen());

      this.map.add(this.po.compass()
              .pan("none"));
                  
      this.layer = this.po.layer(this.render.bind(this));
      this.map.add(this.layer);
    }
  })
  
  //No idea why I have to do this...
  function fuck() {
    map = new LiveMap("map") 
  }
  fuck.delay(1000)
})