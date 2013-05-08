(function(global) {
	function StateMachine() {
		this.table = [];
	}

	StateMachine.prototype.feed = function(currentState, eventType,
			targetState, handler) {
		this.table.push({
			currentState : currentState,
			eventType : eventType,
			targetState : targetState,
			handler : handler
		});
	};

	StateMachine.prototype.bitMode = function(bitStates, bitEvents) {
		this.bitModeStates = bitStates;
		this.bitModeEvents = bitEvents;
	};

	StateMachine.prototype.getBitMode = function() {
		return {
			bitStates : this.bitModeStates,
			bitEvents : this.bitModeEvents
		};
	};

	StateMachine.prototype.event = function(eventType) {
		this.table
				.every(function(feed) {
					if (((this.bitModeStates && (feed.currentState & this.currentState) > 0) || (!this.bitModeStates && feed.currentState === this.currentState))
							&& ((this.bitModeEvents && (feed.eventType & eventType) > 0))
							|| (!this.bitModeEvents && feed.eventType === eventType)) {
						if (feed.handler)
							feed.handler(eventType);

						this.currentState = feed.targetState;
						return false;
					}
					return true;
				}.bind(this));
	};

	StateMachine.prototype.init = function(currentState) {
		this.currentState = currentState;
	};

	StateMachine.prototype.delegate = function(eventType, handler) {
		return function() {
			this.event(eventType);
		}.bind(this);
	};

	global["StateMachine"] = StateMachine;
})(this);