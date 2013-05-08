(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var view = new (function() {
	var viewWidth = window.innerWidth, viewHeight = window.innerHeight;
	
	// events

	this.on = function(event, handler) {
		return canvas.addEventListener(event, handler, false);		
	}
	
	// pointer control

	this.pointer = function(enabled) {
		canvas.style.cursor = enabled ? 'pointer' : null;
	}	
	
	// canvas util

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
	
	this.fillArc = function(x, y, radius, color) {
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI*2, true); 
		ctx.closePath();
		ctx.fill();
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
	
	this.drawImage = function(image) {
		var targetHeight = viewWidth * (image.height / image.width);
		ctx.drawImage(image, 0, 0, image.width, image.height, 0, (viewHeight - targetHeight) / 2, viewWidth, targetHeight);
	}	
	
	// animation
	
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
