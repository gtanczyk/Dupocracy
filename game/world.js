var world = new (function() {
	var IDserial = 0;	
	var IDmap = {};
	
	this.nextID = function() {
		return IDserial++;
	};
	
	var launchers = [];
	var launcherTargets = {};
	var interceptors = [];
	var radars = [];
	var missiles = [];

	var worldTime = 0;
	var groups = [ launchers, interceptors, radars, missiles ];
	
	// population hotspots aka cities, players should attack/protect them in order to win 
	var population = [	{ name: 'Moscow', x: 780, y: 130, r: 20, faction: 'Russia' },
						{ name: 'Berlin', x: 680, y: 170, r: 20, faction: 'Europe' },
						{ name: 'Chicago', x: 260, y: 170, r: 20, faction: 'North America' },
						{ name: 'Cape Town', x: 710, y: 470, r: 20, faction: 'Africa' },
						{ name: 'Bejing', x: 1040, y: 250, r: 20, faction: 'Asia' },
						{ name: 'Tokyo', x: 1140, y: 220, r: 20, faction: 'Asia' },
						{ name: 'Rio de janeiro', x: 490, y: 400, r: 20, faction: 'Latin America' }];		
	
	// store/restore
	
	this.store = function() {
		return { IDserial: IDserial, groups: groups, population: population, worldTime: worldTime }; 
	}
	
	this.restore = function(state) {
		IDserial = state.IDserial;
		worldTime = state.worldTime;
		UI.updateWorldTime(state.worldTime);

		groups = state.groups;
		launchers = groups[0];
		interceptors = groups[1];
		radars = groups[2];
		missiles = groups[3];
		
		population = state.population;
	}
	
	// update

	var lastUpdate;
	var lag = 0;
	function update() {
		var tdt = new Date().getTime() - lastUpdate + lag;
		lag = 0;
		lastUpdate = new Date().getTime();
		worldTime += tdt;
		
		while (afterListeners[0] && afterListeners[0].t <= worldTime)
			afterListeners.splice(0, 1)[0].fn(worldTime);
		
		var dt = Math.min(tdt, 0.05);
		
		var updateStart = performance.now();		
		
		do {
			
			updateLaunchers(dt);
			
			updateMissiles(dt);
			
			triggerInterceptors(worldTime+dt, dt);
			
			updateInterceptors(dt);												
			
			tdt -= dt;
			dt = Math.min(tdt, 0.05);						
		} while(dt > 0 && (performance.now() - updateStart < 5));
		
		lag += tdt;
		worldTime -= tdt;
			
		UI.updateWorldTime(worldTime);
	}
	
	function updateLaunchers(dt) {
		var i = launchers.length;
		while (i--) {
			var launcher = launchers[i];
			
			if(launcher.opts.switchModeTS && (worldTime - launcher.opts.switchModeTS) > 10000) {
				launcher.opts.mode = (launcher.opts.mode+1)%2;
				delete launcher.opts.switchModeTS;
			}
			
			if(launcher.opts.target) {
				if(launcher.opts.launchTS && (worldTime - launcher.opts.launchTS) < 5000 || launcher.opts.mode==0)
					continue;
				
				launcher.opts.launchTS = worldTime;
				add('missile', launcher.x, launcher.y, { tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });
				delete launcher.opts.target;
			}
		};
	}
	
	function updateMissiles(dt) {
		var j = missiles.length;
		while (j--) {
			var missile = missiles[j];
			missile.ft += dt / 1000;
			if(missile.ft < 100 && !missile.dead) {
				if(!missile.V)
					missile.V = VMath.normalize([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]);
				var V = missile.V;
				missile.x = missile.x + V[0]*dt/40; 
				missile.y = missile.y + V[1]*dt/40;
				
				if(VMath.length([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]) < 10 && !missile.dead) {
					missile.V = [0, 0]
					missile.dead = true;
					population.some(function(hotspot) {
						if(VMath.distance([missile.x, missile.y], [hotspot.x, hotspot.y]) < hotspot.r)
							hotspot.r *= 0.8;
					});
					launchers.some(function(launcher) {
						if(VMath.distance([missile.x, missile.y], [launcher.x, launcher.y]) < 8)
							remove(launcher.id);
					});
					radars.some(function(radar) {
						if(VMath.distance([missile.x, missile.y], [radar.x, radar.y]) < 8)
							remove(launcher.id);
					});
					remove(missile.id);
				}					
									
			} else {
				missile.dead = true;
				remove(missile.id);
			}

		};
	};
	
	function triggerInterceptors(worldTime, dt) {
		var i = launchers.length;
		while (i--) {
			var launcher = launchers[i];
			if(launcher.opts.nextTickTS  > worldTime || launcher.opts.mode!=0 || 
				launcher.opts.nextLaunchTS > worldTime)
				continue;
			
			launcher.opts.nextTickTS = worldTime + 2000;
			
			var j = missiles.length;
			while (j--) {
				var missile = missiles[j];	
				if(launcher.opts.faction != missile.opts.faction)
					updateLauncher(launcher, worldTime, dt, missile);
			}
		};
	}
	
	function updateLauncher(launcher, worldTime, dt, missile) {
		var target = IDmap[launcherTargets[launcher.id]];
		if(!target && VMath.distance([launcher.x, launcher.y], [missile.x, missile.y]) < 500 ||
			target && launcher.opts.nextLaunchTS < worldTime) {
			launcher.opts.nextLaunchTS = worldTime + 2000;
			launcherTargets[launcher.id] = missile.id;
			add('interceptor', launcher.x, launcher.y, { targetID: missile.id, faction: launcher.opts.faction });					
		}
	}
	
	function updateInterceptors(dt) {
		var j = interceptors.length;
		while (j--) {
			var interceptor = interceptors[j];
			interceptor.ft += dt / 1000;
			var target = IDmap[interceptor.opts.targetID];
			var dP = target ? [ target.x - interceptor.x, target.y - interceptor.y ] :
							  interceptor.V;
			if((target && interceptor.ft < 20 || !target && interceptor.ft < 10) && !interceptor.dead && dP) {										
				var distance = VMath.length(dP);
				var V = interceptor.V = VMath.scale(dP, 1 / distance);
				interceptor.x = interceptor.x + V[0]*dt/35; 
				interceptor.y = interceptor.y + V[1]*dt/35;
				if(target && distance < 5) {
					target.dead = true;
					interceptor.dead = true;
					remove(interceptor.id);
					remove(target.id);
				}
			} else {
				interceptor.dead = true;
				remove(interceptor.id);
			}
		};
	}

	var updateInterval;
	this.run = function() {
		if(updateInterval)
			return;
		
		lastUpdate = new Date().getTime();
		updateInterval = setInterval(update, 5);
	};
	
	this.stop = function() {
		if(!updateInterval)
			return;
		
		clearInterval(updateInterval);
		updateInterval = null;
		lastUpdate = null;
		
		UI.updateWorldTime(worldTime);
	}
	
	var afterListeners = [];
	
	this.after = function(t, fn) {		
		if(!lastUpdate)
			this.run();
		
		afterListeners.push({ t: worldTime+t, fn: fn });
	}
	
	// constraint check
	
	this.countGroup = function(type, faction) {
		var group = type=='launcher' && launchers || type=='radar' && radars;
		if(group)
			return group.reduce(function(count, object) { 
				if(object.opts.faction == faction)
					return count + 1; 
				else 
					return count;  }, 0);
		else 
			return 0;
	};
	
	this.canAdd = function(type, x, y, opts) {
		// can add new military building whenever it is not more far away than 100 from my faction hotspots and no closer than 100 to enemy hotspots
		if(type=='launcher' || type=='radar') {
			return (this.countGroup(type, opts.faction) < 5) &&			
			population.some(function(hotspot) {
				return hotspot.faction == opts.faction && 
						VMath.distance([x, y], [hotspot.x, hotspot.y]) < 100;
			}) && population.every(function(hotspot) {
				return hotspot.faction == opts.faction || 
				VMath.distance([x, y], [hotspot.x, hotspot.y]) > 100;
				})		
		} else
			return true;
	}
	
	// control
	
	this.setTarget = function(id, x, y) {
		IDmap[id].opts.target = [x, y];
	}
	
	this.switchMode = function(id) {
		IDmap[id].opts.switchModeTS = worldTime;
	}
	
	// new object
	
	var onAddListeners = [];
	
	this.onAdd = function(fn) {
		onAddListeners.push(fn);
	}
	
	var add = this.add = function(type, x, y, opts, id) {
		if(!id)
			onAddListeners.every(function(fn) { 
				fn(type, x, y, opts);
			})
		else {
			var object = { id: id, type: type, x: x, y: y, width: 16, height: 16, shape: (type == 'interceptor' ? 'ball' : type == 'launcher' ? 'rect' : 'arc'), ft: 0, opts: opts };
			IDmap[object.id] = object;
			(type == 'launcher' ? launchers : 
			 type == 'radar' ? radars :
			 type == 'missile' ? missiles :		 
			 type == 'interceptor' ? interceptors:
				[]).push(object);
		}
	};

	// removal
	
	var onRemoveListeners = [];
	
	this.onRemove = function(fn) {
		onRemoveListeners.push(fn)
	}
	
	var remove = this.remove = function(objectID) {
		if(IDmap[objectID])
			delete IDmap[objectID];
		groups.some(function(group) {
			if(group.some(function(object, idx) { 
				if(object.id == objectID) {
					group.splice(idx, 1);
					return true;					
				}
			}))				
				onRemoveListeners.some(function(listener) {
					listener(objectID);
				});
		});
	}
	
	// query
	
	this.query = function(x, y, r, rect) {
		var result = [];
		
		groups.some(function(group) {
			return group.some(function(object) {
				if(!object.dead && rect && VMath.insideRect([object.x, object.y], rect) || 
					VMath.distance([x, y], [object.x, object.y]) < r) {
					result.push(object);
					return !!!rect;
				}
			});
		});
		
		return result;
	}

	// rendering
	
	this.visibilityCheck = function(object) {
		return true;
	}
	
	this.render = function() {
		groups.some(function(group) {
			group.some(function(object) {
				if(object.dead || !world.visibilityCheck)
					return;
				
				var color = object.selected ? 'yellow' : (object.opts.mode==0?'blue':'red');
				if(object.shape == 'rect')
					view.fillRect(object.x - object.width/2, object.y - object.height/2, object.width, object.height, color);
				else if(object.shape == 'arc')
					view.fillArc(object.x, object.y, object.width / 2, color);
				else if(object.shape == 'ball')
					view.fillArc(object.x, object.y, object.width / 8, color);
			});
		});
		
		population.some(function(hotspot) {
			var w =  Math.sqrt(hotspot.r) + 5;
			view.fillRect(hotspot.x-w/2, hotspot.y-w/2, w, w, 'green', Math.PI/4);
		});
	};
	
	this.initial = JSON.parse(JSON.stringify(this.store()));
	
})();