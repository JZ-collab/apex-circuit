extends SceneTree

func _init() -> void:
	var car := preload("res://scripts/car.gd").new()
	root.add_child(car)
	car.model_path = ""
	# Repeated stationary reverse -> first cycles. The old code left gear at -1
	# and indexed the forward ratio array negatively, producing NaN RPM/force.
	for cycle in 5:
		for i in 12:
			car.drive(0.0, 1.0, 0.0, 0.016)
		assert(car.reverse and car.gear == -1, "reverse should engage")
		assert(is_finite(car.rpm) and is_finite(car.engine_force), "reverse values finite")
		for i in 12:
			car.drive(1.0, 0.0, 0.0, 0.016)
		assert(!car.reverse and car.gear == 1, "drive should engage at gear 1")
		assert(is_finite(car.rpm) and is_finite(car.engine_force), "drive values finite")
		assert(car.gear >= 1 or car.reverse, "gear must never be invalid")
	# Mixed pedal input must not corrupt state either.
	for i in 30:
		car.drive(0.6, 0.6, 0.2, 0.016)
		assert(is_finite(car.rpm) and is_finite(car.engine_force), "mixed input finite")
	print("PASS reverse -> first: gear=%d rpm=%.0f cycles=5" % [car.gear, car.rpm])
	quit()
