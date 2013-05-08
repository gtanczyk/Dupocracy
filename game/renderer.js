(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var view = new (function() {
	var viewWidth = window.innerWidth, viewHeight = window.innerHeight;
	
	var canvas = document.createElement('canvas');
	canvas.width = viewWidth;
	canvas.height = viewHeight;
	
	document.body.appendChild(canvas);
	
	ctx = canvas.getContext('2d');
	
	var clear = this.clear = function() {
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, viewWidth, viewHeight);
	}
	
	this.fillRect = function(x, y, width, height, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, width, height);
	}
	
	this.drawShape = function(points) {
		ctx.strokeStyle = 'red';
		ctx.beginPath();
		ctx.moveTo(points[0][0], points[0][1]);
		points.some(function(point) {
			ctx.lineTo(point[0], point[1]);
		});		
		ctx.stroke();
	}	
	
	var onAnimateFns = [];
	this.onAnimate = function(fn) {
		onAnimateFns.push(fn);
	}
	
	function animationFrame() {
		onAnimateFns.some(function(fn) {
			fn();
		});
		
		clear();

		terrain.render(0, 0, viewWidth, viewHeight);		
		world.render(0, 0, viewWidth, viewHeight);

		requestAnimationFrame(animationFrame);
	}
	requestAnimationFrame(animationFrame);
	
})();
