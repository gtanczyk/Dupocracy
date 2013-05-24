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
	var scouts = [];
	
	var worldTime = 0;
	var groups = [ launchers, interceptors, radars, missiles, scouts ];
	
	// population hotspots aka cities, players should attack/protect them in order to win 
	var population = [	{ name: 'Moscow', x: 780, y: 130, r: 20, faction: 'Russia' },
						{ name: 'Berlin', x: 680, y: 170, r: 20, faction: 'Europe' },
						{ name: 'Chicago', x: 260, y: 170, r: 20, faction: 'North America' },
						{ name: 'Cape Town', x: 710, y: 470, r: 20, faction: 'Africa' },
						{ name: 'Bejing', x: 1040, y: 250, r: 20, faction: 'Asia' },
						{ name: 'Tokyo', x: 1140, y: 220, r: 20, faction: 'Asia' },
						{ name: 'Rio de janeiro', x: 490, y: 400, r: 20, faction: 'Latin America' }];		

	var visibility = population.reduce(function(r, city) {
		if(!r[city.faction])
			r[city.faction] = { V: {}, H: {} }; 
		return r; 
	}, {});

	
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
		scouts = groups[4];
		
		population = state.population;
	}
	
	// update

	var lastUpdate;
	var lag = 0;
	function update() {
		var tdt = new Date().getTime() - lastUpdate + lag;
		lag = 0;
		lastUpdate = new Date().getTime();
		
		while (afterListeners[0] && afterListeners[0].t <= worldTime)
			afterListeners.splice(0, 1)[0].fn(worldTime);
		
		var dt = Math.min(tdt, 0.1);
		
		var updateStart = performance.now();		
		
		do {
			
			updateLaunchers(dt);
			
			updateMissiles(dt);
			
			triggerInterceptors(worldTime, dt);
			
			updateInterceptors(dt);		
			
			updateScouts(dt);	
			
			tdt -= dt;
			dt = Math.min(tdt, 0.1);
			
			worldTime += dt;
		} while(dt > 0 && (performance.now() - updateStart < 10));
		
		lag += tdt;
		UI.updateWorldTime(worldTime);
	}
	
	function updateLaunchers(dt) {
		var i = launchers.length;
		while (i --> 0) {
			var launcher = launchers[i];
			
			if(launcher.opts.switchModeTS && (worldTime - launcher.opts.switchModeTS) > 10000) {
				launcher.opts.mode = launcher.opts.switchMode;
				delete launcher.opts.switchModeTS;
				delete launcher.opts.switchMode;
			}
			
			if(launcher.opts.target) {
				if(launcher.opts.launchTS && (worldTime - launcher.opts.launchTS) < 5000 || launcher.opts.mode == 0)
					continue;
				
				launcher.opts.launchTS = worldTime;
				if(launcher.opts.mode == 1 &&  launcher.opts.targetMode == 1)
					add('missile', launcher.x, launcher.y, { tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });				
				else if(launcher.opts.mode == 2 &&  launcher.opts.targetMode == 2)
					add('scout', launcher.x, launcher.y, { tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });	
				
				delete launcher.opts.target;
			}
		};
	}
	
	function updateMissiles(dt) {
		var j = missiles.length;
		while (j --> 0) {
			var missile = missiles[j];
			missile.ft += dt / 1000;
			if(missile.ft < 100 && !missile.dead) {
				if(!missile.V)
					missile.V = VMath.normalize([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]);
				var V = missile.V;
				missile.x = missile.x + V[0]*dt/40; 
				missile.y = missile.y + V[1]*dt/40;
				
				if(VMath.length([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]) < 8 && !missile.dead) {
					missile.V = [0, 0]
					missile.dead = true;
					population.some(function(hotspot) {
						if(VMath.distance([missile.x, missile.y], [hotspot.x, hotspot.y]) < hotspot.r + 8)
							hotspot.r *= 0.8;
					});
					launchers.some(function(launcher) {
						if(VMath.distance([missile.x, missile.y], [launcher.x, launcher.y]) < 16)
							remove(launcher.id);
					});
					radars.some(function(radar) {
						if(VMath.distance([missile.x, missile.y], [radar.x, radar.y]) < 16)
							remove(radar.id);
					});
					remove(missile.id);
				}					
									
			} else {
				missile.dead = true;
				remove(missile.id);
			}

		};
	};
	
	var sight;
	
	function triggerInterceptors(worldTime, dt) {
		if(!sight || worldTime - sight.ts > 1000) {
			sight = { ts: worldTime };
			groups.some(function(group) {
				group.some(function(object) {
					if(!object.dead) {
						if(!sight[object.opts.faction])
							sight[object.opts.faction] = { V: {}, H: {} };
						
						var left = Math.floor((object.x-object.visibilityRadius) / 16);
						var top = Math.floor((object.y-object.visibilityRadius) / 16);
						var right = Math.floor((object.x+object.visibilityRadius) / 16);
						var bottom = Math.floor((object.y+object.visibilityRadius) / 16);
						for(var i = left; i <= right; i++)
							sight[object.opts.faction].H[i] = true;
						for(var i = top ; i <= bottom; i++)
							sight[object.opts.faction].V[i] = true;
					}
				});
			});
		}
		
		var i = launchers.length;
		while (i --> 0) {
			var launcher = launchers[i];
			if(launcher.opts.nextTickTS  > worldTime || launcher.opts.mode!=0 || 
				launcher.opts.nextLaunchTS > worldTime)
				continue;
			
			launcher.opts.nextTickTS = worldTime + 2000;
			
			var j = missiles.length;
			while (j --> 0) {
				var missile = missiles[j];	
				if(launcher.opts.faction != missile.opts.faction && visibilityCheck(missile, sight[launcher.opts.faction], launcher.opts.faction))
					updateLauncher(launcher, worldTime, dt, missile);
			}
		};
	}
	
	function updateLauncher(launcher, worldTime, dt, missile) {
		var target = IDmap[launcherTargets[launcher.id]];
		if(!target && VMath.distance([launcher.x, launcher.y], [missile.x, missile.y]) < 500 || target && launcher.opts.nextLaunchTS < worldTime) {
			launcher.opts.nextLaunchTS = worldTime + 2000;
			launcherTargets[launcher.id] = missile.id;
			add('interceptor', launcher.x, launcher.y, { targetID: missile.id, faction: launcher.opts.faction });					
		}
	}
	
	function updateInterceptors(dt) {
		var j = interceptors.length;
		while (j --> 0) {
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
	
	function updateScouts(dt) {
		var j = scouts.length;
		while(j --> 0)  {
			var scout = scouts[j];
			scout.ft += dt / 1000;
			if(scout.ft < 100 && !scout.dead) {				
				if(!scout.V)
					scout.V = VMath.normalize([ scout.opts.tx - scout.x, scout.opts.ty - scout.y ]);
				else {
					var V = VMath.normalize([ scout.opts.tx - scout.x + Math.cos(scout.ft) * 20, 
											  scout.opts.ty - scout.y + Math.sin(scout.ft) * 20]);
					scout.V = VMath.add(scout.V, VMath.scale(VMath.sub(V, scout.V), dt / 100));
				}
				var V = scout.V;
				scout.x = scout.x + V[0]*dt/40; 
				scout.y = scout.y + V[1]*dt/40;
			} else {
				scout.dead = true;
				remove(scout.id);
			}
		}
	}

	var updateInterval;
	this.run = function() {
		if(updateInterval)
			return;
		
		lastUpdate = new Date().getTime();
		updateInterval = setInterval(update, 1);
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
	
	this.setTarget = function(id, x, y, mode) {
		IDmap[id].opts.target = [x, y];
		IDmap[id].opts.targetMode = mode; 
	}
	
	this.switchMode = function(id, mode) {
		IDmap[id].opts.switchModeTS = worldTime;
		IDmap[id].opts.switchMode = mode;
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
			var object = { 
				id: id, type: type, 
				x: x, y: y, 
				width: 16, height: 16, 
				shape: {
					interceptor: 'ball', launcher: 'rect', 
					scout : 'triangle', radar: 'arc', missile: 'arc'
				}[type],
				visibilityRadius: {
					interceptor: 15, launcher: 30, 
					scout : 50, radar: 150, missile: 20
				}[type],
				ft: 0, opts: opts 
			};
			
			IDmap[object.id] = object;
			(type == 'launcher' ? launchers : 
			 type == 'radar' ? radars :
			 type == 'missile' ? missiles :		 
			 type == 'interceptor' ? interceptors :
			 type == 'scout' ? scouts :
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
	
	var visibleFaction;
	this.setVisibleFaction = function(faction) {
		visibleFaction = faction;
	}
	
	var visibilityCheck = this.visibilityCheck = function(object, sight, faction) {
		return !faction || (object.opts.faction == faction) || sight.V[Math.floor(object.y / 16)] && sight.H[Math.floor(object.x / 16)];
	}
	
	this.render = function() {
		if(visibleFaction && (new Date().getTime() - (visibility[visibleFaction].lastUpdate||0) > 1000)) {
			visibility[visibleFaction].lastUpdate = new Date().getTime() ;

			visibility[visibleFaction].H = [];
			visibility[visibleFaction].V = [];
			
			groups.some(function(group) {
				group.some(function(object) {
					if(!object.dead && visibleFaction == object.opts.faction) {
						var left = Math.floor((object.x-object.visibilityRadius) / 16);
						var top = Math.floor((object.y-object.visibilityRadius) / 16);
						var right = Math.floor((object.x+object.visibilityRadius) / 16);
						var bottom = Math.floor((object.y+object.visibilityRadius) / 16);
						for(var i = left; i <= right; i++)
							visibility[object.opts.faction].H[i] = true;
						for(var i = top ; i <= bottom; i++)
							visibility[object.opts.faction].V[i] = true;
					}
				});
			});
		}
		
		groups.some(function(group) {
			group.some(function(object) {
				if(object.dead || !world.visibilityCheck(object, visibility[visibleFaction], visibleFaction))
					return;
				
				if(visibleFaction == object.opts.faction)
					view.lightUp(object.x, object.y, object.visibilityRadius);				
				
				var color = object.selected ? 'yellow' : (object.opts.mode==0?'blue':object.opts.mode==2?'white':'red');
				if(object.shape == 'rect')
					view.fillRect(object.x - object.width/2, object.y - object.height/2, object.width, object.height, color);
				else if(object.shape == 'arc')
					view.fillArc(object.x, object.y, object.width / 2, color);
				else if(object.shape == 'ball')
					view.fillArc(object.x, object.y, object.width / 8, color);
				else if(object.shape == 'triangle')
					view.fillArc(object.x, object.y, object.width / 8, 'white');
			});
		});
		
		population.some(function(hotspot) {
			var w =  Math.sqrt(hotspot.r) + 5;
			view.fillRect(hotspot.x-w/2, hotspot.y-w/2, w, w, 'green', Math.PI/4);
		});
	};
	
	this.initial = JSON.parse(JSON.stringify(this.store()));
	
})();