var world = new (function() {
	var IDserial = 0;
	var IDmap = {};
	
	var launchers = [];
	var launcherTargets = {};
	var interceptors = [];
	var radars = [];
	var missiles = [];

	var worldTime = 0;
	var groups = [ launchers, interceptors, radars, missiles ];
	
	// population hotspots aka cities, players should attack/protect them in order to win 
	var population = [	{ name: 'Berlin', x: 680, y: 170, r: 20, faction: 'europe' },
						{ name: 'Chicago', x: 260, y: 170, r: 20, faction: 'namerica' },
						{ name: 'Cape Town', x: 710, y: 470, r: 20, faction: 'africa' },
						{ name: 'Bejing', x: 1040, y: 250, r: 20, faction: 'asia' },
						{ name: 'Tokyo', x: 1140, y: 220, r: 20, faction: 'asia' },
						{ name: 'Rio de janeiro', x: 490, y: 400, r: 20, faction: 'lamerica' }];		
	
	// store/restore
	
	this.store = function() {
		return { IDserial: IDserial, groups: groups, population: population, worldTime: worldTime }; 
	}
	
	this.restore = function(state) {
		IDserial = state.IDserial;
		worldTime = state.worldTime;

		groups = state.groups;
		launchers = groups[0];
		interceptors = groups[1];
		radars = groups[2];
		missiles = groups[3];
		
		population = state.population;
	}
	
	// update

	var lastUpdate;
	function update() {
		var tdt = new Date().getTime() - lastUpdate;			
		lastUpdate += tdt;
		worldTime += tdt;
		
		while (afterListeners[0] && afterListeners[0].t <= worldTime)
			afterListeners.splice(0, 1)[0].fn(worldTime);
		
		var dt = Math.min(tdt, 0.05);
		
		do {
			launchers.some(function(launcher) {
				if(launcher.opts.target) {
					if(launcher.opts.launchTS && (worldTime - launcher.opts.launchTS) < 3000)
						return;
					
					launcher.opts.launchTS = worldTime;
					add('missile', launcher.x, launcher.y, { tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });
					delete launcher.opts.target;
				}
			});
			
			missiles.some(function(missile) {
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
						remove(missile.id);
					}
					
					launchers.some(function(launcher) {
						if(launcher.opts.mode!=0 || launcher.opts.faction == missile.opts.faction)
							return;
						
						var target = launcherTargets[launcher.id];
						if(!target || VMath.distance([target.x, target.y], [missile.x, missile.y]) < 300) {
							if(launcher.opts.launchTS && (worldTime - launcher.opts.launchTS) < 3000)
								return;
							launcher.opts.launchTS = worldTime;
							add('interceptor', launcher.x, launcher.y, { targetID: missile.id });					
						}
					});
				} else {
					missile.dead = true;
					remove(missile.id);
				}

			});
			
			interceptors.some(function(interceptor) {
				interceptor.ft += dt / 1000;
				if(interceptor.ft < 100 && !interceptor.dead) {
					var target = IDmap[interceptor.opts.targetID];
					var dP = [ target.x - interceptor.x, target.y - interceptor.y ];
					var distance = VMath.length(dP);
					var V = VMath.scale(dP, 1 / distance);
					interceptor.x = interceptor.x + V[0]*dt/35; 
					interceptor.y = interceptor.y + V[1]*dt/35;
					if(distance < 5) {
						target.dead = true;
						interceptor.dead = true;
						remove(interceptor.id);
						remove(target.id);
					}
				} else {
					interceptor.dead = true;
					remove(interceptor.id);
				}
			});
			
			tdt -= dt;
			dt = Math.min(tdt, 0.05);
			
			UI.updateWorldTime(worldTime);
		} while(dt > 0)
	}

	var updateInterval;
	this.run = function() {
		if(updateInterval)
			return;
		
		lastUpdate = new Date().getTime();
		updateInterval = setInterval(update, 10);
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
	
	var add = this.add = function(type, x, y, opts) {
		var object = { id: IDserial++, type: type, x: x, y: y, width: 16, height: 16, shape: (type == 'interceptor' ? 'ball' : type == 'launcher' ? 'rect' : 'arc'), ft: 0, opts: opts };
		IDmap[object.id] = object;
		(type == 'launcher' ? launchers : 
		 type == 'radar' ? radars :
		 type == 'missile' ? missiles :		 
		 type == 'interceptor' ? interceptors:
			[]).push(object);
	};
	
	// removal
	
	var onRemoveListeners = [];
	
	this.onRemove = function(fn) {
		onRemoveListeners.push(fn)
	}
	
	var remove = this.remove = function(objectID) {
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
			view.fillArc(hotspot.x, hotspot.y, hotspot.r, 'white');
		});
	};
	
	this.initial = JSON.parse(JSON.stringify(this.store()));
	
})();