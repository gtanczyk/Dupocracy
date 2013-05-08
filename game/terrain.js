var terrain = new (function() {
	var dimensions = this.dimensions = new Deferred();	

	var shapes = [];
	
	var background = new Image();
	background.addEventListener('load', function() {
		dimensions.resolve(background.width, background.height);
	});
	background.src = 'assets/world.png';	

	this.render = function() {
		view.drawImage(background);
		shapes.some(function(shape) {
			view.drawShape(shape);
		});
	}
})();