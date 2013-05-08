(function(global) {
	var VMath = global["VMath"] = {
			EPSILON: Math.pow(2, -16),

			length: function(V) {
				return Math.sqrt(V[0] * V[0] + V[1] * V[1])
			},
			distanceSquared: function(A, B) {
				return Math.pow(A[0] - B[0], 2) + Math.pow(A[1] - B[1], 2);
			},
			distance: function(A, B) {
				return Math.sqrt(this.distanceSquared(A, B));
			},

			// http://stackoverflow.com/a/1501725
			distanceFromLine: function(P, A, B) {
				// Return minimum distance between line segment vw and point p
				var l2 = this.distanceSquared(A, B); // i.e. |w-v|^2 - avoid a sqrt
				if (l2 == 0)
					return this.distance(P, A); // v == w case
				// Consider the line extending the segment, parameterized as v + t (w -
				// v).
				// We find projection of point p onto the line.
				// It falls where t = [(p-v) . (w-v)] / |w-v|^2
				var t = this.perpDot(this.sub(P, A), this.sub(P, B)) / l2;
				if (t < 0)
					return this.distance(P, B); // Beyond the 'v' end of the segment
				else if (t > 1)
					return this.distance(P, A);
				// Beyond the 'w' end of the segment
				var projection = this.add(B, this.scale(this.sub(B, A), t)); // Projection
				// falls
				// on
				// the
				// segment
				return this.distance(P, projection);
			},
			normalize: function(A) {
				return this.scale(A, 1 / this.length(A));
			},

			angle: function(A, B) {
				return Math.atan2(this.perpDot(A, B), this.dot(A, B));
			},
			dot: function(A, B) {
				return A[0] * B[0] + A[1] * B[1];
			},
			perpDot: function(A, B) {
				return A[0] * B[1] - A[1] * B[0];
			},

			sub: function(A, B) {
				return [A[0] - B[0], A[1] - B[1]];
			},
			add: function(A, B) {
				return [A[0] + B[0], A[1] + B[1]];
			},
			scale: function(V, s) {
				return [V[0] * s, V[1] * s];
			},

			rotate: function(V, a) {
				var l = this.length(V);
				a = Math.atan2(V[1], V[0]) + a;
				return [Math.cos(a) * l, Math.sin(a) * l];
			},

			reflect: function(V, N) {
				return [0, 0];
			},

			project: function(V, N) {
				return [0, 0]
			},

			normal: function(A, B) {
				var AB = this.sub(B, A);
				AB = this.scale(AB, 1 / this.length(AB));
				return [[-AB[1], AB[0]], [AB[1], -AB[0]]];
			},

			// http://stackoverflow.com/a/565282
			// u = (q â�’ p) Ă— r / (r Ă— s)
			// t = (q â�’ p) Ă— s / (r Ă— s)
			// r x s = 0 => parallel
			// (q â�’ p) Ă— r = 0 => colinear
			intersectLineLine: function(Q, eQ, P, eP) {
				var S = this.sub(eQ, Q);
				var R = this.sub(eP, P);
				var RxS = this.perpDot(R, S);
				if (RxS == 0)
					return;
				var u = this.perpDot(this.sub(Q, P), R) / RxS;
				var t = this.perpDot(this.sub(Q, P), S) / RxS;
				if (u < 0 || t < 0 || u > 1 || t > 1)
					return;
				return [u, t]
			},

			// http://www.gamasutra.com/view/feature/131790/simple_intersection_tests_for_games.php?page=2
			// (B[u] - A[u]) x (B[u]-A[u]) = (Ra+Rb)^2
			// AB x AB + (2 * Vab x AB) * u + Vab x Vab * u^2 = (ra + rb)^2
			intersectSphereSphere: function(A, B, Va, Vb, Ra, Rb) {
				var AB = this.sub(B, A);
				var Vab = this.sub(Vb, Va);
				var Rab = Ra + Rb;
				var dotAB = this.dot(AB, AB);
				var sqrRab = Rab * Rab;

				var a = this.dot(Vab, Vab);

				if (a == 0)
					return;

				var b = 2 * this.dot(Vab, AB);

				var c = dotAB - sqrRab;

				if (dotAB <= sqrRab)
					return [0, 0];

				var d = b * b - 4 * a * c;

				if (d < 0)
					return;

				d = Math.sqrt(d);

				var T1 = (-b - d) / (2 * a)
				var T2 = (-b + d) / (2 * a);

				return T1 < T2 ? [T1, T2] : [T2, T1];
			},

			// P - circle center,
			// R - radius,
			// V - velocity
			// A, B - segment points
			intersectSphereLine: function(P, V, R, A, B) {
				var AB = this.sub(B, A);
				var ivdotAB = R / Math.sqrt(this.dot(AB, AB));
				var N1 = this.scale([-AB[1], AB[0]], ivdotAB);
				var N2 = this.scale([AB[1], -AB[0]], ivdotAB);
				N1 = this.add(P, N1);
				N2 = this.add(P, N2);

				var T = [this.intersectLineLine(N1, this.add(N1, V), A, B), this.intersectLineLine(N2, this.add(N2, V), A, B)];

				if (!T[0] || !T[1])
					return T[0] || T[1];

				if (!T[0] && !T[1])
					return;

				if (T[0][0] < T[1][0])
					T = T[0];
				else
					T = T[1];

				if (T[0][0] < 0 || T[1] < 0)
					return;

				if (T[0] <= 1 && T[1] <= 1)
					return T;
			}
		}
})(this);