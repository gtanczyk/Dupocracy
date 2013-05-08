(function(global) {
	function SMRenderer(sm) {		
		var plane = document.createElement('div');
		document.body.appendChild(plane);
		
		plane.style.width = '200px';
		plane.style.height = '200px';
		plane.style.position = 'fixed';
		plane.style.bottom = '0px';
		plane.style.right = '0px';
		plane.style.background = 'white';
		plane.style.boxShadow = 'inset 0px 0px 15px rgba(0, 0, 0, 0.5)';
		
		var canvas = document.createElement('canvas');
		canvas.width = '200';
		canvas.height= '200';
		plane.appendChild(canvas);
		
		var ctx = canvas.getContext('2d');
		
		var states = [], events = [];
		
		var bitMode = sm.getBitMode();
		var stateMask = 0, eventMask = 0;		
		sm.table.reduce(function(l, feed) {
			if(bitMode.bitStates)
				stateMask = stateMask | feed.currentState | feed.targetState;
			else {
				if(states.indexOf(feed.currentState) == -1)
					states.push(feed.currentState);
				if(states.indexOf(feed.targetState) == -1)
					states.push(feed.targetState);
			}
				
			
			if(bitMode.bitEvents)
				eventMask = eventMask | feed.eventType;
			else if(events.indexOf(feed.eventType) == -1)
				events.push(feed.eventType);
		});
		
		if(bitMode.bitStates)
			for(var i = 0; i < 32; i++)
				if((stateMask >> i) & 1)
					states.push(1 << (i));
		
		if(bitMode.bitEvents)
			for(var i = 0; i < 32; i++)
				if((eventMask >> i) & 1)
					events.push(1 << (i));				
					
		ctx.fillStyle = 'red';
		
		var step = (1 / states.length) * Math.PI*2;
		var stateMap = {};
		states.every(function(state, idx) {
			stateMap[state] = [100 + Math.cos(idx*step) * 50, 100 + Math.sin(idx*step) * 50, 15, 15];
			ctx.fillRect.apply(ctx, stateMap[state]);
			return true;
		});
		var _event = sm.event;
		sm.event = function(eventType) {
			var currentState = this.currentState;
			_event.apply(sm, arguments);
			if (currentState != this.currentState) {
				if(!stateMap[currentState])
					return;
						
				ctx.fillStyle = 'red';
				ctx.fillRect.apply(ctx, stateMap[currentState]);
				ctx.fillStyle = 'green';
				ctx.fillRect.apply(ctx, stateMap[this.currentState]);
				
				ctx.beginPath();
				ctx.moveTo(stateMap[currentState][0]+7, stateMap[currentState][1]+7);
				ctx.quadraticCurveTo((stateMap[currentState][0]+stateMap[this.currentState][0])/2, 
									 (stateMap[currentState][1]+stateMap[this.currentState][1])/2, stateMap[this.currentState][0]+7, stateMap[this.currentState][1]+7);
				ctx.stroke();
			}
		}
	}

	global["SMRenderer"] = SMRenderer;
})(this);